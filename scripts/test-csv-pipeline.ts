/**
 * SR Tester — CSV translation pipeline regression tests
 *
 * Tests both fixes:
 *  1. parseCsvSource  — improved header detection (KNOWN_HEADER_NAMES + no-space heuristic)
 *  2. Download route  — re-parse source CSV via parseCsvFull to preserve all rows
 *
 * Run: npx tsx scripts/test-csv-pipeline.ts
 */

// ─── inline replicas of the two functions under test ─────────────────────────
// (avoids Next.js / @/ path alias bootstrap)

interface SourceUnit { id: string; sourceText: string }

function parseCsvLine(line: string): string[] {
  const cols: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === "," && !inQuotes) { cols.push(current); current = "" }
    else current += ch
  }
  cols.push(current)
  return cols
}

function parseCsvSource(content: string): SourceUnit[] {
  const lines = content.split(/\r?\n/).filter((l: string) => l.trim())
  if (lines.length === 0) return []
  const firstCols = parseCsvLine(lines[0]).map((c) => c.trim().toLowerCase().replace(/^"|"$/g, ""))
  const KNOWN_HEADER_NAMES = new Set([
    "id", "key", "name", "source", "target", "text", "string", "message",
    "english", "phrase", "label", "identifier", "token", "original",
    "segment", "content", "translation", "value", "term", "word",
  ])
  const hasHeader = lines.length > 1 && (
    firstCols.some((c) => KNOWN_HEADER_NAMES.has(c)) ||
    firstCols.every((c) => c.length > 0 && !/\s/.test(c))
  )
  const dataLines = hasHeader ? lines.slice(1) : lines
  return dataLines
    .map((line) => {
      const cols = parseCsvLine(line)
      const id = cols[0]?.trim().replace(/^"|"$/g, "")
      const sourceText = cols[1]?.trim().replace(/^"|"$/g, "")
      if (!id || !sourceText) return null
      return { id, sourceText }
    })
    .filter((u): u is SourceUnit => u !== null)
}

function parseCsvFull(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter((l: string) => l.trim())
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = parseCsvLine(lines[0]).map((c) => c.trim().replace(/^"|"$/g, ""))
  const rows = lines.slice(1)
    .map((line) => parseCsvLine(line).map((c) => c.trim().replace(/^"|"$/g, "")))
    .filter((row) => row.some((c) => c))
  return { headers, rows }
}

/** Simulate the legacy 2-column download output (new implementation) */
function simulateDownload(sourceContent: string, translations: Map<string, string>): string[] {
  function escCsvCell(val: string): string { return `"${val.replace(/"/g, '""')}"` }
  const { headers: srcHeaders, rows: srcRows } = parseCsvFull(sourceContent)
  const outHeader = srcHeaders.length >= 2
    ? srcHeaders.map(h => escCsvCell(h)).join(",")
    : "id,value"
  const lines = [outHeader]
  for (const row of srcRows) {
    const id = row[0] ?? ""
    const originalVal = row[1] ?? ""
    const translated = id ? (translations.get(id) ?? "") : ""
    const outVal = translated || originalVal
    lines.push(`${escCsvCell(id)},${escCsvCell(outVal)}`)
  }
  return lines
}

// ─── test harness ─────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function check(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ✓  ${label}`)
    passed++
  } else {
    console.error(`  ✗  ${label}`)
    console.error(`     expected: ${e}`)
    console.error(`     actual:   ${a}`)
    failed++
  }
}

function section(name: string): void { console.log(`\n── ${name} ──`) }

// ═════════════════════════════════════════════════════════════════════════════
// parseCsvSource — header detection
// ═════════════════════════════════════════════════════════════════════════════

section("parseCsvSource — header detection")

// Original supported headers
check("id,value header detected",
  parseCsvSource("id,value\nkey1,Hello\nkey2,World").map(u => u.id),
  ["key1", "key2"])

