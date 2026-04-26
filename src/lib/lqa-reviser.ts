/**
 * LQA Reviser — AI-powered auto-fix for bilingual files.
 *
 * Workflow:
 * 1. Extract flagged units (those with findings) from the original file
 * 2. Batch them (20/call) and send to AI with their raw XML target content + fix suggestions
 * 3. AI returns corrected target XML — preserving inline markup (<g>, <ph>, etc.)
 * 4. Patch the original XML: replace <target> (XLIFF) or <seg> in target <tuv> (TMX)
 *
 * Token optimization:
 * - Only sends flagged units (not the entire file) to AI
 * - Compact input: [{id,s,cur,fix}]
 * - Sparse output: [{id,t}] — only units that were actually changed
 * - Batches 20 units per API call
 */

import type { LqaFinding } from "./lqa-analyzer"

const REVISION_BATCH_SIZE = 20

// ─── System prompt for revision ───────────────────────────────────────────────

const REVISION_SYSTEM = `You are a professional translation editor making surgical, minimal corrections.

Input: JSON array of units with fix instructions
[{"id":"<unit-id>","s":"<source text>","cur":"<current translation — may contain XML/HTML inline tags like <g id=\"...\">, <ph>, <x/>>","fix":"<description of the error and what to fix>"}]

Output: JSON array containing ALL input units with their corrected translations
[{"id":"<unit-id>","t":"<corrected translation>"}]

Rules:
- You MUST return an entry for EVERY unit in the input — never return an empty array
- MINIMAL CHANGES ONLY: change only the specific word(s) or phrase(s) described in the fix. Do NOT rewrite, reorder, or paraphrase the rest of the translation — untouched parts must remain byte-for-byte identical to "cur"
- Do NOT "improve" phrasing beyond what is asked. Do NOT change style, tone, or structure unless the fix explicitly requires it
- If fix says "should be X", use X exactly; if it describes a correction, apply the narrowest change that satisfies it
- CRITICAL: Preserve ALL XML/HTML tags and attributes (e.g. <g id="...">, <ph id="...">, <x/>, <bpt>, <ept>) exactly as they appear — only modify the human-readable text between the tags
- Keep formatting placeholders ({var}, %s, {{T1}}, %1$s etc.) intact
- If the fix has already been applied or the suggestion is ambiguous, return "cur" unchanged
- Return ONLY valid JSON array, no markdown fences, no explanations`

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

interface RevisionItem { id: string; t: string }

function parseRevisionResponse(raw: string): RevisionItem[] {
  let text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "")
  let arr: unknown
  try {
    const parsed = JSON.parse(text)
    arr = Array.isArray(parsed) ? parsed : null
  } catch { /* try fallback */ }
  if (!arr) {
    const match = text.match(/\[[\s\S]*\]/)
    if (match) {
      try { arr = JSON.parse(match[0]) } catch { /* ignore */ }
    }
  }
  if (!Array.isArray(arr)) return []

  return (arr as Record<string, unknown>[])
    .map((item) => ({
      // Always coerce id to string — models often return integer 1 instead of "1"
      id: String(item["id"] ?? ""),
      // Accept any field name the model might use for the translated text
      t: String(
        item["t"] ??
        item["translation"] ??
        item["text"] ??
        item["revised"] ??
        item["target"] ??
        item["translatedText"] ??
        ""
      ),
    }))
    .filter((r): r is RevisionItem => Boolean(r.id && r.t))
}

// ─── Raw XML extraction helpers ───────────────────────────────────────────────

/**
 * Extract the raw inner content of the <target> element for a given XLIFF unit.
 * Supports XLIFF 1.2 (<trans-unit id="X">) and XLIFF 2.0 (<unit id="X">).
 * Returns empty string if the unit cannot be located.
 */
