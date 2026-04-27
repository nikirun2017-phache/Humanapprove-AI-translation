/**
 * Subtitle parser — handles SRT (SubRip) and WebVTT formats.
 *
 * Preserves all timing data verbatim. Extracts only the cue text for
 * translation, then rebuilds the output file with translated text.
 *
 * SRT structure:
 *   1\n00:00:01,000 --> 00:00:04,000\nHello world\n\n2\n...
 *
 * VTT structure:
 *   WEBVTT\n\n[optional-id\n]00:00:01.000 --> 00:00:04.000\nHello world\n\n...
 */

export interface SubtitleEntry {
  index: number      // 0-based position (used for batching)
  num: string        // original cue number or VTT cue ID (preserved verbatim)
  timestamp: string  // original timestamp line (preserved verbatim)
  text: string       // cue text — may be multi-line; joined with \n
}

export interface ParsedSubtitle {
  format: "srt" | "vtt"
  /** "WEBVTT" + any file-level metadata; empty string for SRT */
  vttHeader: string
  entries: SubtitleEntry[]
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function parseSubtitle(content: string, format: "srt" | "vtt"): ParsedSubtitle {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  return format === "vtt" ? parseVtt(normalized) : parseSrt(normalized)
}

export function buildSubtitle(parsed: ParsedSubtitle, translations: string[]): string {
  const cues = parsed.entries
    .map((e, i) => `${e.num}\n${e.timestamp}\n${translations[i] ?? e.text}`)
    .join("\n\n")

  return parsed.format === "vtt" ? `${parsed.vttHeader}\n\n${cues}` : cues
}

// ─── SRT ──────────────────────────────────────────────────────────────────────

function parseSrt(text: string): ParsedSubtitle {
  const entries: SubtitleEntry[] = []

  for (const block of text.trim().split(/\n\s*\n/)) {
    const lines = block.trim().split("\n")
    if (lines.length < 3) continue
    const num = lines[0].trim()
    const ts = lines[1].trim()
    if (!ts.includes("-->")) continue
    const textContent = lines.slice(2).join("\n").trim()
    if (!textContent) continue
    entries.push({ index: entries.length, num, timestamp: ts, text: textContent })
  }

  return { format: "srt", vttHeader: "", entries }
}

// ─── VTT ──────────────────────────────────────────────────────────────────────

function parseVtt(text: string): ParsedSubtitle {
  const blocks = text.trim().split(/\n\s*\n/)
  const entries: SubtitleEntry[] = []
  let vttHeader = "WEBVTT"

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue

    // File header (starts with "WEBVTT")
    if (trimmed.startsWith("WEBVTT")) { vttHeader = trimmed; continue }

    // Skip comment, style, and region blocks
    if (
      trimmed.startsWith("NOTE") ||
      trimmed.startsWith("STYLE") ||
      trimmed.startsWith("REGION")
    ) continue

    const lines = trimmed.split("\n")
    let num = ""
    let ts = ""
    let textStart = 0

    if (lines[0].includes("-->")) {
      // No cue ID — assign a synthetic number for round-trip consistency
      ts = lines[0].trim()
      textStart = 1
      num = String(entries.length + 1)
    } else if (lines.length >= 2 && lines[1].includes("-->")) {
      // Has cue ID on first line
      num = lines[0].trim()
      ts = lines[1].trim()
      textStart = 2
    } else {
      continue // malformed block
    }

    const textContent = lines.slice(textStart).join("\n").trim()
    if (!textContent) continue
    entries.push({ index: entries.length, num, timestamp: ts, text: textContent })
  }

  return { format: "vtt", vttHeader, entries }
}