check("key,text header detected",
  parseCsvSource("key,text\nkey1,Hello\nkey2,World").map(u => u.id),
  ["key1", "key2"])

check("name,string header detected",
  parseCsvSource("name,string\nkey1,Hello\nkey2,World").map(u => u.id),
  ["key1", "key2"])

// Previously broken — required KNOWN_HEADER_NAMES expansion
check("source,english header detected",
  parseCsvSource("source,english\nkey1,Hello\nkey2,World").map(u => u.id),
  ["key1", "key2"])

check("phrase,translation header detected",
  parseCsvSource("phrase,translation\nkey1,Hello\nkey2,World").map(u => u.id),
  ["key1", "key2"])

check("label,content header detected",
  parseCsvSource("label,content\nkey1,Hello\nkey2,World").map(u => u.id),
  ["key1", "key2"])

check("original,target header detected",
  parseCsvSource("original,target\nkey1,Hello\nkey2,World").map(u => u.id),
  ["key1", "key2"])

// No-space heuristic — machine-generated identifier-style columns
check("source_key,en_US identifier-style header detected",
  parseCsvSource("source_key,en_US\nkey1,Hello\nkey2,World").map(u => u.id),
  ["key1", "key2"])

check("string_key,target_text identifier-style header detected",
  parseCsvSource("string_key,target_text\nkey1,Hello\nkey2,World").map(u => u.id),
  ["key1", "key2"])

// Source text is correctly assigned
check("source text from second column",
  parseCsvSource("key,value\ngreeting,Hello world\nfarewell,Goodbye friend"),
  [
    { id: "greeting", sourceText: "Hello world" },
    { id: "farewell", sourceText: "Goodbye friend" },
  ])

// 3-column CSV — only first two columns used for id/sourceText
check("3-column CSV: id = col1, sourceText = col2",
  parseCsvSource("id,source,notes\nkey1,Hello,informal\nkey2,Goodbye,formal"),
  [
    { id: "key1", sourceText: "Hello" },
    { id: "key2", sourceText: "Goodbye" },
  ])

// ═════════════════════════════════════════════════════════════════════════════
// parseCsvSource — row filtering (the OLD bug: missing rows)
// ═════════════════════════════════════════════════════════════════════════════

section("parseCsvSource — row filtering behaviour (units array)")

// Row with empty second column is still filtered from units (expected — it can't be translated)
check("row with empty value is excluded from units",
  parseCsvSource("key,value\nrow1,Hello\nrow2,\nrow3,Thank you").map(u => u.id),
  ["row1", "row3"])

// Only row with empty id is filtered
check("row with empty id is excluded",
  parseCsvSource("key,value\nrow1,Hello\n,Orphan\nrow3,Thank you").map(u => u.id),
  ["row1", "row3"])

// Quoted fields work correctly
check("quoted field with embedded comma",
  parseCsvSource('key,value\ngreeting,"Hello, world"\nfarewell,Goodbye'),
  [
    { id: "greeting", sourceText: "Hello, world" },
    { id: "farewell", sourceText: "Goodbye" },
  ])

check("quoted id with embedded comma",
  parseCsvSource('key,value\n"key,one",Hello\nkey2,Goodbye'),
  [
    { id: "key,one", sourceText: "Hello" },
    { id: "key2",    sourceText: "Goodbye" },
  ])

// ═════════════════════════════════════════════════════════════════════════════
// Download output — row-shift bug fixed via parseCsvFull re-parse
// ═════════════════════════════════════════════════════════════════════════════

section("Download — row count preserved (original bug scenario)")

