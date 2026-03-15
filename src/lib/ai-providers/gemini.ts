import type { AIProvider, TranslationBatch, TranslationResult, TranslatedUnit } from "./types"

const SYSTEM_PROMPT = `You are a professional translator. Translate the provided JSON array of strings from {SOURCE} to {TARGET}.
Rules:
- Return ONLY a valid JSON array of objects with "id" and "translatedText" fields.
- Preserve all placeholders like {variable}, {{variable}}, %s, %d, <tag>, HTML entities.
- Keep the same tone and formality as the source.
- Do not add explanations or notes outside the JSON.`

export const geminiProvider: AIProvider = {
  name: "gemini",

  async translate(batch: TranslationBatch, apiKey: string, model: string): Promise<TranslationResult> {
    const systemPrompt = SYSTEM_PROMPT
      .replace("{SOURCE}", batch.sourceLanguage)
      .replace("{TARGET}", batch.targetLanguage)

    const userContent = JSON.stringify(
      batch.units.map((u) => ({ id: u.id, text: u.sourceText }))
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

function parseResponse(text: string, original: TranslationBatch["units"]): TranslatedUnit[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error(`Translation response did not contain a JSON array. Model output: ${text.slice(0, 300)}`)
  }
  const parsed = JSON.parse(jsonMatch[0]) as { id: string; translatedText: string }[]
  const result = parsed.map((item) => ({
    id: String(item.id),
    translatedText: String(item.translatedText ?? ""),
  }))
  const allEmpty = result.every((r) => !r.translatedText.trim())
  if (allEmpty) throw new Error("Translation response returned empty translations for all units")
  return result
}
