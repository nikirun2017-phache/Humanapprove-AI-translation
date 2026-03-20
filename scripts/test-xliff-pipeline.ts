/**
 * Test script: verifies the parse → buildMarkdownBatches → parseMarkdownTranslation pipeline
 * against sample XLIFF trans-units without making any API calls.
 *
 * Run: npx tsx scripts/test-xliff-pipeline.ts
 */

import { buildMarkdownBatches, parseMarkdownTranslation } from "../src/lib/xliff-markdown"
import type { SourceUnit } from "../src/lib/source-parser"

// ── Simulate extractRawSourceUnits + XML-stripping (same logic as source-parser.ts) ─────────────
function stripXmlTags(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x[0-9A-Fa-f]+;/g, (e) => String.fromCodePoint(parseInt(e.slice(3, -1), 16)))
    .replace(/\s{2,}/g, " ")
    .trim()
}

// ── Sample trans-units from the XLIFF (only units WITHOUT <target> — those needing translation) ─
const rawTransUnits = [
  {
    id: "items|id:cmmcb1ps4008p3j7mtsnu8lzz|items|id:cmmcb1ps4008r3j7moz80d2k0|description",
    rawSource: `
          <g id="tK_iXDL_x_KSTJLl" ctype="x-html-P">Designing UI components with fixed widths or inflexible containers can cause text to be cut off or overlap when translated into longer languages. This results in unreadable interfaces and poor usability.</g>
          <g id="FBOnM9wqb-wyKQ00" ctype="x-html-P"/>
          <g id="ZeKRJA5SC3uYGNKT" ctype="x-html-P">In Avetta&#x2019;s &#x201C;Membership Details&#x201D; section, some languages with taller characters or longer words caused text to be truncated or descenders to be cut off due to insufficient vertical space.</g>
        `,
  },
  {
    id: "items|id:cmmcb1ps4008p3j7mtsnu8lzz|items|id:cmmcb1ps4008s3j7miz7t0b49|description",
    rawSource: `
          <g id="BXj9lM6jR9RG6CRU" ctype="x-html-P">Building sentences by joining separate strings (e.g., &#x201C;Hello&#x201D; + username + &#x201C;!&#x201D;) can break grammar and word order in other languages. This approach makes accurate translation and localization difficult.</g>
          <g id="MmZCqXDlBGyNotWp" ctype="x-html-P"/>
          <g id="rn5tmaHpQoRfKs-m" ctype="x-html-P">Avetta avoids string concatenation because languages like German or Japanese may require different word order or additional context, leading to awkward or incorrect phrasing if not handled properly.</g>
        `,
  },
  {
    id: "items|id:cmmcb1ps4008p3j7mtsnu8lzz|items|id:cmmcb1ps4008t3j7m2o7widg3|description",
    rawSource: `
          <g id="0hFYrVQ-xyn_zzPs" ctype="x-html-P">Some languages, such as German or French, can be 30&#x2013;40% longer than English. If UI layouts don&#x2019;t account for this, translated text may overflow, overlap, or be truncated, impacting readability and professionalism.</g>
          <g id="GjzskKyZMUdlQ5GW" ctype="x-html-P"/>
          <g id="qDTV4aRXVzupz_le" ctype="x-html-P">Avetta has seen issues where four-digit numbers or long translations caused overlap with other UI elements, making important information hard to read.</g>
        `,
  },
  {
    id: "items|id:p4gmjexujztm7gl2ywewytox|items|id:hgfze53d61hh9x5j75i6xt7v|paragraph",
    rawSource: `
          <g id="JEET7BA56uRGotF-" ctype="x-html-P">Identifying internationalization (i18n) issues early in the development process is essential to prevent costly and disruptive problems later on. Below are some potential consequences of missing these risks, each illustrated with an Avetta-specific example:</g>
        `,
  },
  {
    id: "items|id:hli9rhxrrdbhtfmpb2c7hiz5|items|id:vqcc6dntkzihav1xlj0xz9ns|paragraph",
    rawSource: `
          <g id="PBK4LjhNiIvsEap9" ctype="x-html-P"><g id="ZdU8llES2MMoupaC" ctype="x-html-STRONG">Costly Rework After Launch:</g> If hardcoded strings are discovered after a product release, the engineering team must refactor the code and re-translate content, which can delay other important projects and priorities.</g>
        `,
  },
  {
    id: "items|id:hli9rhxrrdbhtfmpb2c7hiz5|items|id:s683xguzpdv2pn71gucsgs4n|paragraph",
    rawSource: `
          <g id="DmDdz0OdULpcq394" ctype="x-html-P"><g id="L0OZ0IAt3CLpEwS8" ctype="x-html-STRONG">Production Bugs Affecting Users:</g> Issues like overlapping or truncated text can make compliance information unreadable for users, resulting in frustration and an increase in support tickets.</g>
        `,
  },
  {
    id: "items|id:hli9rhxrrdbhtfmpb2c7hiz5|items|id:c9bufpklpt40otzei7w1ozzq|paragraph",
    rawSource: `
          <g id="WFDy6j46TeSyAB38" ctype="x-html-P"><g id="a6OPLL5BexJcweA9" ctype="x-html-STRONG">Compliance Failures by Region:</g> Using incorrect date, number, or currency formats can lead to regulatory problems in regions with strict requirements, potentially resulting in fines or breaches of contract.</g>
        `,
  },
  {
    id: "items|id:hli9rhxrrdbhtfmpb2c7hiz5|items|id:e95ieubt3axko19pyjf6xnpp|paragraph",
    rawSource: `
          <g id="fWdjQH4fwGoL8sYS" ctype="x-html-P"><g id="z407ZIfMfvotHyoG" ctype="x-html-STRONG">Delayed Global Releases:</g> Addressing i18n issues late in the development cycle can postpone release dates for new locales, hindering Avetta&#x2019;s efforts to expand globally.</g>
        `,
  },
]

