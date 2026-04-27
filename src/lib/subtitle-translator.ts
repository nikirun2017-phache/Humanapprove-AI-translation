/**
 * Subtitle translator — AI-powered translation of parsed subtitle entries.
 *
 * Batches entries (30 per API call) and sends them to Anthropic Claude.
 * The numbered [1]…[N] protocol keeps timing metadata out of the prompt,
 * which reduces token usage and eliminates any risk of the AI modifying timestamps.
 *
 * Returns a TranslationResult containing:
 *  - translatedFile: full rebuilt subtitle file ready to save/download
 *  - previewEntries: first 20 entries (timestamp + original + translated) for UI preview
 */

import { parseSubtitle, buildSubtitle } from "./subtitle-parser"
import type { SubtitleEntry } from "./subtitle-parser"

const BATCH_SIZE = 30

const SYSTEM_PROMPT = `You are a professional subtitle translator. Translate subtitle text segments accurately and naturally so they fit comfortably on screen.

Input format — one segment per line, prefixed by its index:
[1] subtitle text here
[2] another subtitle here
...

Output format — ONLY the translated segments in the same indexed format:
[1] translated text
[2] translated text
...

Rules:
- Return EVERY input segment — never skip, merge, or split entries
- Keep translations concise — subtitles must be readable on screen in the same time as the original
- Preserve speaker markers like >> or – at the start of a line
- Keep proper names, brand names, and technical terms accurate
- Do NOT add parenthetical explanations, notes, or any extra text
- Return ONLY the numbered translations — nothing else`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function translateBatch(
  entries: SubtitleEntry[],
  targetLanguage: string,
  apiKey: string
): Promise<string[]> {
  // Join multi-line cues into a single line for the prompt — the AI translates the meaning.
  const numbered = entries
    .map((e, i) => `[${i + 1}] ${e.text.replace(/\n/g, " ")}`)
    .join("\n")

  const userMessage = `Translate the following subtitle segments to ${targetLanguage}:\n\n${numbered}`

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "prompt-caching-2024-07-31",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      temperature: 0,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    }),
  })

  if (!res.ok) {
    throw new Error(
      `Anthropic ${res.status}: ${await res.text().then((t) => t.slice(0, 200))}`
    )
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text: string }>
  }
  const raw = data.content.find((b) => b.type === "text")?.text ?? ""

  // Parse [1] … [2] … pattern — fall back to original text on parse failure
  return entries.map((entry, i) => {
    const idx = i + 1
    const re = new RegExp(`\\[${idx}\\]\\s*([\\s\\S]*?)(?=\\[${idx + 1}\\]|$)`)
    const m = raw.match(re)
    return m ? m[1].trim() : entry.text
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface PreviewEntry {
  timestamp: string
  original: string
  translated: string
}

export interface TranslationResult {
  translatedFile: string
  totalEntries: number
  previewEntries: PreviewEntry[]
}

export async function translateSubtitleFile(
  content: string,
  format: "srt" | "vtt",
  targetLanguage: string,
  apiKey: string
): Promise<TranslationResult> {
  const parsed = parseSubtitle(content, format)

  if (parsed.entries.length === 0) {
    throw new Error("No subtitle entries found in the file — check the file format.")
  }

  const batches = chunk(parsed.entries, BATCH_SIZE)
  const allTranslations: string[] = []

  for (const batch of batches) {
    const translations = await translateBatch(batch, targetLanguage, apiKey)
    allTranslations.push(...translations)
  }

  const translatedFile = buildSubtitle(parsed, allTranslations)

  const previewEntries: PreviewEntry[] = parsed.entries.slice(0, 20).map((e, i) => ({
    timestamp: e.timestamp,
    original: e.text,
    translated: allTranslations[i] ?? e.text,
  }))

  return {
    translatedFile,
    totalEntries: parsed.entries.length,
    previewEntries,
  }
}
