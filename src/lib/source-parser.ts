export interface SourceUnit {
  id: string
  /** Plain text (all XML tags stripped). Used for non-XLIFF files and as a
   *  fallback display string. For XLIFF units that contain inline tags, the
   *  AI receives individual text nodes via textNodes instead. */
  sourceText: string
  /** Verbatim inner XML of the <source> element, including inline <g>/<ph>/
   *  <bpt>/<ept> elements. Present only for XLIFF units that contain tags.
   *  Used by mergeTranslationsIntoXliff to reconstruct the tag structure in
   *  the <target> element after translation. */
  rawSourceXml?: string
  /** Decoded leaf text nodes extracted from rawSourceXml, in document order.
   *  Each entry is sent to the AI as a separate sub-unit (id__t0, id__t1, …)
   *  so translations can be stitched back into the tag skeleton. */
  textNodes?: string[]
  /** True for units that represent an image in the source PDF. These are
   *  never sent to the AI — they are rendered as gray placeholder boxes in
   *  the translated PDF to indicate where an image appeared in the original. */
  isImagePlaceholder?: boolean
}

/**
 * Parse a source-only (or partially translated) XLIFF file into translation units.
 * Only units where <target> is empty or missing are returned — already-translated
 * units are skipped so users can complete partial translations.
 */
export function parseXliffSource(content: string): {
  units: SourceUnit[]
  sourceLanguage: string
  suggestedTargetLanguage: string
} {
  // Lazy-import to avoid circular dependency issues at module load time
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { parseXliff, extractRawSourceUnits } = require("@/lib/xliff-parser") as typeof import("@/lib/xliff-parser")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { hasInlineXmlTags, extractXmlTextNodes } = require("@/lib/xml-utils") as typeof import("@/lib/xml-utils")
  const parsed = parseXliff(content)

  // extractRawSourceUnits uses regex to pull the verbatim inner XML of every
  // <source> element. This is authoritative: fast-xml-parser silently drops units
  // whose <source> contains deeply-nested or namespace-prefixed elements (e.g.
  // xmlns:xhtml on <g> tags), so we cannot use parsed.units as the unit list.
  const rawUnits = extractRawSourceUnits(content)

  // Detect units that already have a non-empty <target> via raw regex.
  // This handles the same namespaced-XML edge-cases that fxp misses.
  const translatedIdSet = new Set<string>(
    parsed.units.filter((u: (typeof parsed.units)[number]) => u.targetText?.trim()).map((u: (typeof parsed.units)[number]) => u.id)
  )
  const tuRegex = /<trans-unit\b([^>]*)>([\s\S]*?)<\/trans-unit>/g
  let tuMatch: RegExpExecArray | null
  while ((tuMatch = tuRegex.exec(content)) !== null) {
    const idM = tuMatch[1].match(/\bid="([^"]*)"/)
    if (idM && /<target\b[^>]*>[\s\S]*?<\/target>/.test(tuMatch[2])) {
      translatedIdSet.add(idM[1])
    }
  }

  // Build the unit list from rawUnits so every unit — including those with
  // deeply-nested/namespaced XML that fxp dropped — is included.
  const units: SourceUnit[] = []
  for (const [id, rawXml] of rawUnits) {
    if (translatedIdSet.has(id)) continue
    const plainText = rawXml
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
    if (!plainText) continue

    const unit: SourceUnit = { id, sourceText: plainText }

    // For units with inline XML tags (e.g. <g ctype="x-html-LI">), store the
    // raw source XML and extract individual text nodes. These are used during
    // translation (as __t0, __t1, … sub-units) and during XLIFF merge to
    // reconstruct the full tag structure in the <target> element.
    if (hasInlineXmlTags(rawXml)) {
      const nodes = extractXmlTextNodes(rawXml)
      if (nodes.length > 0) {
        unit.rawSourceXml = rawXml
        unit.textNodes = nodes
      }
    }

    units.push(unit)
  }

  return {
    units,
    sourceLanguage: parsed.sourceLanguage || "en-US",
    suggestedTargetLanguage: parsed.targetLanguage || "",
  }
}

// Minimum average words per page to consider a PDF "text-based" (not scanned).
// Word-splitting is unreliable for CJK languages (no spaces), so we also check
// character density: MIN_CHARS_PER_PAGE ≈ MIN_WORDS_PER_PAGE × 5 chars/word.
const MIN_WORDS_PER_PAGE = 15
const MIN_CHARS_PER_PAGE = 75 // ~15 words × 5 chars — language-agnostic fallback

/** Returns true if extracted text is dense enough to be a real text-based PDF. */
function isTextDense(text: string, numPages: number): boolean {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  const charCount = text.replace(/\s+/g, "").length
  const pages = Math.max(1, numPages)
  return wordCount / pages >= MIN_WORDS_PER_PAGE || charCount / pages >= MIN_CHARS_PER_PAGE
}

/**
 * Count PDF pages from raw bytes.
 *
 * Two strategies in order of preference:
 *  1. /Count N  — in the Pages tree node (visible for PDFs with uncompressed
 *                 cross-reference tables, i.e. most PDF ≤ 1.4).
 *  2. /Type /Page — count individual page objects (works for some PDF 1.5+
 *                 files where /Count is inside a compressed XRef stream but
 *                 individual page objects are still in uncompressed streams).
 *
 * Returns 0 when both strategies fail (e.g. fully compressed PDF 1.5+ with
 * object streams). parsePdfWithClaude handles this by extracting without a
 * page-range restriction rather than defaulting to "page 1 only".
 */
