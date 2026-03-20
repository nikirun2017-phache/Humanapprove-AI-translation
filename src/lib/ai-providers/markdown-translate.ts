import type { ProviderName } from "./types"

/**
 * System prompt for markdown-format translation.
 * The AI receives a plain markdown document with §ID§ section markers and
 * returns the translated document with identical markers.
 * No JSON involved — eliminates all JSON/XML escaping issues.
 */
const SYSTEM_PROMPT = `You are a professional translator. Translate the content below from {SOURCE} to {TARGET}.

Rules:
- The content uses section markers in the format: ## §section-id§
- Translate ONLY the text that follows each marker
- Keep ALL section markers (## §section-id§) EXACTLY as-is — same ## prefix, same § characters, same id
- IMPORTANT: You MUST output a translated section for EVERY input section without exception.
  Never skip a section even if it contains dates, codes, abbreviations, product names, or technical terms.
  If a term should stay in English, write it in the translated sentence as-is.
- Never add, remove, merge, or reorder sections
- Preserve placeholders like {variable}, {{variable}}, %s, %d and HTML entities (&amp; &#x2019; &#x2014; etc.)
- Keep the same tone and formality as the source
- Return ONLY the translated content in the same marker format — no explanations, no extra text`

/**
 * Translate a markdown batch document and return the translated markdown.
 *
 * Input:  ## §unit-id§\nsource text\n\n## §unit-id-2§\nsource text 2
 * Output: ## §unit-id§\ntranslated text\n\n## §unit-id-2§\ntranslated text 2
 *
 * This is the core of the XLIFF translation pipeline. Using a plain text markdown
 * format instead of JSON arrays eliminates the JSON/XML quoting conflict that
 * caused repeated parse failures when translating XML-heavy XLIFF files.
 */
export async function translateMarkdownBatch(
  markdown: string,
  sourceLanguage: string,
  targetLanguage: string,
  provider: ProviderName,
  apiKey: string,
  model: string
): Promise<string> {
  const systemPrompt = SYSTEM_PROMPT
    .replace("{SOURCE}", sourceLanguage)
    .replace("{TARGET}", targetLanguage)

  switch (provider) {
    case "anthropic":
      return callAnthropic(markdown, systemPrompt, model, apiKey)
    case "openai":
      return callOpenAICompat(markdown, systemPrompt, model, apiKey, "https://api.openai.com/v1")
    case "deepseek":
      return callOpenAICompat(markdown, systemPrompt, model, apiKey, "https://api.deepseek.com/v1")
    case "gemini":
      return callGemini(markdown, systemPrompt, model, apiKey)
    default:
      throw new Error(`Unsupported provider for markdown translation: ${provider}`)
  }
}

async function callAnthropic(
  markdown: string,
  systemPrompt: string,
  model: string,
  apiKey: string
): Promise<string> {
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
      messages: [{ role: "user", content: markdown }],
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

  if (data.stop_reason === "max_tokens") {
    throw new Error("Markdown batch too large (max_tokens reached). This batch will be split automatically on retry.")
  }

  return data.content.find((c) => c.type === "text")?.text ?? ""
}

async function callOpenAICompat(
  markdown: string,
  systemPrompt: string,
  model: string,
  apiKey: string,
  baseUrl: string
): Promise<string> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: markdown },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${err}`)
  }

  const data = await response.json() as {
    choices: { message: { content: string } }[]
  }
  return data.choices[0]?.message?.content ?? ""
}

async function callGemini(
  markdown: string,
  systemPrompt: string,
  model: string,
  apiKey: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: markdown }] }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${err}`)
  }

  const data = await response.json() as {
    candidates: { content: { parts: { text: string }[] } }[]
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
}
