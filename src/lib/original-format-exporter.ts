/**
 * Reconstruct an original source file (CSV, JSON, Markdown) from a set of
 * reviewed+approved translations.
 *
 * Flow: user uploaded CSV → AI translated → XLIFF review → approved
 *       → exportAsCsv() → clean CSV with target language replacing source
 */

export interface ExportUnit {
  id: string          // original key / path / segment id
  sourceText: string  // original source language text (for reference)
  translatedText: string // revisedTarget ?? targetText (best available)
}

// ── JSON ──────────────────────────────────────────────────────────────────────

/**
 * Reconstruct a nested JSON object from flat dot-notation keys.
 * e.g. { "nav.home": "首页", "nav.about": "关于" }
 *   → { "nav": { "home": "首页", "about": "关于" } }
 */
export function exportAsJson(units: ExportUnit[]): string {
  const root: Record<string, unknown> = {}
  for (const unit of units) {
    setNestedValue(root, unit.id, unit.translatedText)
  }
  return JSON.stringify(root, null, 2)
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: string) {
  const parts = path.split(".")
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (typeof current[part] !== "object" || current[part] === null) {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
}

// ── CSV ───────────────────────────────────────────────────────────────────────

/**
 * Reconstruct a CSV file with target translations replacing the source column.
 * Output: id,<targetLanguage>
 */
export function exportAsCsv(units: ExportUnit[], targetLanguage: string): string {
  function quote(s: string): string {
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`
    }
    return s
  }

  const header = `id,${targetLanguage}`
  const rows = units.map((u: ExportUnit) => `${quote(u.id)},${quote(u.translatedText)}`)
  return [header, ...rows].join("\n")
}

// ── Markdown ──────────────────────────────────────────────────────────────────

/**
 * Reconstruct a Markdown document from translated units.
 * Unit IDs encode type: h1_0 = H1 heading, h2_1 = H2, li_2 = list item, p_3 = paragraph.
 */
export function exportAsMd(units: ExportUnit[]): string {
  const lines: string[] = []
  let lastWasList = false

  for (const unit of units) {
    const { id, translatedText: text } = unit
    const headingMatch = id.match(/^h(\d)_/)
    const isList = /^li_/.test(id)

    if (headingMatch) {
      if (lines.length > 0) lines.push("")
      lines.push("#".repeat(Math.min(6, parseInt(headingMatch[1]))) + " " + text)
      lastWasList = false
    } else if (isList) {
      lines.push("- " + text)
      lastWasList = true
    } else {
      // paragraph
      if (lastWasList) lines.push("")
      lines.push(text)
      lines.push("")
      lastWasList = false
    }
  }

  return lines.join("\n").trim()
}

// ── Plain text (PDF fallback) ─────────────────────────────────────────────────

/**
 * Reconstruct a plain text file from PDF translation units.
 * PDFs can't be rebuilt programmatically, so we output clean translated text
 * that the user can paste into their document tool.
 */
export function exportAsTxt(units: ExportUnit[]): string {
  return units.map((u: ExportUnit) => u.translatedText).join("\n\n")
}

// ── .strings (Apple iOS/macOS) ───────────────────────────────────────────────

function escapeStringsValue(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\t/g, "\\t")
}

export function exportAsStrings(units: ExportUnit[]): string {
  const lines: string[] = []
  for (const unit of units) {
    lines.push(`"${escapeStringsValue(unit.id)}" = "${escapeStringsValue(unit.translatedText)}";`)
  }
  return lines.join("\n")
}

// ── .stringsdict (Apple plist XML plurals) ────────────────────────────────────

/**
 * Reconstruct a .stringsdict plist from units with IDs like "{key}__{form}".
 * Groups plural forms back under their entry key.
 */
export function exportAsStringsDict(units: ExportUnit[]): string {
  // Group units by entry key (before __) and plural form (after __)
  const entries = new Map<string, Map<string, string>>()
  for (const unit of units) {
    const sep = unit.id.lastIndexOf("__")
    if (sep === -1) continue
    const key = unit.id.slice(0, sep)
    const form = unit.id.slice(sep + 2)
    if (!entries.has(key)) entries.set(key, new Map())
    entries.get(key)!.set(form, unit.translatedText)
  }

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    "<dict>",
  ]
  for (const [key, forms] of entries) {
    lines.push(`\t<key>${xmlEsc(key)}</key>`, "\t<dict>")
    lines.push("\t\t<key>NSStringLocalizedFormatKey</key>", "\t\t<string>%#@value@</string>")
    lines.push("\t\t<key>value</key>", "\t\t<dict>")
    lines.push("\t\t\t<key>NSStringFormatSpecTypeKey</key>", "\t\t\t<string>NSStringPluralRuleType</string>")
    lines.push("\t\t\t<key>NSStringFormatValueTypeKey</key>", "\t\t\t<string>d</string>")
    for (const [form, text] of forms) {
      lines.push(`\t\t\t<key>${xmlEsc(form)}</key>`, `\t\t\t<string>${xmlEsc(text)}</string>`)
    }
    lines.push("\t\t</dict>", "\t</dict>")
  }
  lines.push("</dict>", "</plist>")
  return lines.join("\n")
}

// ── .xcstrings (Xcode Strings Catalog JSON) ──────────────────────────────────

/**
 * Reconstruct an .xcstrings catalog with translated localizations added.
 * Parses the source catalog to preserve metadata, then adds the target locale.
 */
export function exportAsXcstrings(
  units: ExportUnit[],
  sourceContent: string,
  targetLanguage: string
): string {
  type StringUnit = { state?: string; value?: string }
  type Variation = { stringUnit?: StringUnit }
  type Localization = {
    stringUnit?: StringUnit
    variations?: { plural?: Record<string, Variation> }
  }
  type XcstringsFile = {
    sourceLanguage?: string
    strings?: Record<string, { comment?: string; localizations?: Record<string, Localization> }>
    version?: string
  }

  const catalog = JSON.parse(sourceContent) as XcstringsFile
  const langCode = targetLanguage.split("-")[0] // "zh-CN" → "zh"

  for (const unit of units) {
    const isPluralForm = unit.id.includes("____plural__")
    if (isPluralForm) {
      const [key, form] = unit.id.split("____plural__")
      const entry = catalog.strings?.[key]
      if (!entry) continue
      if (!entry.localizations) entry.localizations = {}
      if (!entry.localizations[langCode]) entry.localizations[langCode] = { variations: { plural: {} } }
      if (!entry.localizations[langCode].variations) entry.localizations[langCode].variations = { plural: {} }
      if (!entry.localizations[langCode].variations!.plural) entry.localizations[langCode].variations!.plural = {}
      entry.localizations[langCode].variations!.plural![form] = {
        stringUnit: { state: "translated", value: unit.translatedText },
      }
    } else {
      const entry = catalog.strings?.[unit.id]
      if (!entry) continue
      if (!entry.localizations) entry.localizations = {}
      entry.localizations[langCode] = {
        stringUnit: { state: "translated", value: unit.translatedText },
      }
    }
  }
  return JSON.stringify(catalog, null, 2)
}

// ── .po (GNU gettext) ─────────────────────────────────────────────────────────

function escapePoString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\t/g, "\\t")
}

/**
 * Reconstruct a .po file from translated units.
 * Groups "__pl_0" / "__pl_1" sibling units back into msgid / msgid_plural blocks.
 */
export function exportAsPo(units: ExportUnit[], targetLanguage: string): string {
  const now = new Date().toISOString().replace("T", " ").replace(/\.\d+Z/, "+0000")
  const lines = [
    `# Generated by Summon Translator`,
    `msgid ""`,
    `msgstr ""`,
    `"Content-Type: text/plain; charset=UTF-8\\n"`,
    `"Content-Transfer-Encoding: 8bit\\n"`,
    `"Language: ${targetLanguage}\\n"`,
    `"MIME-Version: 1.0\\n"`,
    `"PO-Revision-Date: ${now}\\n"`,
    "",
  ]

  // Group plural siblings together
  const handled = new Set<string>()
  for (const unit of units) {
    if (handled.has(unit.id)) continue
    if (unit.id.endsWith("__pl_0")) {
      const baseId = unit.id.slice(0, -6)
      const plural = units.find(u => u.id === `${baseId}__pl_1`)
      lines.push(`msgid "${escapePoString(unit.sourceText)}"`)
      lines.push(`msgid_plural "${escapePoString(plural?.sourceText ?? "")}"`)
      lines.push(`msgstr[0] "${escapePoString(unit.translatedText)}"`)
      lines.push(`msgstr[1] "${escapePoString(plural?.translatedText ?? "")}"`)
      lines.push("")
      handled.add(unit.id)
      if (plural) handled.add(plural.id)
    } else if (!unit.id.endsWith("__pl_1")) {
      lines.push(`msgid "${escapePoString(unit.sourceText)}"`)
      lines.push(`msgstr "${escapePoString(unit.translatedText)}"`)
      lines.push("")
      handled.add(unit.id)
    }
  }
  return lines.join("\n")
}

// ── .xml (Android strings.xml) ───────────────────────────────────────────────

function xmlEsc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "\\'")
}