function countPagesFromRaw(buffer: Buffer): number {
  try {
    const raw = buffer.toString("latin1")

    // Strategy 1: /Count N  (Pages tree root has the highest count)
    const counts: number[] = []
    const countRe = /\/Count\s+(\d+)/g
    let m: RegExpExecArray | null
    while ((m = countRe.exec(raw)) !== null) {
      const n = parseInt(m[1], 10)
      if (n > 0) counts.push(n)
    }
    if (counts.length > 0) return Math.max(...counts)

    // Strategy 2: count /Type /Page objects (not /Pages, which is the parent node)
    // Uses a word-boundary check to skip /Type /Pages
    let pageCount = 0
    const pageRe = /\/Type\s*\/Page(?!s\b)/g
    while (pageRe.exec(raw) !== null) pageCount++
    if (pageCount > 0) return pageCount

    return 0
  } catch {
    return 0
  }
}

/**
 * Write buffer to a temp file and return its path.
 * Caller is responsible for cleanup via cleanupFiles().
 */
function writeTempFile(data: Buffer | string, suffix: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join } = require("path") as typeof import("path")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { tmpdir } = require("os") as typeof import("os")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomBytes } = require("crypto") as typeof import("crypto")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { writeFileSync } = require("fs") as typeof import("fs")
  const id = randomBytes(8).toString("hex")
  const p = join(tmpdir(), `jendee_${id}${suffix}`)
  writeFileSync(p, data)
  return p
}

function cleanupFiles(...paths: string[]): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { unlinkSync, existsSync } = require("fs") as typeof import("fs")
  for (const p of paths) {
    try { if (existsSync(p)) unlinkSync(p) } catch { /* ignore */ }
  }
}

export interface PdfParseResult {
  units: SourceUnit[]
  sourceMarkdown: string | null
}

/**
 * Extract translatable text from a PDF using a 4-strategy cascade:
 *
 * Strategy 1 — pdftotext CLI (poppler-utils, fastest):
 *   Runs `pdftotext -layout` on the file. Preserves column layout better than
 *   pdf-parse for multi-column documents. Output is written to a temp file
 *   (never stdout) to avoid token consumption.
 *
 * Strategy 2 — pdfplumber (Python, layout + table aware):
 *   Calls a Python subprocess using pdfplumber, which uses pdfminer under the
 *   hood. Handles complex layouts, tables, and CJK fonts that pdftotext misses.
 *
 * Strategy 3 — pypdf (Python, lightweight fallback):
 *   Calls a Python subprocess using pypdf. Simpler than pdfplumber but handles
 *   a wider range of encoding variants when pdfplumber fails.
 *
 * Strategy 4 — Claude Vision (OCR, last resort):
 *   Used only when all text-extraction strategies fail or yield fewer than
 *   MIN_WORDS_PER_PAGE words per page (indicating a scanned / image PDF).
 *   Requires an Anthropic API key.
 *   Returns structured Markdown with headings/lists preserved.
 */
export async function parsePdfSource(buffer: Buffer, anthropicApiKey?: string): Promise<PdfParseResult> {
  const tmpPdf = writeTempFile(buffer, ".pdf")
  const tmpTxt = tmpPdf.replace(".pdf", ".txt")
  const tmpPy  = tmpPdf.replace(".pdf", ".py")
  const tmpOut = tmpPdf.replace(".pdf", ".json")

  // Accumulate the best page count seen across all text strategies.
  // Even when the extracted text is too sparse for a text-based translation,
  // the page count from pdftotext/pdfplumber is reliable and must be forwarded
  // to parsePdfWithClaude so it can chunk the Vision calls correctly.
  // Without this, countPagesFromRaw fails for PDF 1.5+ compressed XRef streams
  // and Vision is mistakenly told "extract ONLY pages 1 to 1".
  let knownPageCount = 0

  try {
    // ── Strategy 1: pdftotext CLI ────────────────────────────────────────────
    const s1 = tryPdftotext(tmpPdf, tmpTxt, buffer)
    if (s1) {
      if (s1.numPages > knownPageCount) knownPageCount = s1.numPages
      const units = segmentPdfText(s1.text)
      if (isTextDense(s1.text, s1.numPages) && units.length > 0) {
        return { units, sourceMarkdown: null }
      }
    }

    // ── Strategy 2: pdfplumber (Python) ──────────────────────────────────────
    const s2 = tryPdfplumber(tmpPdf, tmpPy, tmpOut)
    if (s2) {
      if (s2.numPages > knownPageCount) knownPageCount = s2.numPages
      const units = segmentPdfText(s2.text)
      if (isTextDense(s2.text, s2.numPages) && units.length > 0) {
        return { units, sourceMarkdown: null }
      }
    }

    // ── Strategy 3: pypdf (Python) ───────────────────────────────────────────
    const s3 = tryPypdf(tmpPdf, tmpPy, tmpOut)
    if (s3) {
      if (s3.numPages > knownPageCount) knownPageCount = s3.numPages
      const units = segmentPdfText(s3.text)
      if (isTextDense(s3.text, s3.numPages) && units.length > 0) {
        return { units, sourceMarkdown: null }
      }
    }

    // ── Strategy 4: Claude Vision (OCR) ─────────────────────────────────────
    if (!anthropicApiKey) {
      throw new Error(
        "This PDF appears to be scanned (no embedded text). An Anthropic API key is required to extract text via Vision."
      )
    }
    return parsePdfWithClaude(buffer, anthropicApiKey, knownPageCount)

  } finally {
    cleanupFiles(tmpPdf, tmpTxt, tmpPy, tmpOut)
  }
}

/**
 * Strategy 1: pdftotext -layout (poppler-utils).
 * Writes output to a temp file; reads it back. Returns null if pdftotext is
 * not installed or the command fails.
 */
function tryPdftotext(
  pdfPath: string,
  outPath: string,
  buffer: Buffer
): { text: string; numPages: number; wordCount: number } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { spawnSync } = require("child_process") as typeof import("child_process")
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require("fs") as typeof import("fs")

    const result = spawnSync("pdftotext", ["-layout", pdfPath, outPath], {
      timeout: 30_000,
      encoding: "utf8",
    })

    if (result.status !== 0 || result.error) return null

    const text = readFileSync(outPath, "utf8")
    // Form feeds delimit pages in pdftotext output
    const numPages = Math.max(1, (text.match(/\f/g) ?? []).length + 1, countPagesFromRaw(buffer))
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length
    return { text, numPages, wordCount }
  } catch {
    return null
  }
}

