import type { SourceUnit } from "./source-parser"

/**
 * Regex that splits an HTML string into alternating segments:
 *   even indices → raw text nodes (between markup)
 *   odd  indices → markup tokens (preserved verbatim):
 *                  comments, DOCTYPE, <script>…</script>,
 *                  <style>…</style>, or any other tag
 *
 * Using a capturing group in split() means odd parts are the captured
 * delimiters — we keep them verbatim; even parts are what we translate.
 */
const SPLIT_RE =
  /(<!--[\s\S]*?-->|<!\w[^>]*>|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<[^>]*>)/gi

/**
 * Returns true if a text node contains at least one translatable letter.
 * Skips pure numbers, symbols, emoji, whitespace, HTML-only junk.
 * Uses \p{L} (any Unicode letter) for language-agnostic detection.
 */
function isTranslatable(text: string): boolean {
  return /\p{L}/u.test(text)
}

/**
 * Parse an HTML file into translatable SourceUnits.
 *
 * Strategy:
 *  - Split on markup tokens (script/style blocks, comments, tags).
 *  - Even-indexed parts after the split are raw text nodes.
 *  - Assign sequential IDs (t_0, t_1, …) only to non-trivial text nodes.
 *  - Only the plain text is sent to the AI — zero HTML markup in tokens.
 *
 * The original HTML string must be stored as job.sourceData so that
 * reconstructHtml() can rebuild the translated file.
 */
export function parseHtmlSource(html: string): SourceUnit[] {
  const parts = html.split(SPLIT_RE)
  const units: SourceUnit[] = []
  let idx = 0

  for (let i = 0; i < parts.length; i += 2) {
    // i is always an even index → text node
    const text = parts[i].trim()
    if (isTranslatable(text)) {
      units.push({ id: `t_${idx++}`, sourceText: text })
    }
  }

  return units
}

/**
 * Reconstruct a translated HTML file.
 *
 * Walks the same split as parseHtmlSource. For every even-indexed segment
 * that was assigned a translation unit, replaces the trimmed text with the
 * translation while preserving surrounding whitespace exactly.
 *
 * Also updates the `lang` attribute on the <html> element to targetLanguage.
 */
export function reconstructHtml(
  html: string,
  translations: Map<string, string>,
  targetLanguage: string
): string {
  const parts = html.split(SPLIT_RE)
  let idx = 0

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      // Text node
      const text = parts[i].trim()
      if (isTranslatable(text)) {
        const translation = translations.get(`t_${idx++}`)
        if (translation) {
          // Preserve any surrounding whitespace (newlines, indentation)
          const leading  = parts[i].match(/^\s*/)?.[0]  ?? ""
          const trailing = parts[i].match(/\s*$/)?.[0]  ?? ""
          parts[i] = leading + translation + trailing
        }
      }
      // Non-translatable text: copy verbatim (idx not incremented)
    }
    // Odd indices are markup tokens — leave untouched
  }

  let result = parts.join("")

  // Update <html lang="..."> attribute
  result = result.replace(
    /(<html\b[^>]*?\blang=["'])([^"']*)(['"][^>]*>)/i,
    `$1${targetLanguage}$3`
  )

  return result
}
