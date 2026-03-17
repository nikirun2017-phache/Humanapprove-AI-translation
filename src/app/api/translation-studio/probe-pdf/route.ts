import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

const MIN_WORDS_PER_PAGE = 15

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

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
      buf: Buffer,
      opts?: object
    ) => Promise<{ text: string; numpages: number }>

    const data = await pdfParse(buffer, { max: 0 })
    // pdf-parse/PDF.js occasionally under-reports page count for non-standard page trees
    // (linearized PDFs, some scanner outputs). Cross-check with a raw-byte scan and take
    // the higher value.
    const rawPages = countPagesFromRaw(buffer)
    const numPages = Math.max(data.numpages, rawPages)
    const wordCount = data.text.trim().split(/\s+/).filter(Boolean).length
    const wordDensity = wordCount / Math.max(1, numPages)
    const isScanned = wordDensity < MIN_WORDS_PER_PAGE

    // Estimate translation units:
    // - Text-based: roughly 1 unit per paragraph, ~80 words/paragraph
    // - Scanned: ~40 short segments per page (Claude Vision segmentation)
    const estimatedUnits = isScanned
      ? numPages * 40
      : Math.max(1, Math.ceil(wordCount / 80))

    return NextResponse.json({ numPages, isScanned, wordCount, estimatedUnits })
  } catch {
    // If pdf-parse fails entirely (corrupt file etc.), return conservative scanned estimate.
    // Typical scanned PDFs average ~150 KB/page at 150 dpi.
    const approxPages = Math.max(1, Math.ceil(buffer.byteLength / (150 * 1024)))
    return NextResponse.json({
      numPages: approxPages,
      isScanned: true,
      wordCount: 0,
      estimatedUnits: approxPages * 40,
    })
  }
}
