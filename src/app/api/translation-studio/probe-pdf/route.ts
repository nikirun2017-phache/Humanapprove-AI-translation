import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

const MIN_WORDS_PER_PAGE = 15

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
    const numPages = data.numpages
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
    // If pdf-parse fails entirely (corrupt file etc.), return conservative scanned estimate
    const approxPages = Math.max(1, Math.ceil(buffer.byteLength / (400 * 1024)))
    return NextResponse.json({
      numPages: approxPages,
      isScanned: true,
      wordCount: 0,
      estimatedUnits: approxPages * 40,
    })
  }
}
