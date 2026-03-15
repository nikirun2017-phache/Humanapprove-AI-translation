export interface SourceUnit {
  id: string
  sourceText: string
}

// Minimum average words per page to consider a PDF "text-based" (not scanned)
const MIN_WORDS_PER_PAGE = 15

/**
 * Extract translatable text from a PDF using a multi-strategy approach:
 *
 * Strategy 1 — pdf-parse (fast, free, no API cost):
 *   Tries to extract embedded text directly. Works for text-based PDFs,
 *   complex layouts from PPT exports, and PDFs with tables (text is preserved
 *   even if table formatting is lost — acceptable for translation).
 *   If the extracted text is dense enough (≥ MIN_WORDS_PER_PAGE words/page),
 *   we segment it into translation units and return immediately.
 *
 * Strategy 2 — Claude Vision (fallback for scanned / image PDFs):
 *   Used only when Strategy 1 yields too little text, indicating the PDF is
 *   a scanned image or has no embedded text layer. Claude's vision model reads
 *   each page like a human, handling handwriting, stamps, and complex layouts.
 *   Requires an Anthropic API key.
 */
export async function parsePdfSource(buffer: Buffer, anthropicApiKey?: string): Promise<SourceUnit[]> {
  // ── Strategy 1: Fast embedded text extraction ─────────────────────────────
  const extracted = await tryExtractPdfText(buffer)

  if (extracted) {
    const wordDensity = extracted.wordCount / Math.max(1, extracted.numPages)
    if (wordDensity >= MIN_WORDS_PER_PAGE) {
      const units = segmentPdfText(extracted.text)
      if (units.length > 0) return units
    }
  }

  // ── Strategy 2: Claude Vision for scanned / image PDFs ────────────────────
  if (!anthropicApiKey) {
    throw new Error(
      "This PDF appears to be scanned (no embedded text). An Anthropic API key is required to extract text via Vision."
    )
  }
  return parsePdfWithClaude(buffer, anthropicApiKey)
}

/**
 * Attempt to extract raw text from a PDF without any API call.
 * Uses pdf-parse (based on PDF.js) which handles embedded fonts, encoding
 * variants, and CID fonts. Returns null if extraction fails entirely.
 */
async function tryExtractPdfText(
  buffer: Buffer
): Promise<{ text: string; numPages: number; wordCount: number } | null> {
  try {
    // Import via the lib path to bypass pdf-parse's test-file auto-loader
    // (avoids a Next.js/webpack warning about missing test fixtures)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
      buf: Buffer,
      opts?: object
    ) => Promise<{ text: string; numpages: number }>

    const data = await pdfParse(buffer, { max: 0 }) // max:0 = all pages
    const wordCount = data.text.trim().split(/\s+/).filter(Boolean).length
    return { text: data.text, numPages: data.numpages, wordCount }
  } catch {
    return null
  }
}

/**
 * Segment raw PDF text (from pdf-parse) into translation units.
 *
 * PDF text output typically uses:
 *   - Form-feed character (\f) as page break
 *   - Double newline (\n\n) as paragraph break
 *   - Single newline (\n) as line wrap within a paragraph
 *
 * For tables: pdf-parse linearises table cells as whitespace-separated text.
 * We preserve each row block as a single unit — good enough for translation.
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
    // Skip very short noise fragments (< 3 words)
    const words = block.split(/\s+/).filter(Boolean)
    if (words.length < 3) continue

    units.push({ id: `p_${index++}`, sourceText: block })
  }

  return units
}

/**
 * Use Claude's native document API to extract text from scanned / image PDFs.
 * Claude applies vision to each page and returns semantically segmented units.
 */
async function parsePdfWithClaude(buffer: Buffer, anthropicApiKey: string): Promise<SourceUnit[]> {
  const base64 = buffer.toString("base64")

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
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
              text: `Extract all translatable text from this PDF document.
Return ONLY a valid JSON array where each element is: {"id": "p_N", "sourceText": "..."}
Rules:
- Each paragraph, heading, bullet point, list item, table cell, or caption is its own entry
- Number entries sequentially starting from p_0
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
  if (!jsonMatch) throw new Error("Could not extract text from PDF — no JSON returned by Claude")

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
