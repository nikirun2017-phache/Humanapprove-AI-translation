import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { parsePdfSource, type PdfParseResult } from "@/lib/source-parser"

const MIN_WORDS_PER_PAGE = 15
const MIN_CHARS_PER_PAGE = 75 // CJK fallback — ~15 words × 5 chars

/**
 * Count PDF pages directly from raw bytes by scanning for /Count entries in the
 * page tree dictionary. This is a reliable fallback for PDFs where PDF.js / pdf-parse
 * under-reports the page count (non-standard page trees, linearized PDFs, some scanner
 * outputs).
 *
 * Works on PDFs with an uncompressed cross-reference table (the vast majority of
 * scanned documents). For PDFs with a compressed xref stream the raw bytes are
 * partially opaque, but in practice the /Pages /Count entry is always in the clear
 * header section of the file.
 *
 * Returns 0 if nothing is found so callers can fall back gracefully.
 */
function countPagesFromRaw(buffer: Buffer): number {
  try {
    // Use latin1 so every byte maps 1:1 to a character — no UTF-8 decoding errors
    const raw = buffer.toString("latin1")

    // Collect every /Count N that appears in the document.
    // Page tree internal nodes carry /Count = total descendant pages.
    // The root /Pages node has the global page count (the maximum).
    const counts: number[] = []
    const re = /\/Count\s+(\d+)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(raw)) !== null) {
      counts.push(parseInt(m[1], 10))
    }

    return counts.length > 0 ? Math.max(...counts) : 0
  } catch {
    return 0
  }
}

