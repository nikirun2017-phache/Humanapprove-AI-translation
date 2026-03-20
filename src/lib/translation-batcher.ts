import type { SourceUnit } from "./source-parser"

// Used only for non-XLIFF formats (JSON, CSV, Markdown, PDF).
// XLIFF files use markdown-based batching in xliff-markdown.ts instead.
export const BATCH_SIZE = 50
export const BATCH_CHAR_LIMIT = 8000

/**
 * Splits an array of source units into batches suitable for a single LLM call.
 * Each batch has at most BATCH_SIZE units and BATCH_CHAR_LIMIT total source chars.
 */
export function chunkUnits(units: SourceUnit[]): SourceUnit[][] {
  const batches: SourceUnit[][] = []
  let current: SourceUnit[] = []
  let charCount = 0

  for (const unit of units) {
    const len = unit.sourceText.length
    if (
      current.length > 0 &&
      (current.length >= BATCH_SIZE || charCount + len > BATCH_CHAR_LIMIT)
    ) {
      batches.push(current)
      current = []
      charCount = 0
    }
    current.push(unit)
    charCount += len
  }
  if (current.length > 0) batches.push(current)
  return batches
}
