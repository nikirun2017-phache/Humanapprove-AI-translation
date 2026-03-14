import type { AIProvider, TranslationBatch, TranslationResult, TranslatedUnit } from "./types"

const SYSTEM_PROMPT = `You are a professional translator. Translate the provided JSON array of strings from {SOURCE} to {TARGET}.
Rules:
- Return ONLY a valid JSON array of objects with "id" and "translatedText" fields.
- Preserve all placeholders like {variable}, {{variable}}, %s, %d, <tag>, HTML entities.
- Keep the same tone and formality as the source.
- Do not add explanations or notes outside the JSON.`

export const anthropicProvider: AIProvider = {
  name: "anthropic",

  async translate(batch: TranslationBatch, apiKey: string, model: string): Promise<TranslationResult> {
    const systemPrompt = SYSTEM_PROMPT
      .replace("{SOURCE}", batch.sourceLanguage)
      .replace("{TARGET}", batch.targetLanguage)

    const userContent = JSON.stringify(
      batch.units.map((u) => ({ id: u.id, text: u.sourceText }))
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
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Translate these strings to ${batch.targetLanguage}:\n${userContent}`,
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
    }
    const text = data.content.find((c) => c.type === "text")?.text ?? ""
    return { units: parseTranslationResponse(text, batch.units) }
  },
}

function parseTranslationResponse(
  text: string,
  originalUnits: TranslationBatch["units"]
): TranslatedUnit[] {
  // Extract JSON array from the response (handles markdown code fences)
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    // Fallback: return empty translations
    return originalUnits.map((u) => ({ id: u.id, translatedText: u.sourceText }))
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { id: string; translatedText: string }[]
    return parsed.map((item) => ({
      id: String(item.id),
      translatedText: String(item.translatedText ?? ""),
    }))
  } catch {
    return originalUnits.map((u) => ({ id: u.id, translatedText: u.sourceText }))
  }
}
