"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { STUDIO_LANGUAGES, STUDIO_LANGUAGE_REGIONS, LANGUAGE_PRESETS } from "@/lib/languages"
import type { ProviderInfo } from "@/lib/ai-providers/types"

interface Props {
  providers: ProviderInfo[]
}

type Step = 1 | 2 | 3

interface SourceUnit {
  id: string
  sourceText: string
}

interface PdfProbe {
  numPages: number
  isScanned: boolean
  wordCount: number
  estimatedUnits: number
}

interface FileEntry {
  key: string          // stable React key
  file: File
  preview: SourceUnit[]
  parseError: string
  pdfProbe?: PdfProbe  // set after server-side probe for PDF files
  probePending?: boolean
}

function fileKey(f: File) {
  return `${f.name}-${f.size}-${f.lastModified}`
}

function fileTypeLabel(name: string) {
  if (name.endsWith(".pdf")) return "PDF"
  if (name.endsWith(".json")) return "JSON"
  if (name.endsWith(".csv")) return "CSV"
  if (name.endsWith(".md")) return "MD"
  return "file"
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function TranslationWizard({ providers }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)

  // Step 1 state — multiple files
  const [entries, setEntries] = useState<FileEntry[]>([])

  // Step 2 state
  const [jobName, setJobName] = useState("")
  const [provider, setProvider] = useState(providers[0].name)
  const [model, setModel] = useState(providers[0].models[0].id)
  const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set())
  const [langSearch, setLangSearch] = useState("")
  const [regionFilter, setRegionFilter] = useState("")

  // Step 3 state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const currentProvider = providers.find((p) => p.name === provider)!

  const filteredLangs = STUDIO_LANGUAGES.filter((l) => {
    const matchSearch = l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.code.toLowerCase().includes(langSearch.toLowerCase())
    const matchRegion = !regionFilter || l.region === regionFilter
    return matchSearch && matchRegion
  })

  const activePresetId = LANGUAGE_PRESETS.find((p) => {
    const validCodes = p.codes.filter((c) => STUDIO_LANGUAGES.some((l) => l.code === c))
    return validCodes.length === selectedLangs.size && validCodes.every((c) => selectedLangs.has(c))
  })?.id ?? null

  function parseNonPdfFile(f: File): Promise<FileEntry> {
    const key = fileKey(f)
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        try {
          let units: SourceUnit[]
          if (f.name.endsWith(".json")) {
            units = flattenForPreview(JSON.parse(content) as unknown)
          } else if (f.name.endsWith(".md")) {
            units = parseMarkdownPreview(content)
          } else {
            units = parseCsvPreview(content)
          }
          resolve({ key, file: f, preview: units, parseError: "" })
        } catch {
          resolve({ key, file: f, preview: [], parseError: "Could not parse file — check that it is valid JSON, CSV, or Markdown." })
        }
      }
      reader.readAsText(f)
    })
  }

  async function probePdf(key: string, f: File) {
    const fd = new FormData()
    fd.append("file", f)
    try {
      const res = await fetch("/api/translation-studio/probe-pdf", { method: "POST", body: fd })
      const probe = await res.json() as PdfProbe
      setEntries((prev) => prev.map((e) => e.key === key ? { ...e, pdfProbe: probe, probePending: false } : e))
    } catch {
      setEntries((prev) => prev.map((e) => e.key === key ? { ...e, probePending: false } : e))
    }
  }

  async function addFiles(newFiles: File[]) {
    const existingKeys = new Set(entries.map((e) => e.key))
    const fresh = newFiles.filter((f) => !existingKeys.has(fileKey(f)))
    if (fresh.length === 0) return

    // Parse non-PDF files client-side; PDFs get a probe stub immediately
    const parsed = await Promise.all(
      fresh.map((f) =>
        f.name.endsWith(".pdf")
          ? Promise.resolve<FileEntry>({ key: fileKey(f), file: f, preview: [], parseError: "", probePending: true })
          : parseNonPdfFile(f)
      )
    )

    setEntries((prev) => {
      const next = [...prev, ...parsed]
      if (!jobName && next.length > 0) {
        setJobName(next[0].file.name.replace(/\.(json|csv|md|pdf)$/i, ""))
      }
      return next
    })

    // Fire PDF probes in background
    for (const entry of parsed) {
      if (entry.file.name.endsWith(".pdf")) {
        probePdf(entry.key, entry.file)
      }
    }
  }

  function removeEntry(key: string) {
    setEntries((prev) => prev.filter((e) => e.key !== key))
  }

  const handleInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    await addFiles(files)
    // Reset input so the same file can be re-added after removal
    e.target.value = ""
  }, [entries, jobName]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(json|csv|md|pdf)$/i.test(f.name)
    )
    await addFiles(files)
  }, [entries, jobName]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleLang(code: string) {
    setSelectedLangs((s) => {
      const next = new Set(s)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })
  }

  function selectAll() { setSelectedLangs(new Set(filteredLangs.map((l) => l.code))) }
  function clearAll() { setSelectedLangs(new Set()) }

  async function submit() {
    setSubmitting(true)
    setSubmitError("")

    const langs = JSON.stringify(Array.from(selectedLangs))
    let lastJobId: string | null = null
    const errors: string[] = []

    for (const entry of entries) {
      const fd = new FormData()
      fd.append("file", entry.file)
      fd.append("name", entries.length === 1 ? jobName : `${jobName} — ${entry.file.name.replace(/\.(json|csv|md|pdf)$/i, "")}`)
      fd.append("provider", provider)
      fd.append("model", model)
      fd.append("targetLanguages", langs)

      const res = await fetch("/api/translation-studio/jobs", { method: "POST", body: fd })
      const data = await res.json() as { jobId?: string; error?: string }
      if (!res.ok) {
        errors.push(`${entry.file.name}: ${data.error ?? "Failed to create job"}`)
      } else {
        lastJobId = data.jobId ?? null
      }
    }

    setSubmitting(false)

    if (errors.length > 0) {
      setSubmitError(errors.join("\n"))
      return
    }

    // Single file → go to job detail; multiple → go to studio list
    if (entries.length === 1 && lastJobId) {
      router.push(`/translation-studio/${lastJobId}`)
    } else {
      router.push("/translation-studio")
    }
  }

  // ── parse helpers ──────────────────────────────────────────────────────────

  function flattenForPreview(obj: unknown, prefix = ""): SourceUnit[] {
    if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
      return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => {
        const key = prefix ? `${prefix}.${k}` : k
        if (typeof v === "string") return [{ id: key, sourceText: v }]
        return flattenForPreview(v, key)
      })
    }
    if (Array.isArray(obj)) {
      return (obj as Record<string, unknown>[]).map((item) => ({
        id: String(item.id ?? item.key ?? ""),
        sourceText: String(item.value ?? item.text ?? item.source ?? ""),
      })).filter((u) => u.id && u.sourceText)
    }
    return []
  }

  function parseMarkdownPreview(content: string): SourceUnit[] {
    const units: SourceUnit[] = []
    let index = 0
    let inFencedBlock = false
    const lines = content.split(/\r?\n/)
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      if (/^```/.test(line) || /^~~~/.test(line)) { inFencedBlock = !inFencedBlock; i++; continue }
      if (inFencedBlock || /^( {4}|\t)/.test(line)) { i++; continue }
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
      if (headingMatch) { units.push({ id: `h${headingMatch[1].length}_${index++}`, sourceText: headingMatch[2].trim() }); i++; continue }
      const listMatch = line.match(/^(\s*(?:[-*+]|\d+\.)\s+)(.+)$/)
      if (listMatch) { units.push({ id: `li_${index++}`, sourceText: listMatch[2].trim() }); i++; continue }
      if (line.trim() === "") { i++; continue }
      const paraLines: string[] = []
      while (i < lines.length && lines[i].trim() !== "" && !/^```/.test(lines[i]) && !/^~~~/.test(lines[i]) && !/^#{1,6}\s/.test(lines[i]) && !/^\s*(?:[-*+]|\d+\.)\s/.test(lines[i]) && !/^( {4}|\t)/.test(lines[i])) {
        paraLines.push(lines[i]); i++
      }
      if (paraLines.length > 0) units.push({ id: `p_${index++}`, sourceText: paraLines.join(" ").trim() })
    }
    return units
  }

  function parseCsvPreview(content: string): SourceUnit[] {
    return content.split(/\r?\n/).slice(1, 11)
      .map((line) => {
        const [id, ...rest] = line.split(",")
        return { id: id?.trim().replace(/"/g, ""), sourceText: rest.join(",").trim().replace(/^"|"$/g, "") }
      })
      .filter((u) => u.id && u.sourceText)
  }

  // ── derived ────────────────────────────────────────────────────────────────

  const hasFiles = entries.length > 0
  const hasErrors = entries.some((e) => e.parseError)
  const canProceed = hasFiles && !hasErrors

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {([1, 2, 3] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="w-8 h-px bg-gray-200" />}
            <div className={`flex items-center gap-1.5 text-sm font-medium ${step === s ? "text-indigo-600" : step > s ? "text-gray-400" : "text-gray-300"}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === s ? "bg-indigo-600 text-white" : step > s ? "bg-gray-200 text-gray-500" : "bg-gray-100 text-gray-300"}`}>{s}</span>
              {s === 1 ? "Upload" : s === 2 ? "Configure" : "Confirm"}
            </div>
          </div>
        ))}
      </div>

      {/* ── Step 1 — Upload ── */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors cursor-pointer"
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".json,.csv,.md,.pdf"
              multiple
              className="hidden"
              onChange={handleInputChange}
            />
            <p className="text-gray-500">
              Drop <strong>.json</strong>, <strong>.csv</strong>, <strong>.md</strong>, or <strong>.pdf</strong> files here, or click to browse
            </p>
            <p className="text-xs text-gray-400 mt-1">Multiple files supported — each becomes a separate translation job</p>
          </div>

          {/* File list */}
          {entries.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {entries.length} file{entries.length !== 1 ? "s" : ""} queued
                </p>
                <button
                  onClick={() => setEntries([])}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Remove all
                </button>
              </div>

              {entries.map((entry) => {
                const isPdf = entry.file.name.endsWith(".pdf")
                const stringCount = isPdf ? null : entry.preview.length
                const probe = entry.pdfProbe
                return (
                  <div
                    key={entry.key}
                    className={`bg-white rounded-xl border px-4 py-3 flex items-start gap-3 ${
                      entry.parseError ? "border-red-200 bg-red-50" : "border-gray-200"
                    }`}
                  >
                    {/* Type badge */}
                    <span className="mt-0.5 text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded shrink-0">
                      {fileTypeLabel(entry.file.name)}
                    </span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{entry.file.name}</p>
                      {entry.parseError ? (
                        <p className="text-xs text-red-600 mt-0.5">{entry.parseError}</p>
                      ) : (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatBytes(entry.file.size)}
                          {isPdf && probe
                            ? ` · ${probe.numPages} page${probe.numPages !== 1 ? "s" : ""} · ~${probe.estimatedUnits} strings`
                            : isPdf && entry.probePending
                              ? " · analysing…"
                              : stringCount !== null
                                ? ` · ${stringCount} string${stringCount !== 1 ? "s" : ""} detected`
                                : ""}
                        </p>
                      )}
                      {isPdf && probe && !entry.parseError && (
                        <p className={`text-xs mt-0.5 ${probe.isScanned ? "text-amber-600" : "text-green-600"}`}>
                          {probe.isScanned
                            ? "Scanned PDF — Claude Vision will extract text (Anthropic key required)"
                            : `Text-based PDF — extracted directly (${probe.wordCount.toLocaleString()} words, no Vision API cost)`}
                        </p>
                      )}
                      {entry.file.name.endsWith(".md") && !entry.parseError && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          Code blocks excluded from translation
                        </p>
                      )}
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => removeEntry(entry.key)}
                      className="text-gray-300 hover:text-red-500 transition-colors shrink-0 text-lg leading-none mt-0.5"
                      title="Remove file"
                    >
                      ×
                    </button>
                  </div>
                )
              })}

              {/* Add more */}
              <button
                onClick={() => document.getElementById("file-input")?.click()}
                className="w-full border border-dashed border-gray-300 rounded-xl py-2.5 text-sm text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
              >
                + Add more files
              </button>
            </div>
          )}

          {/* Preview for single non-PDF file */}
          {entries.length === 1 && !entries[0].file.name.endsWith(".pdf") && entries[0].preview.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-600">
                Preview (first 10 strings)
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {entries[0].preview.slice(0, 10).map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-2 text-xs text-gray-400 w-1/3 truncate">{u.id}</td>
                      <td className="px-4 py-2 text-gray-700 truncate">{u.sourceText}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!canProceed}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40"
            >
              Next: Configure →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2 — Configure ── */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-medium text-gray-900">Job details</h2>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Job name{entries.length > 1 && <span className="ml-1 text-gray-400 font-normal">(used as prefix for each file)</span>}
              </label>
              <input
                type="text"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-medium text-gray-900">AI provider</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => {
                    const p = providers.find((x) => x.name === e.target.value)!
                    setProvider(p.name)
                    setModel(p.models[0].id)
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {providers.map((p) => (
                    <option key={p.name} value={p.name}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {currentProvider.models.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-gray-900">
                Target languages
                {selectedLangs.size > 0 && (
                  <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                    {selectedLangs.size} selected
                  </span>
                )}
              </h2>
              <button onClick={clearAll} className="text-xs text-gray-400 hover:underline">Clear</button>
            </div>

            <div className="flex flex-wrap gap-2">
              {LANGUAGE_PRESETS.map((preset) => {
                const count = preset.codes.filter(c => STUDIO_LANGUAGES.some(l => l.code === c)).length
                const isActive = activePresetId === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.description}
                    onClick={() => setSelectedLangs(new Set(preset.codes.filter(c => STUDIO_LANGUAGES.some(l => l.code === c))))}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      isActive
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700"
                    }`}
                  >
                    {preset.label} <span className={isActive ? "opacity-75" : "text-gray-400"}>({count})</span>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={selectAll}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  selectedLangs.size === STUDIO_LANGUAGES.length
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
                }`}
              >
                ✦ All ({STUDIO_LANGUAGES.length})
              </button>
            </div>

            {selectedLangs.size > 0 && (
              <div className="border border-indigo-100 bg-indigo-50 rounded-lg p-3">
                <p className="text-xs font-medium text-indigo-700 mb-2">{selectedLangs.size} selected</p>
                <div className="flex flex-wrap gap-1.5">
                  {STUDIO_LANGUAGES.filter(l => selectedLangs.has(l.code)).map((lang) => (
                    <span
                      key={lang.code}
                      className="inline-flex items-center gap-1 text-xs bg-white border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full"
                    >
                      {lang.name}
                      <button type="button" onClick={() => toggleLang(lang.code)} className="text-indigo-400 hover:text-indigo-700 leading-none">×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <details className="group">
              <summary className="text-xs text-indigo-600 cursor-pointer hover:underline list-none flex items-center gap-1">
                <span className="group-open:hidden">▸ Browse all languages</span>
                <span className="hidden group-open:inline">▾ Hide browser</span>
              </summary>
              <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search languages…"
                    value={langSearch}
                    onChange={(e) => setLangSearch(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <select
                    value={regionFilter}
                    onChange={(e) => setRegionFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">All regions</option>
                    {STUDIO_LANGUAGE_REGIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-60 overflow-y-auto pr-1">
                  {filteredLangs.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => toggleLang(lang.code)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
                        selectedLangs.has(lang.code)
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                      }`}
                    >
                      <span className="block font-medium truncate">{lang.name}</span>
                      <span className="block opacity-60">{lang.code}</span>
                    </button>
                  ))}
                </div>
              </div>
            </details>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!jobName.trim() || selectedLangs.size === 0}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40"
            >
              Next: Confirm →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3 — Confirm + Cost estimate ── */}
      {step === 3 && (() => {
        const selectedModel = currentProvider.models.find((m) => m.id === model)!
        const batchSize = 50

        function fmt(n: number) {
          if (n < 0.001) return "< $0.001"
          return `$${n.toFixed(n < 0.01 ? 4 : n < 1 ? 3 : 2)}`
        }

        // Per-file cost rows
        const fileRows = entries.map((entry) => {
          const isPdf = entry.file.name.endsWith(".pdf")
          const probe = entry.pdfProbe

          let strings: number
          let extractCostOneTime = 0
          let pdfLabel = ""

          if (isPdf) {
            if (probe) {
              strings = probe.estimatedUnits
              if (probe.isScanned) {
                // Scanned: Claude Vision — ~1 600 input + ~200 output tokens per page for extraction
                const extractIn = probe.numPages * 1600
                const extractOut = probe.numPages * 200
                extractCostOneTime = (extractIn * 3 + extractOut * 15) / 1_000_000
                pdfLabel = `${probe.numPages} pages · scanned · Vision extraction ${fmt(extractCostOneTime)}`
              } else {
                // Text-based: free extraction via pdf-parse
                pdfLabel = `${probe.numPages} pages · text-based · free extraction`
              }
            } else {
              // Probe still loading or failed — fall back to size estimate
              const fallbackPages = Math.max(1, Math.ceil(entry.file.size / (400 * 1024)))
              strings = fallbackPages * 40
              pdfLabel = `~${fallbackPages} pages (estimated)`
            }
          } else {
            strings = entry.preview.length
          }

          const totalChars = isPdf ? strings * 80 : entry.preview.reduce((s, u) => s + u.sourceText.length, 0)
          const batches = Math.max(1, Math.ceil(strings / batchSize))
          const inputTok = Math.ceil(totalChars / 4) + batches * 150
          const outputTok = Math.ceil(totalChars / 4 * 1.1)
          const costPerLang = (inputTok * selectedModel.inputPricePer1M + outputTok * selectedModel.outputPricePer1M) / 1_000_000
          const totalFileCost = extractCostOneTime + costPerLang * selectedLangs.size
          return { entry, isPdf, strings, batches, inputTok, outputTok, costPerLang, totalFileCost, extractCostOneTime, pdfLabel }
        })

        const grandTotalCost = fileRows.reduce((s, r) => s + r.totalFileCost, 0)
        const totalStrings = fileRows.reduce((s, r) => s + r.strings, 0)
        const totalApiCalls = fileRows.reduce((s, r) => s + r.batches * selectedLangs.size, 0)

        return (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h2 className="font-medium text-gray-900">Review and start</h2>
              <dl className="text-sm space-y-2">
                <Row label="Job name" value={jobName} />
                <Row label="Files" value={`${entries.length} file${entries.length !== 1 ? "s" : ""} · ${totalStrings.toLocaleString()} strings`} />
                <Row label="AI model" value={`${currentProvider.label} — ${selectedModel.label}`} />
                <Row label="Target languages" value={`${selectedLangs.size} languages`} />
                <Row label="Total API calls" value={`~${totalApiCalls.toLocaleString()}`} />
              </dl>
            </div>

            {/* Cost breakdown per file */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="font-medium text-gray-900">Estimated cost</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedModel.label} · ${selectedModel.inputPricePer1M}/M in · ${selectedModel.outputPricePer1M}/M out
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{fmt(grandTotalCost)}</p>
                  <p className="text-xs text-gray-400">total estimate</p>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-5 py-2 font-medium">File</th>
                    <th className="px-5 py-2 font-medium text-right">Strings</th>
                    <th className="px-5 py-2 font-medium text-right">Per language</th>
                    <th className="px-5 py-2 font-medium text-right">
                      Total ({selectedLangs.size} lang{selectedLangs.size !== 1 ? "s" : ""})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {fileRows.map(({ entry, isPdf, strings, pdfLabel, costPerLang, totalFileCost }) => (
                    <tr key={entry.key} className="hover:bg-gray-50">
                      <td className="px-5 py-2.5">
                        <span className="font-medium text-gray-900 truncate block max-w-xs">{entry.file.name}</span>
                        {isPdf && pdfLabel && (
                          <span className="text-xs text-gray-400">{pdfLabel}</span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-right text-gray-500">
                        {isPdf ? `~${strings}` : strings}
                      </td>
                      <td className="px-5 py-2.5 text-right text-gray-500">{fmt(costPerLang)}</td>
                      <td className="px-5 py-2.5 text-right font-medium text-gray-900">{fmt(totalFileCost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                  <tr>
                    <td className="px-5 py-2.5 font-semibold text-gray-900">Total</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-gray-900">~{totalStrings.toLocaleString()}</td>
                    <td className="px-5 py-2.5" />
                    <td className="px-5 py-2.5 text-right font-bold text-indigo-700">{fmt(grandTotalCost)}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="px-5 py-3 bg-amber-50 border-t border-amber-100">
                <p className="text-xs text-amber-700">
                  ⚠ Rough estimate. Actual cost varies by content verbosity and retries. PDFs use file-size estimation only.
                </p>
              </div>
            </div>

            {submitError && (
              <pre className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 whitespace-pre-wrap">{submitError}</pre>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                ← Back
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting
                  ? `Creating job${entries.length > 1 ? "s" : ""}…`
                  : `Start Translation${entries.length > 1 ? ` (${entries.length} jobs)` : ""}`}
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 font-medium">{value}</dd>
    </div>
  )
}
