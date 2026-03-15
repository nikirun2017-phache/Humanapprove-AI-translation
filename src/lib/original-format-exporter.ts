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
  const rows = units.map((u) => `${quote(u.id)},${quote(u.translatedText)}`)
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
  return units.map((u) => u.translatedText).join("\n\n")
}

// ── Label helpers ─────────────────────────────────────────────────────────────

export function formatLabel(sourceFormat: string): string {
  switch (sourceFormat) {
    case "json": return "JSON"
    case "csv":  return "CSV"
    case "md":   return "Markdown"
    case "pdf":  return "TXT (from PDF)"
    default:     return sourceFormat.toUpperCase()
  }
}

export function formatExtension(sourceFormat: string): string {
  if (sourceFormat === "pdf") return "txt"
  return sourceFormat
}

export function formatMimeType(sourceFormat: string): string {
  switch (sourceFormat) {
    case "json": return "application/json"
    case "csv":  return "text/csv"
    case "md":   return "text/markdown"
    default:     return "text/plain"
  }
}
