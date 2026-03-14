export interface SourceUnit {
  id: string
  sourceText: string
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
