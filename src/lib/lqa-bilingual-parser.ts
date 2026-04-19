import { XMLParser } from "fast-xml-parser"

export interface BilingualUnit {
  id: string
  source: string
  target: string
}

export interface BilingualParseResult {
  units: BilingualUnit[]
  sourceLanguage: string
  targetLanguage: string
  format: "xliff" | "tmx"
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
  parseTagValue: true,
  trimValues: false,
  cdataPropName: "__cdata",
  processEntities: false,
})

function extractText(node: unknown): string {
  if (node === null || node === undefined) return ""
  if (typeof node === "string") return node
  if (typeof node === "number") return String(node)
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>
    if (obj["__cdata"]) return String(obj["__cdata"])
    if (obj["#text"]) return String(obj["#text"])
    const parts: string[] = []
    for (const [key, val] of Object.entries(obj)) {
      if (key.startsWith("@_")) continue
      if (["g", "ph", "bpt", "ept", "x", "bx", "ex", "it", "mrk", "seg"].includes(key)) {
        if (Array.isArray(val)) parts.push(...val.map(extractText))
        else parts.push(extractText(val))
      }
    }
    if (parts.length) return parts.join("")
  }
  return String(node)
}

// ─── XLIFF 1.2 / 2.0 parser (bilingual: reads both source + target) ───────────

function parseXliffBilingual(content: string): BilingualParseResult {
  const parsed = parser.parse(content)
  const xliff = parsed["xliff"]
  if (!xliff) throw new Error("Not a valid XLIFF file: missing <xliff> root element")

  let fileEls = xliff["file"]
  if (!fileEls) throw new Error("No <file> element found in XLIFF")
  if (!Array.isArray(fileEls)) fileEls = [fileEls]

  const firstFile = fileEls[0] as Record<string, unknown>
  const sourceLang: string =
    (firstFile["@_source-language"] as string) ||
    (xliff["@_srcLang"] as string) ||
    (xliff["@_source-language"] as string) ||
    "en"
  const targetLang: string =
    (firstFile["@_target-language"] as string) ||
    (xliff["@_trgLang"] as string) ||
    (xliff["@_target-language"] as string) ||
    ""

  const units: BilingualUnit[] = []
  let orderIdx = 0
  // Track how many times each ID has been seen across ALL <file> elements.
  // XLIFF allows duplicate trans-unit IDs across different <file> blocks; we make
  // them globally unique by appending "#N" (N≥2) so every unit has a distinct key.
  const seenIds = new Map<string, number>()
  const uniqueId = (rawId: string): string => {
    const n = (seenIds.get(rawId) ?? 0) + 1
    seenIds.set(rawId, n)
    return n === 1 ? rawId : `${rawId}#${n}`
  }

  for (const fileEl of fileEls as Record<string, unknown>[]) {
    // XLIFF 1.2: body/trans-unit
    const body = fileEl["body"] as Record<string, unknown> | undefined
    if (body) {
      let transUnits = body["trans-unit"]
      if (!transUnits) continue
      if (!Array.isArray(transUnits)) transUnits = [transUnits]
      for (const tu of transUnits as Record<string, unknown>[]) {
        const rawId = String(tu["@_id"] ?? `unit_${orderIdx}`)
        const source = extractText(tu["source"])
        const target = extractText(tu["target"])
        if (source.trim()) {
          units.push({ id: uniqueId(rawId), source: source.trim(), target: target.trim() })
          orderIdx++
        }
      }
    }

    // XLIFF 2.0: unit/segment
    let unitEls = fileEl["unit"] as unknown
    if (!unitEls) {
      const groupEl = fileEl["group"] as Record<string, unknown> | undefined
      if (groupEl) unitEls = groupEl["unit"]
    }
    if (unitEls) {
      if (!Array.isArray(unitEls)) unitEls = [unitEls]
      for (const u of unitEls as Record<string, unknown>[]) {
        const rawId = String(u["@_id"] ?? `unit_${orderIdx}`)
        let segs = u["segment"]
        if (!segs) continue
        if (!Array.isArray(segs)) segs = [segs]
        const segArray = Array.isArray(segs) ? segs : [segs]
        for (let si = 0; si < (segArray as unknown[]).length; si++) {
          const seg = (segArray as Record<string, unknown>[])[si]
          const source = extractText(seg["source"])
          const target = extractText(seg["target"])
          if (source.trim()) {
            // Each segment gets a unique ID: unitId for first, unitId#seg2, unitId#seg3…
            const segId = si === 0 ? uniqueId(rawId) : uniqueId(`${rawId}#seg${si + 1}`)
            units.push({ id: segId, source: source.trim(), target: target.trim() })
            orderIdx++
          }
        }
      }
    }
  }

  if (units.length === 0) throw new Error("No translation units found in XLIFF file")

  return { units, sourceLanguage: sourceLang, targetLanguage: targetLang, format: "xliff" }
}