function extractRawXliffTarget(xml: string, unitId: string): string {
  const hashMatch = unitId.match(/^([\s\S]+)#(\d+)$/)
  const rawId = hashMatch ? hashMatch[1] : unitId
  const occurrence = hashMatch ? parseInt(hashMatch[2], 10) : 1
  const escapedId = rawId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

  // id attribute may use double OR single quotes (both are valid XML)
  const idAttr = `id=["']${escapedId}["']`
  // Element names may carry a namespace prefix (e.g. <xliff:target>, <ns:trans-unit>)
  const tgtOpen = `<(?:[\\w]+:)?target(?:[^>]*)>`
  const tgtClose = `</(?:[\\w]+:)?target>`

  // XLIFF 1.2: <trans-unit id="X">…<target…>CONTENT</target>
  const re12 = new RegExp(
    `<(?:[\\w]+:)?trans-unit[^>]*\\b${idAttr}[^>]*>[\\s\\S]*?${tgtOpen}([\\s\\S]*?)${tgtClose}`,
    "g"
  )
  let n = 0
  let m: RegExpExecArray | null
  while ((m = re12.exec(xml)) !== null) {
    n++
    if (n === occurrence) return m[1]
  }

  // XLIFF 2.0: <unit id="X">…<target…>CONTENT</target>
  const re20 = new RegExp(
    `<(?:[\\w]+:)?unit[^>]*\\b${idAttr}[^>]*>[\\s\\S]*?${tgtOpen}([\\s\\S]*?)${tgtClose}`,
    "g"
  )
  n = 0
  while ((m = re20.exec(xml)) !== null) {
    n++
    if (n === occurrence) return m[1]
  }

  return ""
}

/**
 * Extract the raw inner content of the <seg> element inside the target-language <tuv>
 * for a given TMX translation unit.
 *
 * Two cases:
 *  • Named unit  — <tu tuid="X"> — locate by attribute value
 *  • Anonymous unit — <tu> (no tuid/id) — parser assigns "tu_N" (0-based); locate by
 *    counting <tu> blocks in document order, skipping those with empty source segments
 *    to mirror parseTmx's orderIdx logic exactly.
 */
function extractRawTmxTarget(xml: string, tuId: string, targetLanguage: string): string {
  const hashMatch = tuId.match(/^([\s\S]+)#(\d+)$/)
  const rawId = hashMatch ? hashMatch[1] : tuId
  const occurrence = hashMatch ? parseInt(hashMatch[2], 10) : 1

  const langSegRe = new RegExp(
    `<tuv[^>]*xml:lang="${targetLanguage}"[^>]*>[\\s\\S]*?<seg>([\\s\\S]*?)<\\/seg>`,
    "i"
  )
  // Matches every <tu>…</tu> block (TMX <tu> elements never nest)
  const tuBlockRe = /<tu(?:\s[^>]*)?>[\s\S]*?<\/tu>/g

  // ── Positional ID (anonymous <tu> with no tuid attribute) ──────────────────
  const positionalMatch = rawId.match(/^tu_(\d+)$/)
  if (positionalMatch) {
    const targetIdx = parseInt(positionalMatch[1], 10)
    let nonEmptyCount = 0
    let m: RegExpExecArray | null
    while ((m = tuBlockRe.exec(xml)) !== null) {
      // Mirror parseTmx: only count units whose first <seg> is non-empty
      const firstSeg = m[0].match(/<seg>([\s\S]*?)<\/seg>/)
      if (!firstSeg || !firstSeg[1].trim()) continue
      if (nonEmptyCount === targetIdx) {
        const lm = m[0].match(langSegRe)
        return lm ? lm[1] : ""
      }
      nonEmptyCount++
    }
    return ""
  }

  // ── Named ID (<tu tuid="X"> or <tu id="X">) ───────────────────────────────
  const escapedId = rawId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const namedRe = new RegExp(
    `<tu[^>]*(?:tuid|id)=["']${escapedId}["'][^>]*>[\\s\\S]*?<\\/tu>`,
    "g"
  )
  let n = 0
  let m: RegExpExecArray | null
  while ((m = namedRe.exec(xml)) !== null) {
    n++
    if (n === occurrence) {
      const lm = m[0].match(langSegRe)
      return lm ? lm[1] : ""
    }
  }
  return ""
}

// ─── AI call ──────────────────────────────────────────────────────────────────

async function callRevisionApi(
  payload: string,
  apiKey: string,
  provider: string,
  model: string
): Promise<string> {
  const timeout = AbortSignal.timeout(60_000)

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: timeout,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0,
        system: [
          {
            type: "text",
            text: REVISION_SYSTEM,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: payload }],
      }),
    })
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text().then((t) => t.slice(0, 200))}`)
    const data = await res.json() as { content: Array<{ type: string; text: string }> }
    return data.content.find((b) => b.type === "text")?.text ?? ""
  }

  if (provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        signal: timeout,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: REVISION_SYSTEM }] },
          contents: [{ parts: [{ text: payload }], role: "user" }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4096 },
        }),
      }
    )
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text().then((t) => t.slice(0, 200))}`)
    const data = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> }
    return data.candidates[0]?.content?.parts[0]?.text ?? ""
  }

  // OpenAI / DeepSeek
  const baseUrl = provider === "deepseek" ? "https://api.deepseek.com/v1" : "https://api.openai.com/v1"
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    signal: timeout,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        { role: "system", content: REVISION_SYSTEM },
        { role: "user", content: payload },
      ],
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text().then((t) => t.slice(0, 200))}`)
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ""
}

// ─── XML patching ─────────────────────────────────────────────────────────────

/**
 * Patch XLIFF: replace content of <target> elements for the given unit IDs.
 * Handles both XLIFF 1.2 (<trans-unit id="X"><target>…</target>) and
 * XLIFF 2.0 (<unit id="X">…<target>…</target>).
 *
 * The replacement value is raw XML (AI-returned, already valid) — no escaping applied.
 * In XLIFF 1.2 schema, <alt-trans> always appears AFTER </target>, so a simple
 * lazy [\s\S]*? reliably stops at the first </target> closing the main target.
 */
function patchXliff(xml: string, fixes: Map<string, string>): string {
  let result = xml

  for (const [unitId, newTarget] of fixes) {
    // Strip the "#N" occurrence suffix added by the parser for duplicate IDs.
    const hashMatch = unitId.match(/^([\s\S]+)#(\d+)$/)
    const rawId = hashMatch ? hashMatch[1] : unitId
    const occurrence = hashMatch ? parseInt(hashMatch[2], 10) : 1

    const escapedId = rawId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

    // id attribute may use double OR single quotes; element names may have namespace prefix
    const idAttr = `id=["']${escapedId}["']`
    const tgtOpen = `(<(?:[\\w]+:)?target(?:[^>]*)>)`
    const tgtClose = `(</(?:[\\w]+:)?target>)`

    // XLIFF 1.2: <trans-unit id="…"> … <target…>OLD</target>
    const tu12 = new RegExp(
      `(<(?:[\\w]+:)?trans-unit[^>]*\\b${idAttr}[^>]*>[\\s\\S]*?${tgtOpen})[\\s\\S]*?${tgtClose}`,
      "g"
    )
    let n12 = 0
    result = result.replace(tu12, (m, g1, _tgtOpen, g3) => {
      n12++
      return n12 === occurrence ? `${g1}${newTarget}${g3}` : m
    })

    // XLIFF 2.0: <unit id="…"> … <target…>OLD</target>
    if (n12 === 0) {
      const unit20 = new RegExp(
        `(<(?:[\\w]+:)?unit[^>]*\\b${idAttr}[^>]*>[\\s\\S]*?${tgtOpen})[\\s\\S]*?${tgtClose}`,
        "g"
      )
      let n20 = 0
      result = result.replace(unit20, (m, g1, _tgtOpen, g3) => {
        n20++
        return n20 === occurrence ? `${g1}${newTarget}${g3}` : m
      })
    }
  }

  return result
}

