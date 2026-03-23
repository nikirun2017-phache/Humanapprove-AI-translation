import type { AIProvider, TranslationBatch, TranslationResult, TranslatedUnit, SourceUnit } from "./types"
import { buildGlossaryPromptSection } from "./anthropic"

const SYSTEM_PROMPT = `You are a professional translator. Translate the provided JSON array of strings from {SOURCE} to {TARGET}.
Rules:
- Return ONLY a valid JSON array of objects with "id" and "translatedText" fields. No markdown fences, no extra text.
- Tokens like {{T1}}, {{T2}}, {{T3}}, etc. are XLIFF formatting placeholders. Copy them EXACTLY as-is in the translated text, keeping their position relative to the surrounding words. Never drop, duplicate, or alter any {{T…}} token.
- Preserve all other placeholders exactly: {variable}, {{variable}}, %s, %d, HTML entities (&amp; &#x2019; &#x2014; etc.).
- Keep the same tone and formality as the source.
- Do not add explanations or notes outside the JSON.`

export const geminiProvider: AIProvider = {
  name: "gemini",

  async translate(batch: TranslationBatch, apiKey: string, model: string): Promise<TranslationResult> {
    const glossarySection = batch.glossaryTerms ? buildGlossaryPromptSection(batch.glossaryTerms) : ""
    const systemPrompt = (SYSTEM_PROMPT + glossarySection)
      .replace("{SOURCE}", batch.sourceLanguage)
      .replace("{TARGET}", batch.targetLanguage)

    const userContent = JSON.stringify(
      batch.units.map((u: SourceUnit) => ({ id: u.id, text: u.sourceText }))
    )

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Translate these strings to ${batch.targetLanguage}:\n${userContent}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Gemini API error ${response.status}: ${err}`)
    }

    const data = await response.json() as {
      candidates: { content: { parts: { text: string }[] } }[]
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
    return { units: parseResponse(text, batch.units) }
  },
}

function extractJsonArray(text: string): string | null {
  const start = text.indexOf("[")
  if (start === -1) return null
  let depth = 0, inString = false, escaped = false
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

function parseResponse(text: string, original: TranslationBatch["units"]): TranslatedUnit[] {
  const jsonArray = extractJsonArray(text)
  if (!jsonArray) {
    throw new Error(`Translation response did not contain a JSON array. Model output: ${text.slice(0, 300)}`)
  }
  const parsed = JSON.parse(jsonArray) as { id: string; translatedText: string }[]
  const result = parsed.map((item: { id: string; translatedText: string }) => ({
    id: String(item.id),
    translatedText: String(item.translatedText ?? ""),
  }))
  const allEmpty = result.every((r: TranslatedUnit) => !r.translatedText.trim())
  if (allEmpty) throw new Error("Translation response returned empty translations for all units")
  return result
}