/**
 * Strategy 2: pdfplumber via Python subprocess.
 * Writes an inline Python script to a temp file, executes it, reads the plain-text
 * result from a second temp file. Uses a simple delimiter protocol instead of JSON
 * to avoid encoding edge-cases (null bytes, stray U+2028/U+2029, truncation) that
 * can corrupt JSON output from Chinese/CJK PDFs.
 * Returns null if Python or pdfplumber is not available.
 */
function tryPdfplumber(
  pdfPath: string,
  pyPath: string,
  outPath: string
): { text: string; numPages: number; wordCount: number } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { spawnSync } = require("child_process") as typeof import("child_process")
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { writeFileSync, readFileSync } = require("fs") as typeof import("fs")

    // Output format: first line is "PAGES:<N>", then "---TEXT---", then raw text.
    // Images detected on each page are inserted as __IMAGE_PLACEHOLDER__ markers
    // at their approximate vertical position (top-half vs bottom-half of page).
    const script = `
import sys, pdfplumber
IMAGE_MARKER = "__IMAGE_PLACEHOLDER__"
with pdfplumber.open(${JSON.stringify(pdfPath)}) as pdf:
    page_chunks = []
    for page in pdf.pages:
        text = page.extract_text() or ""
        images = [img for img in (page.images or [])
                  if img.get("width", 0) > 20 and img.get("height", 0) > 20]
        if not images:
            page_chunks.append(text)
            continue
        # Split images into top-half and bottom-half by vertical position
        top_imgs = [img for img in images if (img.get("top", 0) / max(page.height, 1)) < 0.5]
        bot_imgs = [img for img in images if (img.get("top", 0) / max(page.height, 1)) >= 0.5]
        parts = []
        for _ in top_imgs:
            parts.append(IMAGE_MARKER)
        if text.strip():
            parts.append(text)
        for _ in bot_imgs:
            parts.append(IMAGE_MARKER)
        page_chunks.append("\\n\\n".join(parts))
    num_pages = len(pdf.pages)
    full_text = "\\f".join(page_chunks)
with open(${JSON.stringify(outPath)}, "w", encoding="utf-8", errors="replace") as f:
    f.write("PAGES:" + str(num_pages) + "\\n")
    f.write("---TEXT---\\n")
    f.write(full_text)
`
    writeFileSync(pyPath, script, "utf8")

    const result = spawnSync("python3", [pyPath], { timeout: 60_000, encoding: "utf8" })
    if (result.status !== 0 || result.error) return null

    const raw = readFileSync(outPath, "utf8")
    const sep = raw.indexOf("\n---TEXT---\n")
    if (sep === -1) return null
    const numPages = parseInt(raw.slice("PAGES:".length, sep), 10) || 1
    const text = raw.slice(sep + "\n---TEXT---\n".length)
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length
    return { text, numPages, wordCount }
  } catch {
    return null
  }
}

/**
 * Strategy 3: pypdf via Python subprocess.
 * Same pattern as pdfplumber but uses the lighter-weight pypdf library.
 * Uses the same plain-text delimiter protocol as tryPdfplumber to avoid JSON
 * encoding issues with CJK/special-character content.
 */
function tryPypdf(
  pdfPath: string,
  pyPath: string,
  outPath: string
): { text: string; numPages: number; wordCount: number } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { spawnSync } = require("child_process") as typeof import("child_process")
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { writeFileSync, readFileSync } = require("fs") as typeof import("fs")

    const script = `
import sys
from pypdf import PdfReader
reader = PdfReader(${JSON.stringify(pdfPath)})
pages = [page.extract_text() or "" for page in reader.pages]
num_pages = len(reader.pages)
text = "\\f".join(pages)
with open(${JSON.stringify(outPath)}, "w", encoding="utf-8", errors="replace") as f:
    f.write("PAGES:" + str(num_pages) + "\\n")
    f.write("---TEXT---\\n")
    f.write(text)
`
    writeFileSync(pyPath, script, "utf8")

    const result = spawnSync("python3", [pyPath], { timeout: 60_000, encoding: "utf8" })
    if (result.status !== 0 || result.error) return null

    const raw = readFileSync(outPath, "utf8")
    const sep = raw.indexOf("\n---TEXT---\n")
    if (sep === -1) return null
    const numPages = parseInt(raw.slice("PAGES:".length, sep), 10) || 1
    const text = raw.slice(sep + "\n---TEXT---\n".length)
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length
    return { text, numPages, wordCount }
  } catch {
    return null
  }
}

// Paragraphs longer than this word count are split further into sentences.
const MAX_SEGMENT_WORDS = 40

/**
 * Segment raw PDF text into reviewer-friendly translation units.
 *
 * Two-pass approach:
 *   1. Split on paragraph breaks (\n\n and \f form feeds).
 *   2. For blocks that exceed MAX_SEGMENT_WORDS, split further at sentence
 *      boundaries (. / ? / ! followed by whitespace + uppercase letter).
 *      This keeps legal paragraphs, long waiver text, and multi-sentence
 *      blocks at a manageable size for reviewers without breaking mid-sentence.
 *
 * Safe from false splits on:
 *   - Decimal numbers  ($242.50 — digit after dot, not uppercase)
 *   - Domain names     (cityofirvine.org — lowercase after dot)
 *   - Abbreviations    (e.g., vs. — lowercase after dot)
 */
