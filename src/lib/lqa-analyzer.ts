/**
 * LQA Analyzer — AI-powered translation quality assessment.
 *
 * Token-optimization strategy:
 * 1. Compact JSON I/O: {"id","s","t"} instead of verbose multi-line text
 * 2. Sparse AI output: only units WITH errors are returned (saves ~60% output tokens)
 * 3. Batch size 25 units/call: balances latency vs. token usage
 * 4. Anthropic prompt caching: fixed system prompt is marked cache_control=ephemeral
 *    (5-min TTL, saves ~70% on system prompt tokens for large files with multiple batches)
 * 5. Provider-agnostic: falls back to non-cached path for OpenAI / Gemini / DeepSeek
 */

import type { BilingualUnit } from "./lqa-bilingual-parser"

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ErrorType = "acc" | "lang" | "style"

export interface LqaError {
  type: ErrorType
  description: string // what is wrong (≤150 chars)
  suggestion: string  // how to fix it  (≤200 chars)
}

export interface LqaFinding {
  unitId: string
  sourceText: string
  targetText: string
  errors: LqaError[]
}

export interface LqaAnalysisResult {
  qualityScore: number      // 0–100
  qualityBand: "High" | "Medium" | "Low"
  accuracyErrors: number
  languageErrors: number
  styleErrors: number
  findings: LqaFinding[]
}

// ─── Prompt (fixed — ideal for Anthropic caching) ─────────────────────────────

const SYSTEM_PROMPT = `You are an expert translation quality evaluator. Evaluate source→target translation pairs.

Error categories and point deductions:
- ACCURACY (acc, -3 pts): mistranslations, missing/added information, wrong technical terms, number/date errors
- LANGUAGE (lang, -2 pts): grammar, spelling, punctuation, incorrect terminology
- STYLE (style, -1 pt): unnatural phrasing, awkward structure, poor readability, overly literal

Scoring: Start at 100. Deduct points per error. Minimum 0.

Input format (JSON):
{"src":"<source-lang>","tgt":"<target-lang>","units":[{"id":"<id>","s":"<source>","t":"<target>"},...]}

Output format (JSON array, ONLY units that have errors — omit units with no errors):
[{"id":"<unit-id>","errs":[{"t":"acc|lang|style","d":"<what is wrong, ≤120 chars>","f":"<suggested correction, ≤180 chars>"}]}]

Rules:
- Return ONLY valid JSON, no markdown fences, no explanations
- Omit units with no errors entirely (do NOT include them as empty)
- Keep descriptions concise and actionable
- If the target is empty/missing, report as ACCURACY error: "Translation missing"
- One JSON array as the entire response`

// ─── Helpers ───────────────────────────────────────────────────────────────────

const BATCH_SIZE = 25

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

interface AiError {
  id: string
  errs: Array<{ t: string; d: string; f: string }>
}

function parseAiResponse(raw: string): AiError[] {
  // Strip markdown fences if present
  let text = raw.trim()
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "")
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed as AiError[]
  } catch {
    // Try extracting JSON array from response
    const match = text.match(/\[[\s\S]*\]/)
    if (match) {
      try { return JSON.parse(match[0]) as AiError[] } catch { /* ignore */ }
    }
  }
  return []
}

// ─── AI call — Anthropic (with prompt caching) ────────────────────────────────

async function callAnthropic(
  batchPayload: string,
  apiKey: string,
  model: string
): Promise<string> {
  const body = {
    model,
    max_tokens: 4096,
    temperature: 0, // deterministic — same file must produce the same findings every run
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" }, // cache system prompt across batches
      },
    ],
    messages: [{ role: "user", content: batchPayload }],
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(60_000),
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  return data.content.find((b) => b.type === "text")?.text ?? ""
}

// ─── AI call — OpenAI compatible (OpenAI / DeepSeek) ──────────────────────────

async function callOpenAI(
  batchPayload: string,
  apiKey: string,
  model: string,
  baseUrl = "https://api.openai.com/v1"
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(60_000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: batchPayload },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ""
}

// ─── AI call — Gemini ─────────────────────────────────────────────────────────

async function callGemini(
  batchPayload: string,
  apiKey: string,
  model: string
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      signal: AbortSignal.timeout(60_000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: batchPayload }], role: "user" }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4096, temperature: 0 },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>
  }
  return data.candidates[0]?.content?.parts[0]?.text ?? ""
}

// ─── Dispatch to correct provider ─────────────────────────────────────────────

