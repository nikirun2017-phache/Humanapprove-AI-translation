import type { SourceUnit } from "./source-parser"

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
  const translationMap = new Map(translatedUnits.map((u) => [u.id, u.translatedText]))

  const transUnits = sourceUnits
    .map((unit, i) => {
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

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