function segmentPdfText(rawText: string): SourceUnit[] {
  const units: SourceUnit[] = []
  let index = 0

  // Normalise: treat form feeds as paragraph breaks
  const normalised = rawText.replace(/\f/g, "\n\n")

  // Split on double+ newlines to get paragraph blocks
  const blocks = normalised
    .split(/\n{2,}/)
    .map((b: string) => b.replace(/\n/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter(Boolean)

  for (const block of blocks) {
    // Image placeholder — preserve as a special non-translatable unit
    if (block === "__IMAGE_PLACEHOLDER__") {
      units.push({ id: `p_${index++}`, sourceText: "__IMAGE_PLACEHOLDER__", isImagePlaceholder: true })
      continue
    }
    // Skip pure page numbers (isolated digit(s))
    if (/^\d{1,4}$/.test(block)) continue
    // Skip URLs
    if (/^https?:\/\/\S+$/.test(block)) continue
    // Skip very short noise fragments.
    // Use character count for CJK text (no spaces) and word count for Latin text.
    const wordCount = block.split(/\s+/).filter(Boolean).length
    const charCount = block.replace(/\s+/g, "").length
    if (wordCount < 3 && charCount < 10) continue

    // For long blocks, split further at sentence boundaries.
    // CJK text: use character count since words aren't space-separated.
    const isCjk = charCount > wordCount * 1.5 // most chars are non-space → CJK
    const isLong = isCjk ? charCount > MAX_SEGMENT_WORDS * 5 : wordCount > MAX_SEGMENT_WORDS
    const segments = isLong ? splitIntoSentences(block) : [block]

    for (const seg of segments) {
      const sChars = seg.replace(/\s+/g, "").length
      const sWords = seg.split(/\s+/).filter(Boolean).length
      if (sWords < 3 && sChars < 10) continue
      units.push({ id: `p_${index++}`, sourceText: seg })
    }
  }

  return units
}

/**
 * Split a long text block into individual sentences.
 *
 * Splits at [.!?] followed by whitespace and an uppercase letter (sentence start).
 * Short fragments caused by abbreviation false-positives (< 4 words) are
 * merged back into the preceding sentence.
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation for both Latin and CJK scripts:
  //   Latin: [.!?] followed by whitespace + uppercase letter
  //   CJK:   。！？ always mark a full sentence end (no lookahead needed)
  // Does NOT split Latin on: "$5.00" (digit), "e.g. the" (lowercase).
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z])|(?<=[。！？])/)
  const sentences: string[] = []
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const wc = trimmed.split(/\s+/).filter(Boolean).length
    const cc = trimmed.replace(/\s+/g, "").length
    // Merge very short Latin fragments (abbreviation artefacts like "U.S.") into previous
    if (sentences.length > 0 && wc < 4 && cc < 10) {
      sentences[sentences.length - 1] += " " + trimmed
    } else {
      sentences.push(trimmed)
    }
  }
  return sentences.length > 0 ? sentences : [text]
}

// Pages processed per Claude API call. Keeps output well within max_tokens.
const PDF_CHUNK_SIZE = 20

// Retry delays for Vision API calls (mirrors the translate route's withRetry).
// 429s from Claude typically clear within a minute, so three attempts with
// increasing back-off are enough for transient spikes.
const VISION_RETRY_DELAYS_MS = [15_000, 40_000, 65_000]

/** Call extractPdfChunk with automatic retry on 429 / transient errors. */
async function extractPdfChunkWithRetry(
  base64: string,
  anthropicApiKey: string,
  startPage: number,
  endPage: number,
): Promise<string> {
  let lastError: Error = new Error("Unknown error")
  for (let attempt = 0; attempt <= VISION_RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await extractPdfChunk(base64, anthropicApiKey, startPage, endPage)
    } catch (err) {
      lastError = err as Error
      const msg = lastError.message.toLowerCase()
      const isRateLimit = msg.includes("429") || msg.includes("rate_limit") || msg.includes("overload")
      const isTransient = isRateLimit || msg.includes("500") || msg.includes("503")
      if (!isTransient || attempt === VISION_RETRY_DELAYS_MS.length) break
      const delay = VISION_RETRY_DELAYS_MS[attempt]
      console.warn(`[pdf-extract] retry ${attempt + 1} after ${delay}ms — ${lastError.message.slice(0, 120)}`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastError
}

/**
 * Use Claude's native document API to extract text from scanned / image PDFs.
 * For large PDFs (> PDF_CHUNK_SIZE pages), the document is processed in chunks
 * of PDF_CHUNK_SIZE pages each to avoid hitting output token limits.
 * Returns structured Markdown with headings/lists preserved, plus parsed units.
 *
 * @param knownPageCount  Reliable page count from pdftotext/pdfplumber (0 = unknown).
 *   When 0, countPagesFromRaw is tried as a fallback.  If that also returns 0
 *   the PDF is extracted without a page-range restriction so Vision processes
 *   the whole document rather than being told "extract ONLY pages 1 to 1".
 */
async function parsePdfWithClaude(
  buffer: Buffer,
  anthropicApiKey: string,
  knownPageCount = 0,
): Promise<PdfParseResult> {
  // Anthropic's document API limit is 32 MB (decoded file size).
  // Reject here with a user-friendly message rather than letting the API
  // return a cryptic 400/413 error deep inside the extraction loop.
  const MAX_PDF_BYTES = 32 * 1024 * 1024
  if (buffer.length > MAX_PDF_BYTES) {
    const mb = (buffer.length / 1024 / 1024).toFixed(1)
    throw new Error(
      `PDF is too large for Vision-based extraction (${mb} MB; limit is 32 MB). ` +
      `Please reduce the file size — for example by compressing images — and re-upload.`
    )
  }

  // Prefer the page count supplied by pdftotext/pdfplumber (most reliable).
  // Fall back to raw-byte scan for PDFs without compressed XRef streams.
  // If both return 0, set totalPages = 0 to signal "unknown".
  const totalPages = knownPageCount > 1 ? knownPageCount : countPagesFromRaw(buffer)

  const base64 = buffer.toString("base64")
  const chunkMarkdowns: string[] = []

  if (totalPages < 2) {
    // Page count could not be determined (compressed PDF 1.5+ with object streams,
    // or a genuine 1-page document). Extract without a page-range restriction so
    // Vision processes the whole PDF instead of only page 1.
    // NOTE: output may be truncated at ~max_tokens for very large PDFs,
    // but this always produces far more content than "pages 1 to 1".
    console.warn(`[pdf-extract] page count unknown (raw=${totalPages}) — extracting full PDF without range restriction`)
    const md = await extractPdfChunkWithRetry(base64, anthropicApiKey, 0, 0)
    chunkMarkdowns.push(md)
  } else {
    // Known page count — process in PDF_CHUNK_SIZE-page windows.
    for (let startPage = 1; startPage <= totalPages; startPage += PDF_CHUNK_SIZE) {
      const endPage = Math.min(startPage + PDF_CHUNK_SIZE - 1, totalPages)
      const md = await extractPdfChunkWithRetry(base64, anthropicApiKey, startPage, endPage)
      chunkMarkdowns.push(md)
    }
  }

  const sourceMarkdown = chunkMarkdowns.join("\n\n")
  const units = parseMarkdownSource(sourceMarkdown)
  return { units, sourceMarkdown }
}

/**
 * Call Claude Vision to extract text from a specific page range of a PDF.
 * The full PDF is sent but Claude is instructed to focus only on the given pages,
 * keeping each chunk's output within max_tokens.
 *
 * @param startPage  First page to extract (1-based). Pass 0 to extract all pages.
 * @param endPage    Last page to extract (inclusive). Pass 0 to extract all pages.
 */
async function extractPdfChunk(
  base64: string,
  anthropicApiKey: string,
  startPage: number,
  endPage: number,
): Promise<string> {
  // startPage=0 / endPage=0 means "no restriction — extract all pages".
  // This is used when the page count could not be determined from the PDF binary.
  const pageInstruction = startPage > 0 && endPage > 0
    ? `\nIMPORTANT: Extract text ONLY from pages ${startPage} to ${endPage}. Skip all other pages entirely.`
    : ""

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: `Extract all translatable text from this PDF document as a Markdown document.${pageInstruction}
Rules:
- Use # for main headings (company names, document titles)
- Use ## for section headings
- Use ### for sub-section headings
- Use - for list items and bullet points
- Tables: use simplified | col1 | col2 | format
- Regular paragraphs as plain text (no prefix)
- Skip page numbers, repeating headers/footers, URLs, purely numeric values, and decorative symbols
- Preserve the original text exactly including punctuation and casing
- For scanned pages, use your vision to read the text accurately
- Return ONLY the markdown text — no JSON, no code fences, no explanation`,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude PDF extraction failed (${response.status}): ${err}`)
  }

  const data = await response.json() as { content: { type: string; text: string }[] }
  const text = data.content.find((c: { type: string; text: string }) => c.type === "text")?.text ?? ""

  if (!text.trim()) {
    throw new Error(`Could not extract text from PDF pages ${startPage}–${endPage} — empty response from Claude`)
  }

  return text
}

/**
 * Flatten a nested JSON object to dot-notation key paths.
 * { "a": { "b": "value" } } → { "a.b": "value" }
 */
function flattenJson(obj: unknown, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {}
  if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      const fullKey = prefix ? `${prefix}.${key}` : key
      if (typeof val === "string") {
        result[fullKey] = val
      } else if (typeof val === "object" && val !== null) {
        Object.assign(result, flattenJson(val, fullKey))
      }
    }
  } else if (Array.isArray(obj)) {
    // Array of { id, value } or { key, value } objects
    for (const item of obj) {
      if (typeof item === "object" && item !== null) {
        const entry = item as Record<string, unknown>
        const id = String(entry.id ?? entry.key ?? entry.name ?? "")
        const text = String(entry.value ?? entry.text ?? entry.source ?? "")
        if (id && text) result[id] = text
      }
    }
  }
  return result
}

export function parseJsonSource(content: string): SourceUnit[] {
  const parsed = JSON.parse(content) as unknown
  const flat = flattenJson(parsed)
  return Object.entries(flat).map(([id, sourceText]) => ({ id, sourceText }))
}

export function parseCsvSource(content: string): SourceUnit[] {
  const lines = content.split(/\r?\n/).filter((l: string) => l.trim())
  if (lines.length === 0) return []

  // Detect if first line is a header.
  // Use parseCsvLine for correct handling of quoted fields.
  // Treat first row as a header if any cell matches a common header label OR if
  // all cells look like short identifiers (no whitespace) — typical of header rows.
  // This handles headers like "source,english", "key,text", "phrase,translation", etc.
  // In practice, virtually all real-world CSVs include a header row.
  const firstCols = parseCsvLine(lines[0]).map((c: string) => c.trim().toLowerCase().replace(/^"|"$/g, ""))
  const KNOWN_HEADER_NAMES = new Set([
    "id", "key", "name", "source", "target", "text", "string", "message",
    "english", "phrase", "label", "identifier", "token", "original",
    "segment", "content", "translation", "value", "term", "word",
  ])
  const hasHeader = lines.length > 1 && (
    firstCols.some((c: string) => KNOWN_HEADER_NAMES.has(c)) ||
    firstCols.every((c: string) => c.length > 0 && !/\s/.test(c))
  )
  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines
    .map((line: string) => {
      // Basic CSV split — handles quoted fields with embedded commas
      const cols = parseCsvLine(line)
      const id = cols[0]?.trim().replace(/^"|"$/g, "")
      const sourceText = cols[1]?.trim().replace(/^"|"$/g, "")
      if (!id || !sourceText) return null
      return { id, sourceText }
    })
    .filter((u): u is SourceUnit => u !== null)
}

/**
 * Parse a CSV file returning all columns.
 * The first row is always treated as a header row.
 * Used for multi-column CSV translation where passthrough columns must be preserved.
 */
export function parseCsvFull(content: string): { headers: string[]; rows: Array<string[]> } {
  const lines = content.split(/\r?\n/).filter((l: string) => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }

  // Always treat the first row as headers. parseCsvFull is only invoked in the
  // multi-column selection flow, where the user has already seen and configured
  // column names from the header row in the UI — regardless of what the first
  // column is named (e.g. "source_key", "token", "label", etc.).
  const headers = parseCsvLine(lines[0]).map((c: string) => c.trim().replace(/^"|"$/g, ""))
  const rows = lines.slice(1)
    .map((line: string) => parseCsvLine(line).map((c: string) => c.trim().replace(/^"|"$/g, "")))
    .filter((row: string[]) => row.some((c: string) => c))

  return { headers, rows }
}

/**
 * Parse a CSV with explicit column selection.
 * Creates one unit per row per selected column, with ID: `{rowKey}__COL__{colName}`.
 * The first column is always the row key and is never translated.
 * Falls back to parseCsvSource() if translateColumns is empty.
 */
export function parseCsvSourceWithColumns(content: string, translateColumns: string[]): SourceUnit[] {
  if (translateColumns.length === 0) return parseCsvSource(content)

  const { headers, rows } = parseCsvFull(content)
  const units: SourceUnit[] = []

  for (const row of rows) {
    const rowKey = row[0] ?? ""
    if (!rowKey) continue

    for (const colName of translateColumns) {
      const colIdx = headers.indexOf(colName)
      if (colIdx <= 0) continue  // skip unknown or ID column (index 0)
      const text = row[colIdx] ?? ""
      if (!text) continue
      units.push({ id: `${rowKey}__COL__${colName}`, sourceText: text })
    }
  }

  return units
}

/**
 * Parse a Markdown file into translatable units.
 * Fenced code blocks (``` ... ```) and indented code blocks are skipped.
 * Each heading, paragraph, and list item becomes one unit.
 * IDs encode position and type so the structure can be reconstructed later.
 */
export function parseMarkdownSource(content: string): SourceUnit[] {
  const units: SourceUnit[] = []
  let index = 0
  let inFencedBlock = false

  const lines = content.split(/\r?\n/)
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Toggle fenced code block
    if (/^```/.test(line) || /^~~~/.test(line)) {
      inFencedBlock = !inFencedBlock
      i++
      continue
    }

    if (inFencedBlock) {
      i++
      continue
    }

    // Skip indented code blocks (4+ spaces or tab at start)
    if (/^( {4}|\t)/.test(line)) {
      i++
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const text = headingMatch[2].trim()
      if (text) {
        units.push({ id: `h${headingMatch[1].length}_${index++}`, sourceText: text })
      }
      i++
      continue
    }

    // List item (unordered or ordered)
    const listMatch = line.match(/^(\s*(?:[-*+]|\d+\.)\s+)(.+)$/)
    if (listMatch) {
      const text = listMatch[2].trim()
      if (text) {
        units.push({ id: `li_${index++}`, sourceText: text })
      }
      i++
      continue
    }

    // Blank line — skip
    if (line.trim() === "") {
      i++
      continue
    }

    // Paragraph: collect consecutive non-blank, non-special lines
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^```/.test(lines[i]) &&
      !/^~~~/.test(lines[i]) &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^(\s*(?:[-*+]|\d+\.)\s+)/.test(lines[i]) &&
      !/^( {4}|\t)/.test(lines[i])
    ) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length > 0) {
      const text = paraLines.join(" ").trim()
      if (text) {
        units.push({ id: `p_${index++}`, sourceText: text })
      }
    }
  }

  return units
}

// ── .docx (Microsoft Word) ───────────────────────────────────────────────────

/**
 * Extract translatable paragraphs from a DOCX file, preserving structure.
 *
 * Strategy: DOCX is a ZIP containing XML files. We unzip it with jszip,
 * parse word/document.xml (and optional headers/footers) to find <w:p>
 * paragraph elements, concatenate their <w:t> text runs, and return one
 * SourceUnit per non-empty paragraph.
 *
 * Images and drawings (<w:drawing>) are left in place untouched — the export
 * step preserves all non-text content from the original ZIP.
 *
 * Unit IDs encode the source part and paragraph index so the exporter can
 * apply translations back to the exact same positions:
 *   doc_p_0, doc_p_1, …  → word/document.xml paragraphs
 *   hdr1_p_0, …          → word/header1.xml (odd-page header)
 *   ftr1_p_0, …          → word/footer1.xml (odd-page footer)
 */
export async function parseDocxSource(buffer: Buffer): Promise<SourceUnit[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const JSZip = require("jszip") as { loadAsync: (b: Buffer) => Promise<{ file: (name: string) => { async: (type: "string") => Promise<string> } | null }> }
  const zip = await JSZip.loadAsync(buffer)

  const units: SourceUnit[] = []

  const parts: Array<{ path: string; prefix: string }> = [
    { path: "word/document.xml", prefix: "doc" },
    { path: "word/header1.xml",  prefix: "hdr1" },
    { path: "word/header2.xml",  prefix: "hdr2" },
    { path: "word/header3.xml",  prefix: "hdr3" },
    { path: "word/footer1.xml",  prefix: "ftr1" },
    { path: "word/footer2.xml",  prefix: "ftr2" },
    { path: "word/footer3.xml",  prefix: "ftr3" },
  ]

  for (const { path, prefix } of parts) {
    const f = zip.file(path)
    if (!f) continue
    const xml = await f.async("string")
    const partUnits = extractDocxParagraphUnits(xml, prefix)
    units.push(...partUnits)
  }

  return units
}

/**
 * Extract translation units from a single DOCX XML part (document, header, footer).
 * Each non-empty paragraph becomes one unit. Paragraphs containing drawings/images
 * are skipped (they are preserved verbatim in the output DOCX).
 */
function extractDocxParagraphUnits(xml: string, prefix: string): SourceUnit[] {
  const units: SourceUnit[] = []
  let idx = 0

  // Match all <w:p ...>...</w:p> blocks (paragraphs are never nested in DOCX)
  const paraRe = /<w:p[ >][\s\S]*?<\/w:p>/g
  let m: RegExpExecArray | null

  while ((m = paraRe.exec(xml)) !== null) {
    const para = m[0]

    // Skip paragraphs that contain drawings or pictures — preserve them as-is
    if (/<w:drawing\b/.test(para) || /<pic:pic\b/.test(para)) continue

    // Concatenate all <w:t> text runs in this paragraph
    const textRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g
    let tm: RegExpExecArray | null
    let text = ""
    while ((tm = textRe.exec(para)) !== null) {
      text += decodeXmlEntities(tm[1])
    }
    text = text.trim()

    // Skip empty paragraphs and very short noise (single char, just punctuation, etc.)
    if (text.length < 2) continue

    units.push({ id: `${prefix}_p_${idx++}`, sourceText: text })
  }

  return units
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

// Plain text parser — splits on blank lines into paragraphs
export function parseTxtSource(content: string): SourceUnit[] {
  const units: SourceUnit[] = []
  let index = 0
  const paragraphs = content.split(/\r?\n\r?\n+/)
  for (const para of paragraphs) {
    const text = para.trim()
    if (text) {
      units.push({ id: `p_${index++}`, sourceText: text })
    }
  }
  // If no double-newline breaks, treat each non-empty line as a unit
  if (units.length <= 1 && content.includes("\n")) {
    units.length = 0
    index = 0
    for (const line of content.split(/\r?\n/)) {
      const text = line.trim()
      if (text) units.push({ id: `l_${index++}`, sourceText: text })
    }
  }
  return units
}

// ── .strings (Apple iOS / macOS) ─────────────────────────────────────────────

/**
 * Parse a .strings file into translation units.
 * Format: "key" = "value"; — supports escaped quotes and standard escape sequences.
 * Comments (/* ... *\/ and // ...) and blank lines are ignored.
 */
export function parseStringsSource(content: string): SourceUnit[] {
  const units: SourceUnit[] = []
  // Strip block and line comments, then match "key" = "value"; pairs
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
  const re = /"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*;/g
  let m: RegExpExecArray | null
  while ((m = re.exec(stripped)) !== null) {
    const id = m[1]
    const sourceText = m[2]
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
    if (sourceText.trim()) units.push({ id, sourceText })
  }
  return units
}

// ── .stringsdict (Apple plist XML plurals) ────────────────────────────────────

/**
 * Parse an Apple .stringsdict plist XML file.
 * Extracts user-facing plural form strings (zero/one/two/few/many/other).
 * Keys like NSStringLocalizedFormatKey and format specifiers are skipped.
 * Unit IDs: "{entryKey}__{pluralForm}" e.g. "home.tasks_count__one"
 */
export function parseStringsDictSource(content: string): SourceUnit[] {
  const PLURAL_FORMS = new Set(["zero", "one", "two", "few", "many", "other"])
  const units: SourceUnit[] = []

  // Strip XML/plist comments before tokenizing
  const stripped = content.replace(/<!--[\s\S]*?-->/g, "")

  // Tokenize into: open dict, close dict, <key>...</key>, <string>...</string>
  type Token = { type: "open" | "close" | "key" | "string"; value: string }
  const tokens: Token[] = []
  const tokenRe = /<dict\b[^>]*>|<\/dict>|<key>([\s\S]*?)<\/key>|<string>([\s\S]*?)<\/string>/g
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(stripped)) !== null) {
    if (m[0].startsWith("<dict")) tokens.push({ type: "open", value: "" })
    else if (m[0] === "</dict>") tokens.push({ type: "close", value: "" })
    else if (m[1] !== undefined) tokens.push({ type: "key", value: m[1] })
    else if (m[2] !== undefined) tokens.push({ type: "string", value: m[2] })
  }

  // Walk tokens tracking depth:
  //   depth 1 = inside root dict → entry keys
  //   depth 2 = inside entry dict → NSStringLocalizedFormatKey, var names
  //   depth 3 = inside var dict → NSStringFormat* keys + plural form keys
  let depth = 0
  let entryKey = ""
  let lastKey = ""

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.type === "open") { depth++; continue }
    if (t.type === "close") { depth--; continue }
    if (t.type === "key") {
      if (depth === 1) entryKey = t.value
      lastKey = t.value
      continue
    }
    if (t.type === "string" && depth === 3 && PLURAL_FORMS.has(lastKey) && entryKey) {
      const sourceText = t.value
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&quot;/g, '"')
      if (sourceText.trim()) units.push({ id: `${entryKey}__${lastKey}`, sourceText })
    }
  }

  return units
}

// ── .xcstrings (Xcode Strings Catalog JSON) ──────────────────────────────────

/**
 * Parse an Xcode Strings Catalog (.xcstrings) file.
 * Extracts source-language string values for translation.
 * IDs: "{key}" for simple strings, "{key}____plural__{form}" for plural variations.
 */
export function parseXcstringsSource(content: string): SourceUnit[] {
  type StringUnit = { state?: string; value?: string }
  type Variation = { stringUnit?: StringUnit }
  type Localization = {
    stringUnit?: StringUnit
    variations?: { plural?: Record<string, Variation> }
  }
  type XcstringsFile = {
    sourceLanguage?: string
    strings?: Record<string, { localizations?: Record<string, Localization> }>
  }

  const parsed = JSON.parse(content) as XcstringsFile
  const sourceLang = parsed.sourceLanguage ?? "en"
  const units: SourceUnit[] = []

  for (const [key, entry] of Object.entries(parsed.strings ?? {})) {
    const loc = entry.localizations?.[sourceLang]
    if (!loc) continue
    if (loc.stringUnit?.value?.trim()) {
      units.push({ id: key, sourceText: loc.stringUnit.value })
    } else if (loc.variations?.plural) {
      for (const [form, variation] of Object.entries(loc.variations.plural)) {
        const text = variation.stringUnit?.value
        if (text?.trim()) units.push({ id: `${key}____plural__${form}`, sourceText: text })
      }
    }
  }

  return units
}

// ── .po (GNU gettext) ─────────────────────────────────────────────────────────

/**
 * Parse a GNU gettext .po file into translation units.
 * Each msgid becomes one unit (simple) or two units per plural form (msgid + msgid_plural).
 * The header entry (msgid "") is skipped.
 * IDs: "po_{index}" for simple entries, "po_{index}__pl_0" / "po_{index}__pl_1" for plural.
 */
export function parsePoSource(content: string): SourceUnit[] {
  const units: SourceUnit[] = []
  let index = 0

  function unescape(s: string): string {
    return s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\")
  }

  // Split on blank lines to get entry blocks
  const blocks = content.split(/\n(?=\s*\n)/)
  for (const block of blocks) {
    const lines = block.split("\n")
    let msgid = ""
    let msgidPlural = ""
    let current: "none" | "msgid" | "msgid_plural" = "none"

    for (const line of lines) {
      if (line.startsWith("#")) continue
      const idMatch = line.match(/^msgid\s+"((?:[^"\\]|\\.)*)"/)
      const idPluralMatch = line.match(/^msgid_plural\s+"((?:[^"\\]|\\.)*)"/)
      const contMatch = line.match(/^"((?:[^"\\]|\\.)*)"/)

      if (idMatch) { msgid = idMatch[1]; current = "msgid" }
      else if (idPluralMatch) { msgidPlural = idPluralMatch[1]; current = "msgid_plural" }
      else if (line.startsWith("msgstr")) { current = "none" }
      else if (contMatch && current === "msgid") msgid += contMatch[1]
      else if (contMatch && current === "msgid_plural") msgidPlural += contMatch[1]
    }

    // Skip header entry
    if (!unescape(msgid).trim()) continue

    if (msgidPlural) {
      units.push({ id: `po_${index}__pl_0`, sourceText: unescape(msgid) })
      units.push({ id: `po_${index}__pl_1`, sourceText: unescape(msgidPlural) })
    } else {
      units.push({ id: `po_${index}`, sourceText: unescape(msgid) })
    }
    index++
  }

  return units
}

// ── .xml (Android strings.xml) ───────────────────────────────────────────────

/**
 * Parse an Android strings.xml resource file.
 * Handles <string>, <plurals><item quantity="...">, and <string-array><item>.
 * IDs: "{name}" for simple strings, "{name}__qty__{quantity}" for plurals,
 *      "{name}__arr__{index}" for string arrays.
 * Throws if the root element is not <resources>.
 */
export function parseAndroidXmlSource(content: string): SourceUnit[] {
  if (!/<resources[\s>]/.test(content)) {
    throw new Error("Not an Android strings XML file — expected <resources> root element")
  }

  function unescape(s: string): string {
    return s
      .replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t").replace(/\\\\/g, "\\")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&quot;/g, '"')
      .trim()
  }

  const units: SourceUnit[] = []

  // <string name="...">value</string>
  const stringRe = /<string\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/string>/g
  let m: RegExpExecArray | null
  while ((m = stringRe.exec(content)) !== null) {
    const text = unescape(m[2])
    if (text) units.push({ id: m[1], sourceText: text })
  }

  // <plurals name="..."><item quantity="...">value</item></plurals>
  const pluralsRe = /<plurals\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/plurals>/g
  while ((m = pluralsRe.exec(content)) !== null) {
    const pluralName = m[1]
    const inner = m[2]
    const itemRe = /<item\s+quantity="([^"]+)"[^>]*>([\s\S]*?)<\/item>/g
    let im: RegExpExecArray | null
    while ((im = itemRe.exec(inner)) !== null) {
      const text = unescape(im[2])
      if (text) units.push({ id: `${pluralName}__qty__${im[1]}`, sourceText: text })
    }
  }

  // <string-array name="..."><item>value</item></string-array>
  const arrayRe = /<string-array\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/string-array>/g
  while ((m = arrayRe.exec(content)) !== null) {
    const arrayName = m[1]
    const inner = m[2]
    const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/g
    let im: RegExpExecArray | null
    let idx = 0
    while ((im = itemRe.exec(inner)) !== null) {
      const text = unescape(im[1])
      if (text) units.push({ id: `${arrayName}__arr__${idx}`, sourceText: text })
      idx++
    }
  }

  return units
}

// ── .arb (Flutter ARB) ───────────────────────────────────────────────────────

/**
 * Parse a Flutter ARB (Application Resource Bundle) file.
 * Keys starting with "@" are metadata — skipped.
 * ID = the ARB key, sourceText = the string value.
 */
export function parseArbSource(content: string): SourceUnit[] {
  const parsed = JSON.parse(content) as Record<string, unknown>
  const units: SourceUnit[] = []
  for (const [key, value] of Object.entries(parsed)) {
    if (key.startsWith("@")) continue
    if (typeof value === "string" && value.trim()) {
      units.push({ id: key, sourceText: value })
    }
  }
  return units
}

// ── .properties (Java / Spring) ──────────────────────────────────────────────

/**
 * Parse a Java .properties file into translation units.
 * Supports key=value, key: value, and multi-line values (trailing \).
 * Comments (# and !) and blank lines are skipped.
 * Standard backslash escapes (\n \t \\ etc.) are decoded.
 */
export function parsePropertiesSource(content: string): SourceUnit[] {
  const units: SourceUnit[] = []
  const lines = content.split(/\r?\n/)

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // Skip blank lines and comments
    if (!line.trim() || /^\s*[#!]/.test(line)) { i++; continue }

    // Collect multi-line values
    let full = line
    while (full.trimEnd().endsWith("\\")) {
      full = full.trimEnd().slice(0, -1) + (lines[++i] ?? "").replace(/^\s+/, "")
    }

    const match = full.match(/^\s*([\w.\-/\\]+)\s*[=:]\s*(.*)$/)
    if (!match) { i++; continue }

    const id = match[1]
    const sourceText = match[2]
      .replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\r/g, "\r").replace(/\\\\/g, "\\")
    if (sourceText.trim()) units.push({ id, sourceText })
    i++
  }
  return units
}

function parseCsvLine(line: string): string[] {
  const cols: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === "," && !inQuotes) {
      cols.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  cols.push(current)
  return cols
}
