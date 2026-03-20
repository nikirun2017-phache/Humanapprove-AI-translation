import type { SourceUnit } from "./source-parser"

/**
 * Max source characters per markdown batch.
 * At ~4 chars/token: 12 000 chars ≈ 3 000 input tokens.
 * Translated output is similar in length, well within max_tokens: 16 000.
 * Smaller batches reduce the probability that the AI silently skips units.
 */
const MARKDOWN_BATCH_CHARS = 12_000

export interface MarkdownBatch {
  /** The markdown document to send to the AI */
  markdown: string
  /** Maps the numeric index string ("0", "1", …) back to the real unit ID */
  indexToId: Map<string, string>
}

/**
 * Convert source units into markdown batches for AI translation.
 *
 * Section IDs are short integers ("0", "1", …) — NOT the real XLIFF unit IDs.
 * This prevents the AI from mangling long, complex IDs (which contain ":", "|", etc.)
 * while translating to languages that may substitute full-width punctuation.
 * The `indexToId` map is used after translation to recover the real unit IDs.
 *
 * Format:
 *   ## §0§
 *   source text
 *
 *   ## §1§
 *   source text 2
 */
export function buildMarkdownBatches(units: SourceUnit[]): MarkdownBatch[] {
  const batches: MarkdownBatch[] = []
  let current = ""
  let indexToId = new Map<string, string>()
  let batchIndex = 0

  for (const unit of units) {
    // Strip residual XML tags (safety net for units saved before the redesign)
    const text = unit.sourceText
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
    if (!text) continue

    const block = `## §${batchIndex}§\n${text}\n\n`
    if (current.length > 0 && current.length + block.length > MARKDOWN_BATCH_CHARS) {
      batches.push({ markdown: current.trimEnd(), indexToId })
      current = ""
      indexToId = new Map()
      batchIndex = 0
    }
    indexToId.set(String(batchIndex), unit.id)
    batchIndex++
    current += block
  }

  if (current.trim()) batches.push({ markdown: current.trimEnd(), indexToId })
  return batches
}

/**
 * Parse an AI-translated markdown document.
 * Returns a Map from numeric index string ("0", "1", …) to translated text.
 *
 * Robust against:
 *   - Leading preamble text before the first marker
 *   - Extra blank lines between marker and content
 *   - Trailing notes after the last section
 */
export function parseMarkdownTranslation(markdown: string): Map<string, string> {
  const map = new Map<string, string>()
  const lines = markdown.split("\n")
  let currentIndex: string | null = null
  let currentLines: string[] = []

  const flush = () => {
    if (currentIndex !== null) {
      const text = currentLines.join("\n").trim()
      if (text) map.set(currentIndex, text)
    }
  }

  for (const line of lines) {
    // Match: ## §N§  (where N is a number)
    const m = line.match(/^##\s+§(\d+)§\s*$/)
    if (m) {
      flush()
      currentIndex = m[1]
      currentLines = []
    } else if (currentIndex !== null) {
      currentLines.push(line)
    }
  }
  flush()

  return map
}