/**
 * Patch TMX: replace the <seg> content inside the target-language <tuv>
 * for each translation unit.
 *
 * TMX structure:
 * <tu tuid="X">
 *   <tuv xml:lang="en"><seg>source</seg></tuv>
 *   <tuv xml:lang="zh-CN"><seg>target</seg></tuv>
 * </tu>
 *
 * Two cases:
 *  • Named unit  — <tu tuid="X"> — locate by attribute value
 *  • Anonymous unit — <tu> (no tuid/id) — parser assigns "tu_N" (0-based); locate by
 *    counting <tu> blocks in document order, skipping those with empty source segments
 *    to mirror parseTmx's orderIdx logic exactly.
 *
 * The replacement value is raw XML — no escaping applied.
 */
function patchTmx(
  xml: string,
  fixes: Map<string, string>,
  targetLanguage: string
): string {
  // Separate positional (tu_N) from named (tuid-based) fixes
  const positionalFixes = new Map<number, string>()
  const idFixes = new Map<string, string>()

  for (const [tuId, newTarget] of fixes) {
    const hashMatch = tuId.match(/^([\s\S]+)#(\d+)$/)
    const rawId = hashMatch ? hashMatch[1] : tuId
    const positional = rawId.match(/^tu_(\d+)$/)
    if (positional) {
      positionalFixes.set(parseInt(positional[1], 10), newTarget)
    } else {
      idFixes.set(tuId, newTarget)
    }
  }

  let result = xml

  // ── Apply positional fixes (anonymous <tu> elements without tuid) ───────────
  if (positionalFixes.size > 0) {
    let nonEmptyCount = 0
    result = result.replace(/<tu(?:\s[^>]*)?>[\s\S]*?<\/tu>/g, (match) => {
      // Mirror parseTmx: only count units whose first <seg> is non-empty
      const firstSeg = match.match(/<seg>([\s\S]*?)<\/seg>/)
      if (!firstSeg || !firstSeg[1].trim()) return match
      const idx = nonEmptyCount++
      const newTarget = positionalFixes.get(idx)
      if (newTarget === undefined) return match
      const langPattern = new RegExp(
        `(<tuv[^>]*xml:lang="${targetLanguage}"[^>]*>[\\s\\S]*?<seg>)[\\s\\S]*?(<\\/seg>)`,
        "i"
      )
      return match.replace(langPattern, `$1${newTarget}$2`)
    })
  }

  // ── Apply named ID fixes (<tu tuid="X"> or <tu id="X">) ────────────────────
  for (const [tuId, newTarget] of idFixes) {
    const hashMatch = tuId.match(/^([\s\S]+)#(\d+)$/)
    const rawId = hashMatch ? hashMatch[1] : tuId
    const occurrence = hashMatch ? parseInt(hashMatch[2], 10) : 1

    const escapedId = rawId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

    // Find the Nth <tu tuid="X">…</tu> and patch the target <tuv> inside
    const tuPattern = new RegExp(
      `(<tu[^>]*(?:tuid|id)=["']${escapedId}["'][^>]*>)([\\s\\S]*?)(</tu>)`,
      "g"
    )
    let nTu = 0
    result = result.replace(tuPattern, (match, open, body, close) => {
      nTu++
      if (nTu !== occurrence) return match
      const langPattern = new RegExp(
        `(<tuv[^>]*xml:lang="${targetLanguage}"[^>]*>[\\s\\S]*?<seg>)[\\s\\S]*?(</seg>)`,
        "i"
      )
      const patchedBody = body.replace(langPattern, `$1${newTarget}$2`)
      return `${open}${patchedBody}${close}`
    })
  }

  return result
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function reviseBilingualFile(
  originalContent: string,
  format: string,  // "xliff" | "xlf" | "tmx" | "mxliff"
  targetLanguage: string,
  findings: LqaFinding[],
  apiKey: string,
  provider: string,
  model: string
): Promise<string> {
  if (findings.length === 0) return originalContent

  const normalised = format.toLowerCase().replace(/^\./, "")

  // Build revision items using raw XML target content so AI preserves inline markup.
  const revisionItems = findings.map((f) => {
    let curContent: string
    if (normalised === "tmx") {
      curContent = extractRawTmxTarget(originalContent, f.unitId, targetLanguage)
    } else {
      curContent = extractRawXliffTarget(originalContent, f.unitId)
    }
    // Fall back to plain text from findings if extraction fails
    if (!curContent) curContent = f.targetText

    return {
      id: f.unitId,
      s: f.sourceText,
      cur: curContent,
      fix: f.errors
        .map((e) => {
          const label = e.type === "acc" ? "ACCURACY" : e.type === "lang" ? "LANGUAGE" : "STYLE"
          return `[${label}] ${e.description}. Fix: ${e.suggestion}`
        })
        .join(" | "),
    }
  })

  const batches = chunkArray(revisionItems, REVISION_BATCH_SIZE)
  const allFixes = new Map<string, string>()

  let batchesAttempted = 0
  let batchesFailed = 0
  let lastBatchError: string | null = null

  for (const batch of batches) {
    // Use opaque sequential keys ("1", "2", …) instead of real unit IDs.
    // Real IDs like "title#2" contain patterns (the #N deduplication suffix) that
    // cause the AI to treat them as variants of the same unit and apply the same
    // correction across independent units that happen to share a base ID.
    const keyToRealId = new Map<string, string>()
    const aiItems = batch.map((item, i) => {
      const key = String(i + 1)
      keyToRealId.set(key, item.id)
      return { id: key, s: item.s, cur: item.cur, fix: item.fix }
    })

    const payload = JSON.stringify(aiItems)
    batchesAttempted++
    let raw = ""
    try {
      raw = await callRevisionApi(payload, apiKey, provider, model)
      console.log(`[lqa-reviser] batch ${batchesAttempted} raw response (first 500 chars):`, raw.slice(0, 500))
    } catch (err) {
      batchesFailed++
      lastBatchError = (err as Error).message
      console.error("[lqa-reviser] batch revision error:", err)
      continue
    }

    const items = parseRevisionResponse(raw)
    if (items.length === 0) {
      console.warn(`[lqa-reviser] batch ${batchesAttempted}: AI returned no revision items. Raw response:`, raw.slice(0, 300))
    }
    for (const item of items) {
      // Coerce to string: models often return numeric IDs (1, 2, …) even when
      // the input had string IDs ("1", "2", …), and Map.get(1) !== Map.get("1").
      const realId = keyToRealId.get(String(item.id))
      if (realId && item.t) allFixes.set(realId, item.t)
    }
  }

  // If every batch failed with an API error, surface it instead of silently
  // returning the original content (mirrors lqa-analyzer.ts error handling).
  if (batchesAttempted > 0 && batchesFailed === batchesAttempted) {
    throw new Error(
      `AI revision failed for all ${batchesAttempted} batch${batchesAttempted !== 1 ? "es" : ""}. ` +
      `Last error: ${lastBatchError ?? "unknown error"}`
    )
  }

  if (allFixes.size === 0) return originalContent

  if (normalised === "tmx") {
    return patchTmx(originalContent, allFixes, targetLanguage)
  }
  // xliff, xlf, mxliff
  return patchXliff(originalContent, allFixes)
}
