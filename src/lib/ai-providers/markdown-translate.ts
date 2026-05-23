import type { ProviderName, GlossaryTerm } from "./types"
import { buildGlossaryPromptSection } from "./anthropic"

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

export interface MarkdownBatchResult {
  text: string
  inputTokens: number
  outputTokens: number
}

/**
 * Translate a markdown batch document and return the translated markdown
 * together with the actual token counts reported by the provider.
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
  model: string,
  glossaryTerms?: GlossaryTerm[]
): Promise<MarkdownBatchResult> {
  const glossarySection = glossaryTerms ? buildGlossaryPromptSection(glossaryTerms) : ""
  // Inject glossary BEFORE "Rules:" so it outranks the default abbreviation-handling rule
  const basePrompt = SYSTEM_PROMPT
    .replace("{SOURCE}", sourceLanguage)
    .replace("{TARGET}", targetLanguage)
  const systemPrompt = glossarySection
    ? basePrompt.replace("Rules:\n", `${glossarySection}\nRules:\n`)
    : basePrompt

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

// 90 s per AI call — catches hanging providers without timing out legitimate large batches.
// withRetry treats AbortError as retryable so transient hangs are retried automatically.
const AI_CALL_TIMEOUT_MS = 90_000

async function callAnthropic(
  markdown: string,
  systemPrompt: string,
  model: string,
  apiKey: string
): Promise<MarkdownBatchResult> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(AI_CALL_TIMEOUT_MS),
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
    usage?: { input_tokens: number; output_tokens: number }
  }

  if (data.stop_reason === "max_tokens") {
    throw new Error("Markdown batch too large (max_tokens reached). This batch will be split automatically on retry.")
  }

  return {
    text: data.content.find((c: { type: string; text: string }) => c.type === "text")?.text ?? "",
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  }
}

async function callOpenAICompat(
  markdown: string,
  systemPrompt: string,
  model: string,
  apiKey: string,
  baseUrl: string
): Promise<MarkdownBatchResult> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(AI_CALL_TIMEOUT_MS),
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
    usage?: { prompt_tokens: number; completion_tokens: number }
  }
  return {
    text: data.choices[0]?.message?.content ?? "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  }
}

async function callGemini(
  markdown: string,
  systemPrompt: string,
  model: string,
  apiKey: string
): Promise<MarkdownBatchResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const response = await fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(AI_CALL_TIMEOUT_MS),
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
    usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number }
  }
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  }
}
