import type { AIProvider, TranslationBatch, TranslationResult, TranslatedUnit, SourceUnit, GlossaryTerm } from "./types"

const SYSTEM_PROMPT = `You are a professional translator. Translate the provided JSON array of strings from {SOURCE} to {TARGET}.
Rules:
- Return ONLY a valid JSON array of objects with "id" and "translatedText" fields. No markdown fences, no extra text.
- Tokens like {{T1}}, {{T2}}, {{T3}}, etc. are XLIFF formatting placeholders. Copy them EXACTLY as-is in the translated text, keeping their position relative to the surrounding words. Never drop, duplicate, or alter any {{T…}} token.
- Preserve all other placeholders exactly: {variable}, {{variable}}, %s, %d, HTML entities (&amp; &#x2019; &#x2014; etc.).
- Keep the same tone and formality as the source.
- Do not add explanations or notes outside the JSON.`

export function buildGlossaryPromptSection(terms: GlossaryTerm[]): string {
  const valid = terms.filter(t => t.source.trim() && t.target.trim())
  if (valid.length === 0) return ""
  const lines = valid.map(t => `  - "${t.source}" → "${t.target}"`).join("\n")
  return (
    `\nCRITICAL — Terminology glossary (HIGHEST PRIORITY — overrides all other rules):\n` +
    `The terms below MUST be translated exactly as specified. This applies even when a term looks like an abbreviation, code, or proper name that would normally be kept in English. Match terms case-insensitively.\n` +
    `${lines}\n`
  )
}

export const anthropicProvider: AIProvider = {
  name: "anthropic",

  async translate(batch: TranslationBatch, apiKey: string, model: string): Promise<TranslationResult> {
    const glossarySection = batch.glossaryTerms ? buildGlossaryPromptSection(batch.glossaryTerms) : ""
    const basePrompt = SYSTEM_PROMPT
      .replace("{SOURCE}", batch.sourceLanguage)
      .replace("{TARGET}", batch.targetLanguage)
    const systemPrompt = glossarySection
      ? basePrompt.replace("Rules:\n", `${glossarySection}\nRules:\n`)
      : basePrompt

    const userContent = JSON.stringify(
      batch.units.map((u: SourceUnit) => ({ id: u.id, text: u.sourceText }))
    )

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 16000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Translate these strings to ${batch.targetLanguage}. Return a JSON array where each item has "id" and "translatedText":\n${userContent}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Anthropic API error ${response.status}: ${err}`)
    }

    const data = await response.json() as {
      content: { type: string; text: string }[]
      stop_reason?: string
    }
    const text = data.content.find((c: { type: string; text: string }) => c.type === "text")?.text ?? ""

    if (data.stop_reason === "max_tokens") {
      throw new Error(`Translation response was truncated (max_tokens reached). Try a smaller batch or simpler content.`)
    }

    return { units: parseTranslationResponse(text, batch.units) }
  },
}

/**
 * Locate the first complete JSON array in `text` using a bracket-depth scanner.
 * Unlike a greedy regex, this correctly handles ] characters that appear inside
 * string values or in text the model appends after the JSON array.
 */
function extractJsonArray(text: string): string | null {
  const start = text.indexOf("[")
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escaped) { escaped = false; continue }
    if (ch === "\\" && inString) { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === "[") depth++
    else if (ch === "]") { if (--depth === 0) return text.slice(start, i + 1) }
  }
  return null
}

function parseTranslationResponse(
  text: string,
  originalUnits: TranslationBatch["units"]
): TranslatedUnit[] {
  // Extract the outermost JSON array using a bracket-depth scanner.
  // A greedy regex like /\[[\s\S]*\]/ breaks when the model appends notes
  // after the array that contain ] (e.g. "See footnote [1]"), causing it to
  // capture content beyond the real closing bracket and producing invalid JSON.
  const jsonArray = extractJsonArray(text)
  if (!jsonArray) {
    throw new Error(`Translation response did not contain a JSON array. Model output: ${text.slice(0, 400)}`)
  }

  let rawParsed: { id: string; translatedText?: string; text?: string }[]
  try {
    rawParsed = JSON.parse(jsonArray)
  } catch {
    throw new Error(`Failed to parse translation response as JSON. Model output: ${text.slice(0, 800)}`)
  }

  // Accept both "translatedText" (expected) and "text" (AI sometimes mirrors input key)
  const result = rawParsed.map((item: { id: string; translatedText?: string; text?: string }) => ({
    id: String(item.id),
    translatedText: String(item.translatedText ?? item.text ?? ""),
  }))

  const allEmpty = result.every((r: TranslatedUnit) => !r.translatedText.trim())
  if (allEmpty) {
    throw new Error("Translation response returned empty translations for all units")
  }
  return result
}