// ── Step 1: Convert to SourceUnit[] ──────────────────────────────────────────
const units: SourceUnit[] = rawTransUnits.map((u) => ({
  id: u.id,
  sourceText: stripXmlTags(u.rawSource),
}))

console.log("=== STEP 1: Parsed SourceUnits ===")
for (const u of units) {
  console.log(`\n[${u.id}]`)
  console.log(`  → "${u.sourceText}"`)
}

// ── Step 2: Build markdown batches ───────────────────────────────────────────
const batches = buildMarkdownBatches(units)

console.log(`\n\n=== STEP 2: Markdown Batches (${batches.length} batch(es)) ===`)
for (let i = 0; i < batches.length; i++) {
  const { markdown, indexToId } = batches[i]
  console.log(`\n--- Batch ${i + 1} ---`)
  console.log("indexToId map:")
  for (const [idx, id] of indexToId) {
    console.log(`  ${idx} → ${id}`)
  }
  console.log("\nMarkdown sent to AI:")
  console.log(markdown)
}

// ── Step 3: Simulate AI response (fake Chinese translations for each section) ─
// Uses the same numeric marker format the AI should return
const fakeAiResponse = batches[0].markdown
  .split("\n")
  .map((line) => {
    // Keep markers intact, replace content lines with fake Chinese
    if (/^##\s+§\d+§/.test(line)) return line
    if (line.trim() === "") return line
    return "[翻译内容]"
  })
  .join("\n")

console.log("\n\n=== STEP 3: Simulated AI Response ===")
console.log(fakeAiResponse)

// ── Step 4: Parse AI response and map back to real IDs ───────────────────────
console.log("\n\n=== STEP 4: Parsed translations → mapped to real unit IDs ===")
const { indexToId } = batches[0]
const indexedMap = parseMarkdownTranslation(fakeAiResponse)
const translationMap = new Map<string, string>()

for (const [idx, text] of indexedMap) {
  const unitId = indexToId.get(idx)
  if (unitId) {
    translationMap.set(unitId, text)
    console.log(`\n[${unitId}]`)
    console.log(`  → "${text}"`)
  } else {
    console.log(`\nWARNING: index "${idx}" not found in indexToId map!`)
  }
}

console.log(`\n\nTotal mapped: ${translationMap.size} / ${units.length} units`)
if (translationMap.size === units.length) {
  console.log("✓ All units mapped successfully")
} else {
  console.log("✗ Some units were not mapped — check for gaps")
  const missing = units.filter((u) => !translationMap.has(u.id))
  for (const u of missing) console.log(`  Missing: ${u.id}`)
}
