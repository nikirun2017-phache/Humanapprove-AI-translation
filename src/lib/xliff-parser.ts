import { XMLParser } from "fast-xml-parser"

export interface ParsedUnit {
  id: string
  sourceText: string
  targetText: string
  orderIndex: number
  metadata: Record<string, unknown>
}

export interface ParsedXliff {
  sourceLanguage: string
  targetLanguage: string
  units: ParsedUnit[]
  rawXml: string
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
  parseTagValue: true,
  trimValues: false,
  // Preserve text content
  cdataPropName: "__cdata",
})

function extractText(node: unknown): string {
  if (node === null || node === undefined) return ""
  if (typeof node === "string") return node
  if (typeof node === "number") return String(node)
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>
    // Handle <g>, <x/>, <bx/>, <ex/> inline elements by extracting text
    if (obj["__cdata"]) return String(obj["__cdata"])
    if (obj["#text"]) return String(obj["#text"])
    // Collect text from known inline elements
    const parts: string[] = []
    for (const [key, val] of Object.entries(obj)) {
      if (key.startsWith("@_")) continue
      if (key === "g" || key === "ph" || key === "bpt" || key === "ept") {
        if (Array.isArray(val)) {
          parts.push(...val.map(extractText))
        } else {
          parts.push(extractText(val))
        }
      }
    }
    if (parts.length) return parts.join("")
  }
  return String(node)
}

export function parseXliff(xmlContent: string): ParsedXliff {
  const parsed = parser.parse(xmlContent)

  // Support XLIFF 1.2 and basic 2.0
  const xliff = parsed["xliff"]
  if (!xliff) throw new Error("Not a valid XLIFF file: missing <xliff> root element")

  // Normalise to array — XLIFF files can have multiple <file> elements
  // (e.g. Articulate Rise 360 exports one <file> per module/lesson)
  let fileEls = xliff["file"]
  if (!fileEls) throw new Error("No <file> element found in XLIFF")
  if (!Array.isArray(fileEls)) fileEls = [fileEls]

  // Language info comes from the first <file> element
  const firstFile = fileEls[0] as Record<string, unknown>
  const sourceLanguage: string =
    (firstFile["@_source-language"] as string) ||
    (xliff["@_srcLang"] as string) ||
    (xliff["@_source-language"] as string) ||
    "en"
  const targetLanguage: string =
    (firstFile["@_target-language"] as string) ||
    (xliff["@_trgLang"] as string) ||
    (xliff["@_target-language"] as string) ||
    "und"

  // Collect trans-units from ALL <file> elements
  let transUnits: unknown[] = []

  for (const fileEl of fileEls as Record<string, unknown>[]) {
    // XLIFF 1.x path: file > body > trans-unit / group
    const body = fileEl["body"]
    if (body) {
      let tu = (body as Record<string, unknown>)["trans-unit"] ||
               (body as Record<string, unknown>)["group"]
      if (!tu) tu = []
      if (!Array.isArray(tu)) tu = [tu]
      transUnits = transUnits.concat(flattenGroups(tu as unknown[]))
    }

    // XLIFF 2.0 path: file > unit
    if (!body) {
      let unit = fileEl["unit"] || []
      if (!Array.isArray(unit)) unit = [unit]
      transUnits = transUnits.concat(unit as unknown[])
    }
  }

  // Track duplicate IDs — Rise 360 reuses short IDs like "title" across <file> elements
  const seenIds = new Map<string, number>()

  const units: ParsedUnit[] = transUnits
    .map((tu, index) => {
      const unit = tu as Record<string, unknown>
      const rawId = String(unit["@_id"] || `unit-${index + 1}`)
      const count = seenIds.get(rawId) ?? 0
      seenIds.set(rawId, count + 1)
      const id = count === 0 ? rawId : `${rawId}__dup${count + 1}`

      let sourceText = ""
      let targetText = ""

      // XLIFF 1.x: <source> and <target>
      if (unit["source"] !== undefined) {
        sourceText = extractText(unit["source"])
      }
      if (unit["target"] !== undefined) {
        targetText = extractText(unit["target"])
      }

      // XLIFF 2.0: <segment> > <source> / <target>
      if (!sourceText && unit["segment"]) {
        const seg = unit["segment"] as Record<string, unknown>
        sourceText = extractText(seg["source"])
        targetText = extractText(seg["target"])
      }

      // Collect metadata (all attrs except @_id)
      const metadata: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(unit)) {
        if (k.startsWith("@_") && k !== "@_id") {
          metadata[k.slice(2)] = v
        }
      }

      return {
        id,
        sourceText: sourceText.trim(),
        targetText: targetText.trim(),
        orderIndex: index,
        metadata,
      }
    })
    .filter((u) => u.sourceText.length > 0)

  return {
    sourceLanguage,
    targetLanguage,
    units,
    rawXml: xmlContent,
  }
}

/**
 * Extract the raw inner XML of each <source> element, keyed by trans-unit ID.
 * Preserves inline XLIFF elements (<g>, <x/>, <ph>, etc.) so they can be sent
 * to the AI for translation and later injected into <target> intact.
 * Used for XLIFF source files that must round-trip through authoring tools
 * like Articulate Rise 360 which require the original tag structure.
 */
export function extractRawSourceUnits(xmlContent: string): Map<string, string> {
  const map = new Map<string, string>()
  const seenIds = new Map<string, number>()
  const transUnitRegex = /<trans-unit\b([^>]*)>([\s\S]*?)<\/trans-unit>/g
  let match
  while ((match = transUnitRegex.exec(xmlContent)) !== null) {
    const attrs = match[1]
    const body = match[2]
    const idMatch = attrs.match(/\bid="([^"]*)"/)
    if (!idMatch) continue
    const rawId = idMatch[1]
    const count = seenIds.get(rawId) ?? 0
    seenIds.set(rawId, count + 1)
    // Suffix duplicate IDs so each unit has a unique key — Rise 360 reuses
    // short IDs like "title" across multiple <file> elements in one XLIFF.
    const id = count === 0 ? rawId : `${rawId}__dup${count + 1}`
    const sourceMatch = body.match(/<source[^>]*>([\s\S]*?)<\/source>/)
    if (sourceMatch) {
      map.set(id, sourceMatch[1].trim())
    }
  }
  return map
}

function flattenGroups(items: unknown[]): unknown[] {
  const result: unknown[] = []
  for (const item of items) {
    const obj = item as Record<string, unknown>
    // If it looks like a trans-unit (has source), add it
    if (obj["source"] !== undefined || obj["segment"] !== undefined) {
      result.push(item)
    } else if (obj["trans-unit"]) {
      // It's a group
      let nested = obj["trans-unit"]
      if (!Array.isArray(nested)) nested = [nested]
      result.push(...flattenGroups(nested as unknown[]))
    }
  }
  return result
}