// ─── TMX parser ────────────────────────────────────────────────────────────────

function parseTmx(content: string): BilingualParseResult {
  const parsed = parser.parse(content)
  const tmx = parsed["tmx"]
  if (!tmx) throw new Error("Not a valid TMX file: missing <tmx> root element")

  const header = tmx["header"] as Record<string, unknown> | undefined
  const srcLangAttr = (header?.["@_srclang"] as string) || "en"

  const body = tmx["body"] as Record<string, unknown> | undefined
  if (!body) throw new Error("No <body> element in TMX file")

  let tus = body["tu"]
  if (!tus) throw new Error("No <tu> elements found in TMX file")
  if (!Array.isArray(tus)) tus = [tus]

  let sourceLang = srcLangAttr
  let targetLang = ""
  const units: BilingualUnit[] = []
  let orderIdx = 0

  for (const tu of tus as Record<string, unknown>[]) {
    const tuId = String(
      (tu["@_tuid"] as string) ||
      (tu["@_id"] as string) ||
      `tu_${orderIdx}`
    )

    let tuvs = tu["tuv"]
    if (!tuvs) continue
    if (!Array.isArray(tuvs)) tuvs = [tuvs]

    let srcText = ""
    let tgtText = ""
    let firstLang = ""
    let secondLang = ""

    for (const tuv of tuvs as Record<string, unknown>[]) {
      const lang: string =
        (tuv["@_xml:lang"] as string) ||
        (tuv["@_lang"] as string) ||
        ""
      const seg = extractText(tuv["seg"]).trim()

      if (!firstLang) {
        firstLang = lang
        srcText = seg
      } else if (!secondLang) {
        secondLang = lang
        tgtText = seg
      }
    }

    // Resolve source/target based on header srclang
    if (
      firstLang.toLowerCase() === sourceLang.toLowerCase() ||
      sourceLang === "*all*"
    ) {
      // first tuv is source, second is target
    } else {
      // Swap
      ;[srcText, tgtText] = [tgtText, srcText]
      ;[firstLang, secondLang] = [secondLang, firstLang]
    }

    if (firstLang) sourceLang = firstLang
    if (secondLang) targetLang = secondLang

    if (srcText) {
      units.push({ id: tuId, source: srcText, target: tgtText })
      orderIdx++
    }
  }

  if (units.length === 0) throw new Error("No translation units found in TMX file")

  return { units, sourceLanguage: sourceLang, targetLanguage: targetLang, format: "tmx" }
}

// ─── Public entry point ────────────────────────────────────────────────────────

export function parseBilingualFile(
  content: string,
  ext: string
): BilingualParseResult {
  const normalised = ext.toLowerCase().replace(/^\./, "")
  if (normalised === "tmx") return parseTmx(content)
  if (normalised === "xliff" || normalised === "xlf" || normalised === "mxliff") return parseXliffBilingual(content)
  throw new Error(`Unsupported format: .${normalised}. Accepted: .xliff, .xlf, .mxliff, .tmx`)
}