/**
 * Reconstruct an Android strings.xml from translated units.
 * Groups plural (__qty__) and array (__arr__) units back into the correct elements.
 */
export function exportAsAndroidXml(units: ExportUnit[]): string {
  // Separate unit types
  const simples = units.filter(u => !u.id.includes("__qty__") && !u.id.includes("__arr__"))
  const pluralUnits = units.filter(u => u.id.includes("__qty__"))
  const arrayUnits = units.filter(u => u.id.includes("__arr__"))

  // Group plurals by name
  const pluralGroups = new Map<string, Array<{ quantity: string; text: string }>>()
  for (const u of pluralUnits) {
    const [name, , quantity] = u.id.split("__")
    if (!pluralGroups.has(name)) pluralGroups.set(name, [])
    pluralGroups.get(name)!.push({ quantity, text: u.translatedText })
  }

  // Group arrays by name
  const arrayGroups = new Map<string, string[]>()
  for (const u of arrayUnits) {
    const [name] = u.id.split("__arr__")
    if (!arrayGroups.has(name)) arrayGroups.set(name, [])
    arrayGroups.get(name)!.push(u.translatedText)
  }

  const lines = ['<?xml version="1.0" encoding="utf-8"?>', "<resources>"]
  for (const u of simples) {
    lines.push(`    <string name="${xmlEsc(u.id)}">${xmlEsc(u.translatedText)}</string>`)
  }
  for (const [name, items] of pluralGroups) {
    lines.push(`    <plurals name="${xmlEsc(name)}">`)
    for (const { quantity, text } of items) {
      lines.push(`        <item quantity="${xmlEsc(quantity)}">${xmlEsc(text)}</item>`)
    }
    lines.push("    </plurals>")
  }
  for (const [name, items] of arrayGroups) {
    lines.push(`    <string-array name="${xmlEsc(name)}">`)
    for (const text of items) {
      lines.push(`        <item>${xmlEsc(text)}</item>`)
    }
    lines.push("    </string-array>")
  }
  lines.push("</resources>")
  return lines.join("\n")
}

