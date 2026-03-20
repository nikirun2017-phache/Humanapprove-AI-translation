import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

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
 *
 * Used by the Translation Wizard to show accurate cost estimates before
 * the user commits to a translation job.
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
  const cleanup = () => {
    for (const p of [tmpPdf, tmpTxt, tmpPy, tmpOut]) {
      try { if (existsSync(p)) unlinkSync(p) } catch { /* ignore */ }
    }
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
import json, pdfplumber
with pdfplumber.open(${JSON.stringify(tmpPdf)}) as pdf:
    pages = [page.extract_text() or "" for page in pdf.pages]
    result = {"numPages": len(pdf.pages), "text": "\\f".join(pages)}
with open(${JSON.stringify(tmpOut)}, "w", encoding="utf-8") as f:
    json.dump(result, f)
`
      writeFileSync(tmpPy, script2, "utf8")
      const r2 = spawnSync("python3", [tmpPy], { timeout: 60_000, encoding: "utf8" })
      if (r2.status === 0 && !r2.error) {
        const d = JSON.parse(readFileSync(tmpOut, "utf8")) as { text: string; numPages: number }
        text = d.text; numPages = d.numPages
      }
    }

    // Strategy 3: pypdf (Python lightweight fallback)
    if (!text.trim()) {
      const script3 = `
import json
from pypdf import PdfReader
reader = PdfReader(${JSON.stringify(tmpPdf)})
pages = [page.extract_text() or "" for page in reader.pages]
result = {"numPages": len(reader.pages), "text": "\\f".join(pages)}
with open(${JSON.stringify(tmpOut)}, "w", encoding="utf-8") as f:
    json.dump(result, f)
`
      writeFileSync(tmpPy, script3, "utf8")
      const r3 = spawnSync("python3", [tmpPy], { timeout: 60_000, encoding: "utf8" })
      if (r3.status === 0 && !r3.error) {
        const d = JSON.parse(readFileSync(tmpOut, "utf8")) as { text: string; numPages: number }
        text = d.text; numPages = d.numPages
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

    return NextResponse.json({ numPages, isScanned, wordCount, estimatedUnits })
  } catch {
    const approxPages = Math.max(1, Math.ceil(buffer.byteLength / (150 * 1024)))
    return NextResponse.json({ numPages: approxPages, isScanned: true, wordCount: 0, estimatedUnits: approxPages * 40 })
  } finally {
    cleanup()
  }
}
