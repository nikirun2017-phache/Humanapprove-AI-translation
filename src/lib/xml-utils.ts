/**
 * Utilities for tag-preserving XLIFF translation.
 *
 * Problem: XLIFF source units often contain inline XML tags (e.g. <g ctype="x-html-LI">)
 * that encode HTML structure (bullet lists, paragraphs, bold, etc.). Authoring tools such
 * as Articulate Rise 360 require these tags to be present in the <target> element so that
 * the translated file can be correctly re-imported with its original formatting intact.
 *
 * Solution:
 *   1. extractXmlTextNodes()    — pull the translatable leaf text out of the XML
 *   2. templateizeXmlTextNodes() — replace each text node with a ⟦N⟧ placeholder
 *   3. fillXmlTemplate()         — put the translated strings back, XML-encoded
 *
 * The tag skeleton (all <g>, <ph>, <bpt>, <ept> elements with their id/ctype attributes)
 * is preserved verbatim. Only the text content is replaced.
 *
 * Example round-trip:
 *
 *   source inner XML:
 *     <g id="A" ctype="x-html-UL">
 *       <g id="B" ctype="x-html-LI">Identify the main hazards.</g>
 *       <g id="C" ctype="x-html-LI">Describe the injuries.</g>
 *     </g>
 *
 *   textNodes:  ["Identify the main hazards.", "Describe the injuries."]
 *
 *   template:
 *     <g id="A" ctype="x-html-UL">
 *       <g id="B" ctype="x-html-LI">⟦0⟧</g>
 *       <g id="C" ctype="x-html-LI">⟦1⟧</g>
 *     </g>
 *
 *   translations: ["主要危险识别。", "伤害描述。"]
 *
 *   target inner XML (filled):
 *     <g id="A" ctype="x-html-UL">
 *       <g id="B" ctype="x-html-LI">主要危险识别。</g>
 *       <g id="C" ctype="x-html-LI">伤害描述。</g>
 *     </g>
 */

/**
 * Split raw XML into interleaved [text, tag, text, tag, …] segments.
 * Tags are items that start with `<`; everything else is a text node.
 * The capture group in the split regex keeps the tag delimiters in the array.
 */
function splitTagsAndText(xml: string): string[] {
  return xml.split(/(<[^>]+>)/)
}

/**
 * Returns true if the raw inner XML of a <source> element contains any inline
 * XML tags (i.e. needs tag-preserving translation).
 */
export function hasInlineXmlTags(xml: string): boolean {
  return /<[a-zA-Z]/.test(xml)
}

/**
 * Decode XML/HTML entities to their Unicode characters.
 * &amp; must be decoded last to avoid double-decoding.
 */
export function decodeXmlEntities(str: string): string {
  return str
    .replace(/&#x([0-9A-Fa-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, "&") // must be last
}

/**
 * Encode a plain string for safe use as XML element text content.
 */
export function encodeXmlText(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

/**
 * Extract the translatable leaf text nodes from raw XLIFF inline XML.
 * Returns decoded strings (XML entities resolved to Unicode) in document order.
 * Whitespace-only segments (indentation / newlines) are excluded.
 *
 * Example:
 *   '<g id="A"><g id="B">Hello &amp; world</g><g id="C">Bye</g></g>'
 *   → ["Hello & world", "Bye"]
 */
export function extractXmlTextNodes(xml: string): string[] {
  const nodes: string[] = []
  for (const part of splitTagsAndText(xml)) {
    if (part.startsWith("<")) continue // it's a tag
    const text = part.trim()
    if (text) nodes.push(decodeXmlEntities(text))
  }
  return nodes
}

/**
 * Replace each non-whitespace text node in raw XLIFF inline XML with a
 * numbered placeholder ⟦0⟧, ⟦1⟧, … in document order.
 * Whitespace-only segments (indentation / newlines between tags) are preserved
 * unchanged so the formatting of the output XML stays readable.
 *
 * Returns:
 *   template — the XML string with text nodes replaced by placeholders
 *   count    — number of placeholders inserted (= number of text nodes)
 *
 * Example:
 *   '<g id="A"><g id="B">Hello</g>\n  <g id="C">Bye</g></g>'
 *   → { template: '<g id="A"><g id="B">⟦0⟧</g>\n  <g id="C">⟦1⟧</g></g>', count: 2 }
 */
export function templateizeXmlTextNodes(xml: string): { template: string; count: number } {
  let idx = 0
  const parts = splitTagsAndText(xml)
  const result = parts.map((part) => {
    if (part.startsWith("<")) return part // tag — keep verbatim
    const trimmed = part.trim()
    if (!trimmed) return part // whitespace-only — keep to preserve indentation
    // Replace only the non-whitespace content with a placeholder,
    // preserving any surrounding whitespace/newlines
    const leadWs = part.slice(0, part.length - part.trimStart().length)
    const trailWs = part.slice(part.trimEnd().length)
    return `${leadWs}⟦${idx++}⟧${trailWs}`
  })
  return { template: result.join(""), count: idx }
}

/**
 * Fill ⟦N⟧ placeholders in an XML template with translated strings.
 * Each translation is XML-encoded (& < >) before insertion.
 * If a translation is missing for an index, the corresponding original
 * (decoded) text is used as a fallback — so the output is always complete.
 *
 * @param template     — output of templateizeXmlTextNodes()
 * @param translations — translated strings in the same order as the originals
 * @param originals    — original decoded text strings (fallback if AI skipped one)
 */
export function fillXmlTemplate(
  template: string,
  translations: string[],
  originals: string[]
): string {
  return template.replace(/⟦(\d+)⟧/g, (_, i) => {
    const idx = parseInt(i, 10)
    const text = (translations[idx] !== undefined && translations[idx] !== "")
      ? translations[idx]
      : (originals[idx] ?? "")
    return encodeXmlText(text)
  })
}