// ── .arb (Flutter ARB) ───────────────────────────────────────────────────────

/**
 * Reconstruct a Flutter ARB file from translated units.
 * Copies all @ metadata keys from source, replaces string values with translations.
 */
export function exportAsArb(
  units: ExportUnit[],
  sourceContent: string,
  targetLanguage: string
): string {
  const source = JSON.parse(sourceContent) as Record<string, unknown>
  const result: Record<string, unknown> = { "@@locale": targetLanguage.split("-")[0] }
  const translationMap = new Map(units.map(u => [u.id, u.translatedText]))
  for (const [key, value] of Object.entries(source)) {
    if (key === "@@locale") continue
    if (key.startsWith("@")) { result[key] = value; continue }
    result[key] = translationMap.get(key) ?? (typeof value === "string" ? value : value)
  }
  return JSON.stringify(result, null, 2)
}

// ── .properties (Java / Spring) ──────────────────────────────────────────────

function escapePropertiesValue(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\t/g, "\\t").replace(/\r/g, "\\r")
}

export function exportAsProperties(units: ExportUnit[]): string {
  return units.map(u => `${u.id}=${escapePropertiesValue(u.translatedText)}`).join("\n")
}

// ── Label helpers ─────────────────────────────────────────────────────────────

export function formatLabel(sourceFormat: string): string {
  switch (sourceFormat) {
    case "json":        return "JSON"
    case "csv":         return "CSV"
    case "md":          return "Markdown"
    case "pdf":         return "TXT (from PDF)"
    case "strings":     return ".strings"
    case "stringsdict": return ".stringsdict"
    case "xcstrings":   return ".xcstrings"
    case "po":          return ".po"
    case "xml":         return "Android XML"
    case "arb":         return ".arb"
    case "properties":  return ".properties"
    default:            return sourceFormat.toUpperCase()
  }
}

export function formatExtension(sourceFormat: string): string {
  if (sourceFormat === "pdf") return "txt"
  return sourceFormat
}

export function formatMimeType(sourceFormat: string): string {
  switch (sourceFormat) {
    case "json":        return "application/json"
    case "csv":         return "text/csv"
    case "md":          return "text/markdown"
    case "xml":         return "application/xml"
    case "arb":         return "application/json"
    default:            return "text/plain"
  }
}
