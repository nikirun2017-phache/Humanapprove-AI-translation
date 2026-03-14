"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { STUDIO_LANGUAGES, STUDIO_LANGUAGE_REGIONS } from "@/lib/languages"
import type { ProviderInfo } from "@/lib/ai-providers/types"

interface Props {
  providers: ProviderInfo[]
  keyStatus: Record<string, boolean>
}

type Step = 1 | 2 | 3

interface SourceUnit {
  id: string
  sourceText: string
}

export function TranslationWizard({ providers, keyStatus }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)

  // Step 1 state
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<SourceUnit[]>([])
  const [parseError, setParseError] = useState("")

  // Step 2 state
  const [jobName, setJobName] = useState("")
  const [provider, setProvider] = useState(providers[0].name)
  const [model, setModel] = useState(providers[0].models[0].id)
  const [apiKey, setApiKey] = useState("")
  const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set())
  const [langSearch, setLangSearch] = useState("")
  const [regionFilter, setRegionFilter] = useState("")

  // Step 3 state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const currentProvider = providers.find((p) => p.name === provider)!
  const hasSystemKey = keyStatus[provider]

  // Language filtering
  const filteredLangs = STUDIO_LANGUAGES.filter((l) => {
    const matchSearch = l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.code.toLowerCase().includes(langSearch.toLowerCase())
    const matchRegion = !regionFilter || l.region === regionFilter
    return matchSearch && matchRegion
  })

  function handleFileChange(f: File | null) {
    if (!f) return
    setFile(f)
    setParseError("")
    setPreview([])

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      try {
        let units: SourceUnit[]
        if (f.name.endsWith(".json")) {
          const parsed = JSON.parse(content) as unknown
          units = flattenForPreview(parsed)
        } else if (f.name.endsWith(".md")) {
          units = parseMarkdownPreview(content)
        } else {
          units = parseCsvPreview(content)
        }
        setPreview(units)
        if (!jobName) setJobName(f.name.replace(/\.(json|csv|md)$/i, ""))
      } catch {
        setParseError("Could not parse file. Check that it is valid JSON, CSV, or Markdown.")
      }
    }
    reader.readAsText(f)
  }

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

  function toggleLang(code: string) {
    setSelectedLangs((s) => {
      const next = new Set(s)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })
  }

  function selectAll() {
    setSelectedLangs(new Set(filteredLangs.map((l) => l.code)))
  }

  function clearAll() {
    setSelectedLangs(new Set())
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFileChange(f)
  }, [])

  async function submit() {
    setSubmitting(true)
    setSubmitError("")

    const fd = new FormData()
    fd.append("file", file!)
    fd.append("name", jobName)
    fd.append("provider", provider)
    fd.append("model", model)
    fd.append("targetLanguages", JSON.stringify(Array.from(selectedLangs)))
    if (apiKey.trim()) fd.append("apiKey", apiKey.trim())

    const res = await fetch("/api/translation-studio/jobs", { method: "POST", body: fd })
    const data = await res.json() as { jobId?: string; error?: string }

    setSubmitting(false)
    if (!res.ok) {
      setSubmitError(data.error ?? "Failed to create job")
      return
    }
    router.push(`/translation-studio/${data.jobId}`)
  }

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

      {/* Step 1 — Upload */}
      {step === 1 && (
        <div className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-indigo-400 transition-colors cursor-pointer"
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".json,.csv,.md"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div>
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500 mt-1">{preview.length} strings detected</p>
              </div>
            ) : (
              <div>
                <p className="text-gray-500">Drop a <strong>.json</strong>, <strong>.csv</strong>, or <strong>.md</strong> file here</p>
                <p className="text-xs text-gray-400 mt-1">JSON: flat or nested key-value object · CSV: id,source columns · Markdown: headings, paragraphs, list items</p>
              </div>
            )}
          </div>

          {file?.name.endsWith(".md") && (
            <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              <span className="shrink-0">ℹ️</span>
              <span>
                <strong>Note:</strong> Code blocks (fenced <code className="bg-amber-100 px-1 rounded">```</code> and indented) are excluded from translation and will be preserved as-is in the output.
              </span>
            </div>
          )}

          {parseError && <p className="text-sm text-red-500">{parseError}</p>}

          {preview.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-600">
                Preview (first 10 strings)
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {preview.slice(0, 10).map((u) => (
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
              disabled={!file || preview.length === 0}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40"
            >
              Next: Configure →
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Configure */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-medium text-gray-900">Job details</h2>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Job name</label>
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
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                API key
                {hasSystemKey && (
                  <span className="ml-2 text-green-600 font-normal">· System key available</span>
                )}
              </label>
              <input
                type="password"
                placeholder={hasSystemKey ? "Leave blank to use system key" : "Enter your API key"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoComplete="off"
              />
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
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs text-indigo-600 hover:underline">Select all</button>
                <button onClick={clearAll} className="text-xs text-gray-400 hover:underline">Clear</button>
              </div>
            </div>

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

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-72 overflow-y-auto pr-1">
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

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!jobName.trim() || selectedLangs.size === 0 || (!hasSystemKey && !apiKey.trim())}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40"
            >
              Next: Confirm →
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Confirm */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <h2 className="font-medium text-gray-900">Review and start</h2>
            <dl className="text-sm space-y-2">
              <Row label="Job name" value={jobName} />
              <Row label="Source file" value={`${file!.name} · ${preview.length} strings`} />
              <Row label="AI provider" value={`${currentProvider.label} — ${model}`} />
              <Row label="API key" value={apiKey.trim() ? "User-provided (not stored)" : "System key"} />
              <Row label="Target languages" value={`${selectedLangs.size} languages`} />
              <Row
                label="Estimated LLM calls"
                value={`~${Math.ceil(preview.length / 50) * selectedLangs.size} calls`}
              />
            </dl>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-600 mb-2">Selected languages</p>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(selectedLangs).map((code) => {
                const lang = STUDIO_LANGUAGES.find((l) => l.code === code)
                return (
                  <span key={code} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                    {lang?.name ?? code}
                  </span>
                )
              })}
            </div>
          </div>

          {submitError && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{submitError}</p>}

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              ← Back
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? "Creating job…" : "Start Translation"}
            </button>
          </div>
        </div>
      )}
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