// THE BUG: row2 had empty value, was dropped from units, so download showed row3 content as row2
// THE FIX: download re-parses source CSV — all 3 rows appear in output
{
  const csv = "key,value\nrow1,Hello\nrow2,\nrow3,Thank you"
  const translations = new Map([["row1", "Bonjour"], ["row3", "Merci"]])
  const out = simulateDownload(csv, translations)
  check("3-row CSV with empty row2: output has 3 data rows (+ 1 header)", out.length, 4)
  check("row1 correctly translated", out[1], '"row1","Bonjour"')
  check("row2 empty (no source text, no translation)", out[2], '"row2",""')
  check("row3 correctly translated", out[3], '"row3","Merci"')
}

section("Download — header names preserved from original CSV")

{
  const csv = "source,english\ngreeting,Hello\nfarewell,Goodbye"
  const translations = new Map([["greeting", "Bonjour"], ["farewell", "Au revoir"]])
  const out = simulateDownload(csv, translations)
  check("original header names used (not hardcoded id,value)", out[0], '"source","english"')
  check("row1 translated", out[1], '"greeting","Bonjour"')
  check("row2 translated", out[2], '"farewell","Au revoir"')
}

section("Download — falls back to original text when no translation")

{
  const csv = "key,value\nrow1,Hello\nrow2,World\nrow3,Goodbye"
  const translations = new Map([["row1", "Hola"], ["row3", "Adiós"]])
  // row2 has no translation (e.g. AI skipped it, gap-fill also missed it)
  const out = simulateDownload(csv, translations)
  check("row2 falls back to original source text", out[2], '"row2","World"')
}

section("Download — all 3 data rows in correct order")

{
  const csv = "key,value\ngreeting,Hello\nfarewell,Goodbye\nthanks,Thank you"
  const translations = new Map([
    ["greeting", "Hola"],
    ["farewell", "Adiós"],
    ["thanks",   "Gracias"],
  ])
  const out = simulateDownload(csv, translations)
  check("4 lines total (1 header + 3 data)",   out.length, 4)
  check("row1 — greeting → Hola",  out[1], '"greeting","Hola"')
  check("row2 — farewell → Adiós", out[2], '"farewell","Adiós"')
  check("row3 — thanks → Gracias", out[3], '"thanks","Gracias"')
}

section("Download — Windows CRLF line endings")

{
  const csv = "key,value\r\nrow1,Hello\r\nrow2,World\r\n"
  const translations = new Map([["row1", "Hola"], ["row2", "Mundo"]])
  const out = simulateDownload(csv, translations)
  check("CRLF: 2 data rows produced", out.length, 3)
  check("CRLF: row1 translated", out[1], '"row1","Hola"')
  check("CRLF: row2 translated", out[2], '"row2","Mundo"')
}

section("Download — quoted values containing double-quotes")

{
  const csv = 'key,value\ngreeting,"He said ""Hello"""\nfarewell,Goodbye'
  const translations = new Map([["greeting", 'Il a dit "Bonjour"'], ["farewell", "Au revoir"]])
  const out = simulateDownload(csv, translations)
  check("double-quote in translation is escaped", out[1], '"greeting","Il a dit ""Bonjour"""')
}

section("parseCsvSource — edge cases")

// Empty file
check("empty content returns []", parseCsvSource(""), [])

// Single row only — can't tell if it's a header or data; treated as data (safe default)
check("single-row CSV treated as data (not silently dropped)",
  parseCsvSource("key,value"),
  [{ id: "key", sourceText: "value" }])

// Single data row, no header detection possible
check("single data row with KNOWN header",
  parseCsvSource("source,english\ngreeting,Hello"),
  [{ id: "greeting", sourceText: "Hello" }])

// Large-ish CSV — check order is preserved
{
  const rows = Array.from({ length: 20 }, (_, i) => `key${i},Value ${i}`)
  const csv = ["id,source", ...rows].join("\n")
  const units = parseCsvSource(csv)
  check("20-row CSV: all units produced", units.length, 20)
  check("20-row CSV: first unit id", units[0].id, "key0")
  check("20-row CSV: last unit id",  units[19].id, "key19")
}

// ─── summary ─────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
