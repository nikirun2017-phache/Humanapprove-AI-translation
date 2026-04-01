import type { SourceUnit } from "./source-parser"
import {
  extractXmlTextNodes,
  templateizeXmlTextNodes,
  fillXmlTemplate,
} from "./xml-utils"

export interface TranslatedUnit {
  id: string
  translatedText: string
}

/**
 * Builds a new XLIFF 1.2 document from source units and their translations.
 * Produced files include state="needs-review-translation" on each target
 * to signal to reviewers that the content is machine-translated.
 */
export function buildXliffFromTranslations(
  sourceUnits: SourceUnit[],
  translatedUnits: TranslatedUnit[],
  sourceLanguage: string,
  targetLanguage: string,
  originalName = "source"
): string {
  const translationMap = new Map(translatedUnits.map((u: TranslatedUnit) => [u.id, u.translatedText]))

  const transUnits = sourceUnits
    .map((unit) => {
      const target = translationMap.get(unit.id) ?? ""
      const escapedSource = escapeXml(unit.sourceText)
      const escapedTarget = escapeXml(target)
      const escapedId = escapeXml(unit.id)
      return [
        `      <trans-unit id="${escapedId}" xml:space="preserve">`,
        `        <source>${escapedSource}</source>`,
        `        <target state="needs-review-translation">${escapedTarget}</target>`,
        `      </trans-unit>`,
      ].join("\n")
    })
    .join("\n")

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">`,
    `  <file source-language="${escapeXml(sourceLanguage)}" target-language="${escapeXml(targetLanguage)}" original="${escapeXml(originalName)}" datatype="plaintext">`,
    `    <body>`,
    transUnits,
    `    </body>`,
    `  </file>`,
    `</xliff>`,
  ].join("\n")
}

/**
 * Merge AI translations back into the original XLIFF structure.
 *
 * Unlike buildXliffFromTranslations (which creates a minimal new XLIFF),
 * this function preserves the full original document — all <file> elements,
 * namespaces, attributes, and inline <g>/<x>/<ph> tags. It only:
 *   1. Adds target-language="..." to each <file> element
 *   2. Injects <target state="needs-review-translation">...</target> after <source>
 *
 * TAG-PRESERVING MODE (for units with inline XML):
 * When a unit was translated as sub-units (id__t0, id__t1, …), the translations
 * are stitched back into the original <g>/<ph> tag skeleton extracted from the
 * <source> element. This ensures authoring tools like Articulate Rise 360 can
 * re-import the file with all HTML formatting (bullet lists, paragraphs, etc.) intact.
 *
 * PLAIN TEXT MODE (for units without inline XML):
 * The translated string is XML-escaped and inserted directly as <target> text.
 *
 * Required for XLIFF files from authoring tools like Articulate Rise 360 that
 * need to re-import the translated file and rely on the original tag structure.
 */
export function mergeTranslationsIntoXliff(
  originalXml: string,
  targetLanguage: string,
  translations: Map<string, string>
): string {
  // 1. Add target-language to each <file> element (if not already set)
  let result = originalXml.replace(
    /(<file\b)([^>]*?)(\/?>)/g,
    (match, open, attrs, close) => {
      if (/target-language=/.test(attrs)) return match
      return `${open}${attrs} target-language="${escapeXmlAttr(targetLanguage)}"${close}`
    }
  )

  // 2. Inject <target> after </source> for each translated trans-unit.
  // Use occurrence-counting to handle Rise 360 XLIFFs that reuse short IDs
  // like "title" across multiple <file> elements — must match extractRawSourceUnits.
  const seenIds = new Map<string, number>()
  result = result.replace(
    /<trans-unit\b([^>]*)>([\s\S]*?)<\/trans-unit>/g,
    (match, attrs, body) => {
      const idMatch = attrs.match(/\bid="([^"]*)"/)
      if (!idMatch) return match

      const rawId = idMatch[1]
      const count = seenIds.get(rawId) ?? 0
      seenIds.set(rawId, count + 1)
      const id = count === 0 ? rawId : `${rawId}__dup${count + 1}`

      // Skip if <target> already exists in this unit
      if (/<target/.test(body)) return match

      // Compute indentation to align <target> with </source>
      const indentMatch = body.match(/([ \t]*)<\/source>/)
      const indent = indentMatch ? indentMatch[1] : "        "

      // ── TAG-PRESERVING PATH ──────────────────────────────────────────────
      // This unit was translated as sub-units (__t0, __t1, …). Collect the
      // sub-translations, extract the <source> inner XML template, fill the
      // placeholders, and insert the reconstructed XML as the <target> content.
      if (translations.has(`${id}__t0`)) {
        const sourceInnerMatch = body.match(/<source[^>]*>([\s\S]*?)<\/source>/)
        if (sourceInnerMatch) {
          const sourceInner = sourceInnerMatch[1]
          const { template } = templateizeXmlTextNodes(sourceInner)
          const originals = extractXmlTextNodes(sourceInner)

          // Collect sub-translations in index order
          const subTranslations: string[] = []
          for (let ti = 0; translations.has(`${id}__t${ti}`); ti++) {
            subTranslations.push(translations.get(`${id}__t${ti}`)!)
          }

          const targetContent = fillXmlTemplate(template, subTranslations, originals)
          const newBody = body.replace(
            /<\/source>/,
            `</source>\n${indent}<target state="needs-review-translation">${targetContent}</target>`
          )
          return `<trans-unit${attrs}>${newBody}</trans-unit>`
        }
      }

      // ── PLAIN TEXT PATH ──────────────────────────────────────────────────
      // Unit has no inline tags (or tag-preserving path failed). Insert the
      // translation as escaped plain text, decoding any AI-echoed entities first.
      const translation = translations.get(id)
      if (!translation) return match

      const targetContent = escapeXmlContent(
        translation.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim()
      )
      const newBody = body.replace(
        /<\/source>/,
        `</source>\n${indent}<target state="needs-review-translation">${targetContent}</target>`
      )
      return `<trans-unit${attrs}>${newBody}</trans-unit>`
    }
  )

  return result
}

function escapeXmlAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
}

/**
 * Decode any HTML entities the AI may have echoed from the source text,
 * then re-encode the result as valid XML element content.
 * Order: numeric entities first, named entities with &amp; last.
 */
function escapeXmlContent(str: string): string {
  const decoded = str
    .replace(/&#x([0-9A-Fa-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, "&") // &amp; must be decoded last
  return decoded
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
