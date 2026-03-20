export interface SourceUnit {
  id: string
  sourceText: string
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
  const parsed = parseXliff(content)

  // extractRawSourceUnits uses regex to pull the verbatim inner XML of every
  // <source> element. This is authoritative: fast-xml-parser silently drops units
  // whose <source> contains deeply-nested or namespace-prefixed elements (e.g.
  // xmlns:xhtml on <g> tags), so we cannot use parsed.units as the unit list.
  const rawUnits = extractRawSourceUnits(content)

  // Detect units that already have a non-empty <target> via raw regex.
  // This handles the same namespaced-XML edge-cases that fxp misses.
  const translatedIdSet = new Set<string>(
    parsed.units.filter((u) => u.targetText?.trim()).map((u) => u.id)
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
    if (plainText) units.push({ id, sourceText: plainText })
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

/** Count PDF pages from raw bytes by scanning /Count entries in the page tree. */
function countPagesFromRaw(buffer: Buffer): number {
  try {
    const raw = buffer.toString("latin1")
    const counts: number[] = []
    const re = /\/Count\s+(\d+)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(raw)) !== null) counts.push(parseInt(m[1], 10))
    return counts.length > 0 ? Math.max(...counts) : 0
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
 */
export async function parsePdfSource(buffer: Buffer, anthropicApiKey?: string): Promise<SourceUnit[]> {
  const tmpPdf = writeTempFile(buffer, ".pdf")
  const tmpTxt = tmpPdf.replace(".pdf", ".txt")
  const tmpPy  = tmpPdf.replace(".pdf", ".py")
  const tmpOut = tmpPdf.replace(".pdf", ".json")

  try {
    // ── Strategy 1: pdftotext CLI ────────────────────────────────────────────
    const s1 = tryPdftotext(tmpPdf, tmpTxt, buffer)
    if (s1) {
      const units = segmentPdfText(s1.text)
      if (isTextDense(s1.text, s1.numPages) && units.length > 0) {
        return units
      }
    }

    // ── Strategy 2: pdfplumber (Python) ──────────────────────────────────────
    const s2 = tryPdfplumber(tmpPdf, tmpPy, tmpOut)
    if (s2) {
      const units = segmentPdfText(s2.text)
      if (isTextDense(s2.text, s2.numPages) && units.length > 0) {
        return units
      }
    }

    // ── Strategy 3: pypdf (Python) ───────────────────────────────────────────
    const s3 = tryPypdf(tmpPdf, tmpPy, tmpOut)
    if (s3) {
      const units = segmentPdfText(s3.text)
      if (isTextDense(s3.text, s3.numPages) && units.length > 0) {
        return units
      }
    }

    // ── Strategy 4: Claude Vision (OCR) ─────────────────────────────────────
    if (!anthropicApiKey) {
      throw new Error(
        "This PDF appears to be scanned (no embedded text). An Anthropic API key is required to extract text via Vision."
      )
    }
    return parsePdfWithClaude(buffer, anthropicApiKey)

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
 * Writes an inline Python script to a temp file, executes it, reads the JSON
 * result from a second temp file. Returns null if Python or pdfplumber is not
 * available.
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

    const script = `
import sys, json, pdfplumber
with pdfplumber.open(${JSON.stringify(pdfPath)}) as pdf:
    pages = [page.extract_text() or "" for page in pdf.pages]
    text = "\\f".join(pages)
    result = {"numPages": len(pdf.pages), "text": text}
with open(${JSON.stringify(outPath)}, "w", encoding="utf-8") as f:
    json.dump(result, f)
`
    writeFileSync(pyPath, script, "utf8")

    const result = spawnSync("python3", [pyPath], { timeout: 60_000, encoding: "utf8" })
    if (result.status !== 0 || result.error) return null

    const raw = JSON.parse(readFileSync(outPath, "utf8")) as { text: string; numPages: number }
    const wordCount = raw.text.trim().split(/\s+/).filter(Boolean).length
    return { text: raw.text, numPages: raw.numPages, wordCount }
  } catch {
    return null
  }
}

/**
 * Strategy 3: pypdf via Python subprocess.
 * Same pattern as pdfplumber but uses the lighter-weight pypdf library.
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
import sys, json
from pypdf import PdfReader
reader = PdfReader(${JSON.stringify(pdfPath)})
pages = [page.extract_text() or "" for page in reader.pages]
text = "\\f".join(pages)
result = {"numPages": len(reader.pages), "text": text}
with open(${JSON.stringify(outPath)}, "w", encoding="utf-8") as f:
    json.dump(result, f)
`
    writeFileSync(pyPath, script, "utf8")

    const result = spawnSync("python3", [pyPath], { timeout: 60_000, encoding: "utf8" })
    if (result.status !== 0 || result.error) return null

    const raw = JSON.parse(readFileSync(outPath, "utf8")) as { text: string; numPages: number }
    const wordCount = raw.text.trim().split(/\s+/).filter(Boolean).length
    return { text: raw.text, numPages: raw.numPages, wordCount }
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
    .map((b) => b.replace(/\n/g, " ").replace(/\s{2,}/g, " ").trim())
    .filter(Boolean)

  for (const block of blocks) {
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

/**
 * Use Claude's native document API to extract text from scanned / image PDFs.
 * For large PDFs (> PDF_CHUNK_SIZE pages), the document is processed in chunks
 * of PDF_CHUNK_SIZE pages each to avoid hitting output token limits.
 */
async function parsePdfWithClaude(buffer: Buffer, anthropicApiKey: string): Promise<SourceUnit[]> {
  // Get total page count from raw bytes (works for scanned PDFs with no text layer).
  const totalPages = Math.max(1, countPagesFromRaw(buffer))

  const base64 = buffer.toString("base64")
  const allUnits: SourceUnit[] = []
  let globalIndex = 0

  // Build page-range chunks: [[1,20], [21,40], [41,60], [61,62], …]
  for (let startPage = 1; startPage <= totalPages; startPage += PDF_CHUNK_SIZE) {
    const endPage = Math.min(startPage + PDF_CHUNK_SIZE - 1, totalPages)
    const chunkUnits = await extractPdfChunk(base64, anthropicApiKey, startPage, endPage, globalIndex)
    allUnits.push(...chunkUnits)
    globalIndex += chunkUnits.length
  }

  return allUnits
}

/**
 * Call Claude Vision to extract text from a specific page range of a PDF.
 * The full PDF is sent but Claude is instructed to focus only on the given pages,
 * keeping each chunk's output within max_tokens.
 */
async function extractPdfChunk(
  base64: string,
  anthropicApiKey: string,
  startPage: number,
  endPage: number,
  indexOffset: number
): Promise<SourceUnit[]> {
  const pageInstruction = `\nIMPORTANT: Extract text ONLY from pages ${startPage} to ${endPage}. Skip all other pages entirely.`

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
              text: `Extract all translatable text from this PDF document.${pageInstruction}
Return ONLY a valid JSON array where each element is: {"id": "p_N", "sourceText": "..."}
Rules:
- Each paragraph, heading, bullet point, list item, table cell, or caption is its own entry
- Number entries sequentially starting from p_${indexOffset}
- Skip page numbers, repeating headers/footers, URLs, purely numeric values, and decorative symbols
- Preserve the original text exactly including punctuation and casing
- For scanned pages, use your vision to read the text accurately
- Do not add any explanation or text outside the JSON array`,
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
  const text = data.content.find((c) => c.type === "text")?.text ?? ""

  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error(`Could not extract text from PDF pages ${startPage}–${endPage} — no JSON returned by Claude`)

  const units = JSON.parse(jsonMatch[0]) as { id: string; sourceText: string }[]
  return units.filter((u) => u.id && u.sourceText?.trim())
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
  const lines = content.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length === 0) return []

  // Detect if first line is a header (contains "id" or "key" as first field)
  const firstCols = lines[0].split(",").map((c) => c.trim().toLowerCase().replace(/"/g, ""))
  const hasHeader = firstCols[0] === "id" || firstCols[0] === "key" || firstCols[0] === "name"
  const dataLines = hasHeader ? lines.slice(1) : lines

  return dataLines
    .map((line) => {
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