async function callProvider(
  payload: string,
  apiKey: string,
  provider: string,
  model: string
): Promise<string> {
  switch (provider) {
    case "anthropic":
      return callAnthropic(payload, apiKey, model)
    case "openai":
      return callOpenAI(payload, apiKey, model)
    case "deepseek":
      return callOpenAI(payload, apiKey, model, "https://api.deepseek.com/v1")
    case "gemini":
      return callGemini(payload, apiKey, model)
    default:
      return callOpenAI(payload, apiKey, model)
  }
}

// ─── Main analysis function ───────────────────────────────────────────────────

export async function analyzeLqa(
  units: BilingualUnit[],
  sourceLanguage: string,
  targetLanguage: string,
  apiKey: string,
  provider: string,
  model: string
): Promise<LqaAnalysisResult> {
  const batches = chunkArray(units, BATCH_SIZE)
  const allFindings: LqaFinding[] = []
  let totalAccuracy = 0
  let totalLanguage = 0
  let totalStyle = 0

  let batchesAttempted = 0
  let batchesFailed = 0
  let lastBatchError: string | null = null

  for (const batch of batches) {
    // Use opaque sequential keys ("1", "2", …) instead of real unit IDs.
    // Real IDs like "title#2" contain patterns (the #N deduplication suffix) that
    // cause the AI to treat them as variants of the same unit and cross-contaminate
    // findings across independent translation units that happen to share a base ID.
    const keyToUnit = new Map<string, BilingualUnit>()
    const aiUnits = batch.map((u, i) => {
      const key = String(i + 1)
      keyToUnit.set(key, u)
      return { id: key, s: u.source, t: u.target || "" }
    })

    const payload = JSON.stringify({ src: sourceLanguage, tgt: targetLanguage, units: aiUnits })

    batchesAttempted++
    let rawResponse = ""
    try {
      rawResponse = await callProvider(payload, apiKey, provider, model)
    } catch (err) {
      batchesFailed++
      lastBatchError = (err as Error).message
      console.error(`[lqa-analyzer] batch error:`, err)
      continue
    }

    const aiErrors = parseAiResponse(rawResponse)
    // unitMap still keyed by the opaque key so lookups work correctly
    const unitMap = keyToUnit

    for (const item of aiErrors) {
      const unit = unitMap.get(String(item.id))
      if (!unit || !Array.isArray(item.errs) || item.errs.length === 0) continue

      const errors: LqaError[] = item.errs.map((e) => ({
        type: (["acc", "lang", "style"].includes(e.t) ? e.t : "lang") as ErrorType,
        description: String(e.d ?? "").slice(0, 200),
        suggestion: String(e.f ?? "").slice(0, 250),
      }))

      for (const e of errors) {
        if (e.type === "acc") totalAccuracy++
        else if (e.type === "lang") totalLanguage++
        else totalStyle++
      }

      allFindings.push({
        unitId: unit.id,
        sourceText: unit.source,
        targetText: unit.target,
        errors,
      })
    }
  }

  // If every batch failed, surface the error instead of returning a fake perfect score
  if (batchesAttempted > 0 && batchesFailed === batchesAttempted) {
    throw new Error(
      `AI analysis failed for all ${batchesAttempted} batch${batchesAttempted !== 1 ? "es" : ""}. ` +
      `Last error: ${lastBatchError ?? "unknown error"}`
    )
  }

  // Normalize score by total units so large files aren't unfairly penalized.
  // Formula: deduct 2.5 pts per "1 weighted error per 100 units".
  //   • score 95+ → High  (< ~2 weighted errors per 100 units)
  //   • score 85+ → Medium
  //   • score  <85 → Low  (> ~6 weighted errors per 100 units)
  const totalUnits = units.length
  const weightedErrors = totalAccuracy * 3 + totalLanguage * 2 + totalStyle
  const errorsPer100 = totalUnits > 0 ? (weightedErrors / totalUnits) * 100 : 0
  const qualityScore = Math.max(0, Math.round(100 - errorsPer100 * 2.5))
  const qualityBand: LqaAnalysisResult["qualityBand"] =
    qualityScore >= 95 ? "High" : qualityScore >= 85 ? "Medium" : "Low"

  return {
    qualityScore,
    qualityBand,
    accuracyErrors: totalAccuracy,
    languageErrors: totalLanguage,
    styleErrors: totalStyle,
    findings: allFindings,
  }
}
