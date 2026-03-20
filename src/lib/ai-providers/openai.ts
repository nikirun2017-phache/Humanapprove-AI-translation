import type { AIProvider, TranslationBatch, TranslationResult, TranslatedUnit, SourceUnit } from "./types"

const SYSTEM_PROMPT = `You are a professional translator. Translate the provided JSON array of strings from {SOURCE} to {TARGET}.
Rules:
- Return ONLY a valid JSON array of objects with "id" and "translatedText" fields. No markdown fences, no extra text.
- Tokens like {{T1}}, {{T2}}, {{T3}}, etc. are XLIFF formatting placeholders. Copy them EXACTLY as-is in the translated text, keeping their position relative to the surrounding words. Never drop, duplicate, or alter any {{T…}} token.
- Preserve all other placeholders exactly: {variable}, {{variable}}, %s, %d, HTML entities (&amp; &#x2019; &#x2014; etc.).
- Keep the same tone and formality as the source.
- Do not add explanations or notes outside the JSON.`

function buildProvider(baseUrl: string, providerName: "openai" | "deepseek"): AIProvider {
  return {
    name: providerName,

    async translate(batch: TranslationBatch, apiKey: string, model: string): Promise<TranslationResult> {
      const systemPrompt = SYSTEM_PROMPT
        .replace("{SOURCE}", batch.sourceLanguage)
        .replace("{TARGET}", batch.targetLanguage)

      const userContent = JSON.stringify(
        batch.units.map((u: SourceUnit) => ({ id: u.id, text: u.sourceText }))
      )

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Translate these strings to ${batch.targetLanguage}. Return JSON with a "translations" array:\n${userContent}`,
            },
          ],
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        throw new Error(`${providerName} API error ${response.status}: ${err}`)
      }

      const data = await response.json() as {
        choices: { message: { content: string } }[]
      }
      const text = data.choices[0]?.message?.content ?? ""
      return { units: parseResponse(text, batch.units) }
    },
  }
}

function parseResponse(text: string, original: TranslationBatch["units"]): TranslatedUnit[] {
  const parsed = JSON.parse(text) as Record<string, unknown>
  // Handle { "translations": [...] } or direct array
  const arr = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.translations)
      ? (parsed.translations as unknown[])
      : []
  if (arr.length === 0) {
    throw new Error(`Translation response contained no items. Model output: ${text.slice(0, 300)}`)
  }
  const result = (arr as { id: string; translatedText: string }[]).map((item: { id: string; translatedText: string }) => ({
    id: String(item.id),
    translatedText: String(item.translatedText ?? ""),
  }))
  const allEmpty = result.every((r: TranslatedUnit) => !r.translatedText.trim())
  if (allEmpty) throw new Error("Translation response returned empty translations for all units")
  return result
}

export const openaiProvider = buildProvider("https://api.openai.com/v1", "openai")
export const deepseekProvider = buildProvider("https://api.deepseek.com/v1", "deepseek")