/**
 * POST /api/translation-studio/probe-pdf
 * Accepts a PDF file and returns metadata for cost estimation:
 *   - numPages: actual page count
 *   - isScanned: true if the PDF has no embedded text (needs Claude Vision)
 *   - wordCount: total embedded word count (0 for scanned PDFs)
 *   - estimatedUnits: rough number of translation units we'd extract
 *   - cacheKey: opaque key — pass back to job creation to skip re-parsing
 *
 * Used by the Translation Wizard to show accurate cost estimates before
 * the user commits to a translation job.
 *
 * Runs the full parsePdfSource pipeline (including Claude Vision for scanned PDFs)
 * and caches the resulting units to a temp file so the job creation route can
 * reuse them without re-parsing.
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  // Write PDF to temp file — all extraction tools need it on disk
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join } = require("path") as typeof import("path")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { tmpdir } = require("os") as typeof import("os")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomBytes } = require("crypto") as typeof import("crypto")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { writeFileSync, readFileSync, unlinkSync, existsSync } = require("fs") as typeof import("fs")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { spawnSync } = require("child_process") as typeof import("child_process")

  const id = randomBytes(8).toString("hex")
  const tmpPdf = join(tmpdir(), `jendee_probe_${id}.pdf`)
  const tmpTxt = join(tmpdir(), `jendee_probe_${id}.txt`)
  const tmpPy  = join(tmpdir(), `jendee_probe_${id}.py`)
  const tmpOut = join(tmpdir(), `jendee_probe_${id}.json`)
  const cacheFile = join(tmpdir(), `jendee_units_${id}.json`)

  const cleanup = () => {
    for (const p of [tmpPdf, tmpTxt, tmpPy, tmpOut]) {
      try { if (existsSync(p)) unlinkSync(p) } catch { /* ignore */ }
    }
    // cacheFile is intentionally NOT deleted here — job creation reads it
  }

  try {
    writeFileSync(tmpPdf, buffer)

    let text = ""
    let numPages = 0

    // Strategy 1: pdftotext -layout (fastest, preserves layout)
    const r1 = spawnSync("pdftotext", ["-layout", tmpPdf, tmpTxt], { timeout: 30_000, encoding: "utf8" })
    if (r1.status === 0 && !r1.error) {
      text = readFileSync(tmpTxt, "utf8")
      numPages = Math.max(1, (text.match(/\f/g) ?? []).length + 1)
    }

    // Strategy 2: pdfplumber (Python) — if pdftotext not available or returned empty
    if (!text.trim()) {
      const script2 = `
import pdfplumber
with pdfplumber.open(${JSON.stringify(tmpPdf)}) as pdf:
    pages = [page.extract_text() or "" for page in pdf.pages]
    num_pages = len(pdf.pages)
    text = "\\f".join(pages)
with open(${JSON.stringify(tmpOut)}, "w", encoding="utf-8", errors="replace") as f:
    f.write("PAGES:" + str(num_pages) + "\\n")
    f.write("---TEXT---\\n")
    f.write(text)
`
      writeFileSync(tmpPy, script2, "utf8")
      const r2 = spawnSync("python3", [tmpPy], { timeout: 60_000, encoding: "utf8" })
      if (r2.status === 0 && !r2.error) {
        try {
          const raw2 = readFileSync(tmpOut, "utf8")
          const sep2 = raw2.indexOf("\n---TEXT---\n")
          if (sep2 !== -1) {
            numPages = parseInt(raw2.slice("PAGES:".length, sep2), 10) || numPages
            text = raw2.slice(sep2 + "\n---TEXT---\n".length)
          }
        } catch { /* fall through */ }
      }
    }

    // Strategy 3: pypdf (Python lightweight fallback)
    if (!text.trim()) {
      const script3 = `
from pypdf import PdfReader
reader = PdfReader(${JSON.stringify(tmpPdf)})
pages = [page.extract_text() or "" for page in reader.pages]
num_pages = len(reader.pages)
text = "\\f".join(pages)
with open(${JSON.stringify(tmpOut)}, "w", encoding="utf-8", errors="replace") as f:
    f.write("PAGES:" + str(num_pages) + "\\n")
    f.write("---TEXT---\\n")
    f.write(text)
`
      writeFileSync(tmpPy, script3, "utf8")
      const r3 = spawnSync("python3", [tmpPy], { timeout: 60_000, encoding: "utf8" })
      if (r3.status === 0 && !r3.error) {
        try {
          const raw3 = readFileSync(tmpOut, "utf8")
          const sep3 = raw3.indexOf("\n---TEXT---\n")
          if (sep3 !== -1) {
            numPages = parseInt(raw3.slice("PAGES:".length, sep3), 10) || numPages
            text = raw3.slice(sep3 + "\n---TEXT---\n".length)
          }
        } catch { /* fall through */ }
      }
    }

    // Cross-check page count with raw-byte scan (handles non-standard page trees)
    const rawPages = countPagesFromRaw(buffer)
    if (rawPages > numPages) numPages = rawPages
    if (numPages === 0) numPages = Math.max(1, Math.ceil(buffer.byteLength / (150 * 1024)))

    const wordCount = text.trim().split(/\s+/).filter(Boolean).length
    const charCount = text.replace(/\s+/g, "").length
    // Use character density as fallback for CJK languages (no spaces between words)
    const isScanned = wordCount / numPages < MIN_WORDS_PER_PAGE && charCount / numPages < MIN_CHARS_PER_PAGE

    // Estimate translation units:
    // - Text-based Latin: ~1 unit per paragraph (~80 words/paragraph)
    // - Text-based CJK: use character count (~400 chars/paragraph)
    // - Scanned: ~40 short segments per page (Claude Vision segmentation)
    const estimatedUnits = isScanned
      ? numPages * 40
      : charCount > wordCount * 1.5
        ? Math.max(1, Math.ceil(charCount / 400)) // CJK
        : Math.max(1, Math.ceil(wordCount / 80))  // Latin

    // Run the full parsePdfSource pipeline (including Claude Vision for scanned PDFs)
    // and cache the resulting units in the DB so job creation can skip re-parsing.
    // DB cache is instance-agnostic — works even when Cloud Run routes requests to
    // different container instances (filesystem /tmp is not shared across instances).
    let cacheKey: string | null = null
    try {
      let anthropicKey = ""
      const systemKey = await db.systemSetting.findUnique({ where: { key: "ai_anthropic_key" } })
      anthropicKey = systemKey?.value ?? ""

      const pdfResult = await parsePdfSource(buffer, anthropicKey || undefined)
      const cacheData: PdfParseResult = { units: pdfResult.units, sourceMarkdown: pdfResult.sourceMarkdown }
      // Store in DB (falls back to filesystem for local dev)
      await db.systemSetting.upsert({
        where: { key: `pdf_probe_${id}` },
        create: { key: `pdf_probe_${id}`, value: JSON.stringify(cacheData) },
        update: { value: JSON.stringify(cacheData) },
      })
      // Also write to filesystem as fallback for local dev
      try { writeFileSync(cacheFile, JSON.stringify(cacheData), "utf8") } catch { /* ignore */ }
      cacheKey = id
    } catch {
      // Cache population failed (e.g. no API key for scanned PDF) — job creation
      // will fall back to parsing again and show a meaningful error to the user.
    }

    return NextResponse.json({ numPages, isScanned, wordCount, estimatedUnits, cacheKey })
  } catch {
    const approxPages = Math.max(1, Math.ceil(buffer.byteLength / (150 * 1024)))
    return NextResponse.json({ numPages: approxPages, isScanned: true, wordCount: 0, estimatedUnits: approxPages * 40, cacheKey: null })
  } finally {
    cleanup()
  }
}
