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

  // Extract language info from <file> element
  let fileEl = xliff["file"]
  if (Array.isArray(fileEl)) fileEl = fileEl[0]
  if (!fileEl) throw new Error("No <file> element found in XLIFF")

  const sourceLanguage: string =
    fileEl["@_source-language"] ||
    xliff["@_srcLang"] ||
    xliff["@_source-language"] ||
    "en"
  const targetLanguage: string =
    fileEl["@_target-language"] ||
    xliff["@_trgLang"] ||
    xliff["@_target-language"] ||
    "und"

  // Navigate to <body> > <trans-unit> (XLIFF 1.x)
  // or <file> > <unit> (XLIFF 2.0)
  let transUnits: unknown[] = []

  // XLIFF 1.x path: xliff > file > body > trans-unit
  const body = fileEl["body"]
  if (body) {
    let tu = body["trans-unit"] || body["group"]
    if (!tu) tu = []
    if (!Array.isArray(tu)) tu = [tu]
    transUnits = flattenGroups(tu)
  }

  // XLIFF 2.0 path: xliff > file > unit
  if (transUnits.length === 0) {
    let unit = fileEl["unit"] || []
    if (!Array.isArray(unit)) unit = [unit]
    transUnits = unit
  }

  const units: ParsedUnit[] = transUnits
    .map((tu, index) => {
      const unit = tu as Record<string, unknown>
      const id = String(unit["@_id"] || `unit-${index + 1}`)

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
