"use client"

import { useState, useCallback, useRef, useEffect } from "react"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PreviewEntry {
  timestamp: string
  original: string
  translated: string
}

interface MediaRun {
  id: string
  fileName: string
  fileFormat: string
  targetLanguage: string
  status: "pending" | "running" | "completed" | "failed"
  totalEntries: number
  previewData: string | null  // JSON: PreviewEntry[]
  errorMessage: string | null
  createdAt: string
}

interface Props {
  initialRuns: MediaRun[]
}

// ─── Language list ─────────────────────────────────────────────────────────────

const TARGET_LANGUAGES = [
  { code: "zh-CN", label: "Simplified Chinese (简体中文)" },
  { code: "zh-TW", label: "Traditional Chinese (繁體中文)" },
  { code: "ja-JP", label: "Japanese (日本語)" },
  { code: "ko-KR", label: "Korean (한국어)" },
  { code: "es-ES", label: "Spanish (Español)" },
  { code: "fr-FR", label: "French (Français)" },
  { code: "de-DE", label: "German (Deutsch)" },
  { code: "pt-BR", label: "Portuguese (Português)" },
  { code: "ar-SA", label: "Arabic (العربية)" },
  { code: "hi-IN", label: "Hindi (हिन्दी)" },
  { code: "it-IT", label: "Italian (Italiano)" },
  { code: "ru-RU", label: "Russian (Русский)" },
  { code: "th-TH", label: "Thai (ภาษาไทย)" },
  { code: "vi-VN", label: "Vietnamese (Tiếng Việt)" },
  { code: "tr-TR", label: "Turkish (Türkçe)" },
  { code: "pl-PL", label: "Polish (Polski)" },
  { code: "nl-NL", label: "Dutch (Nederlands)" },
  { code: "sv-SE", label: "Swedish (Svenska)" },
  { code: "id-ID", label: "Indonesian (Bahasa Indonesia)" },
  { code: "ms-MY", label: "Malay (Bahasa Melayu)" },
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
]

const ACCEPTED_EXTS = new Set(["srt", "vtt"])

// ─── Elapsed timer ─────────────────────────────────────────────────────────────

function ElapsedTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(Math.floor((Date.now() - startedAt) / 1000))
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => clearInterval(id)
  }, [startedAt])
  const m = Math.floor(elapsed / 60)
  const s = elapsed % 60
  return <>{m > 0 ? `${m}m ${s}s` : `${s}s`} elapsed</>
}

// ─── Run card ──────────────────────────────────────────────────────────────────

function RunCard({ run, onRefresh }: { run: MediaRun; onRefresh: (id: string) => Promise<void> }) {
  const [expanded, setExpanded] = useState(false)
  const [previewExpanded, setPreviewExpanded] = useState(false)

  const preview: PreviewEntry[] = (() => {
    try { return run.previewData ? JSON.parse(run.previewData) : [] } catch { return [] }
  })()

  const shownPreview = previewExpanded ? preview : preview.slice(0, 5)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Summary row */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((x) => !x)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <svg
            className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{run.fileName}</p>
            <p className="text-xs text-gray-500">
              {run.fileFormat.toUpperCase()} · {run.totalEntries} entries · {run.targetLanguage.replace(/\s*\(.*?\)/, "")} ·{" "}
              {new Date(run.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="shrink-0 ml-3">
          <span
            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
              run.status === "completed"
                ? "bg-green-100 text-green-700"
                : run.status === "running"
                ? "bg-blue-100 text-blue-700 animate-pulse"
                : run.status === "failed"
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {run.status}
          </span>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-5">

          {/* Failure message */}
          {run.status === "failed" && run.errorMessage && (
            <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {run.errorMessage}
            </div>
          )}

          {/* Running indicator */}
          {run.status === "running" && (
            <div className="mt-3 flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Translating {run.totalEntries} entries to {run.targetLanguage.replace(/\s*\(.*?\)/, "")}…
              <button
                onClick={(e) => { e.stopPropagation(); void onRefresh(run.id) }}
                className="ml-auto text-xs text-blue-600 hover:underline"
              >
                Refresh
              </button>
            </div>
          )}

          {/* Completed: download + preview */}
          {run.status === "completed" && (
            <>
              <div className="mt-4 flex flex-wrap gap-2 items-center">
                <a
                  href={`/api/media/runs/${run.id}/download`}
                  download
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download .{run.fileFormat}
                </a>
                <span className="text-xs text-gray-400">{run.totalEntries} entries · {run.targetLanguage}</span>
              </div>

              {/* Preview */}
              {preview.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Preview ({preview.length} entries shown)
                  </p>
                  <div className="space-y-2">
                    {shownPreview.map((entry, i) => (
                      <div key={i} className="border border-gray-100 rounded-lg overflow-hidden text-xs">
                        <div className="bg-gray-50 px-3 py-1 font-mono text-gray-400 text-[10px]">
                          {entry.timestamp}
                        </div>
                        <div className="grid grid-cols-2 divide-x divide-gray-100">
                          <div className="px-3 py-2 text-gray-500 line-clamp-3">{entry.original}</div>
                          <div className="px-3 py-2 text-gray-900 line-clamp-3">{entry.translated}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {preview.length > 5 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setPreviewExpanded((x) => !x) }}
                      className="mt-2 text-xs text-indigo-600 hover:underline"
                    >
                      {previewExpanded ? "Show less" : `Show all ${preview.length} preview entries…`}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Upload form ───────────────────────────────────────────────────────────────

function UploadForm({ onRunCreated }: { onRunCreated: (run: MediaRun) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [targetLanguage, setTargetLanguage] = useState(TARGET_LANGUAGES[0].label)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [translatingStartedAt, setTranslatingStartedAt] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? ""
    if (!ACCEPTED_EXTS.has(ext)) {
      setError("Please upload a .srt or .vtt file.")
      return
    }
    setError("")
    setFile(f)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleSubmit = useCallback(async () => {
    if (!file || uploading) return
    setUploading(true)
    setError("")

    try {
      // Step 1: Upload
      const fd = new FormData()
      fd.append("file", file)
      fd.append("targetLanguage", targetLanguage)
      const uploadRes = await fetch("/api/media/runs", { method: "POST", body: fd })
      const uploadData = await uploadRes.json() as { runId?: string; totalEntries?: number; error?: string }
      if (!uploadRes.ok || !uploadData.runId) {
        setError(uploadData.error ?? "Upload failed")
        return
      }

      const { runId, totalEntries = 0 } = uploadData

      // Optimistic run card
      const optimisticRun: MediaRun = {
        id: runId,
        fileName: file.name,
        fileFormat: file.name.split(".").pop()?.toLowerCase() ?? "srt",
        targetLanguage,
        status: "running",
        totalEntries,
        previewData: null,
        errorMessage: null,
        createdAt: new Date().toISOString(),
      }
      onRunCreated(optimisticRun)
      setTranslatingStartedAt(Date.now())

      // Step 2: Trigger translation
      const translateRes = await fetch(`/api/media/runs/${runId}/translate`, { method: "POST" })
      if (!translateRes.ok) {
        const td = await translateRes.json() as { error?: string }
        setError(td.error ?? "Translation trigger failed")
        return
      }

      // Step 3: Poll until completed or failed
      const POLL_INTERVAL = 4_000
      const MAX_POLLS = 200
      for (let p = 0; p < MAX_POLLS; p++) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL))
        try {
          const pollRes = await fetch(`/api/media/runs/${runId}`)
          if (!pollRes.ok) continue
          const polledRun = await pollRes.json() as MediaRun
          onRunCreated(polledRun)
          if (polledRun.status === "completed" || polledRun.status === "failed") break
        } catch { /* ignore transient errors */ }
      }

      // Reset form
      setFile(null)
      setTranslatingStartedAt(null)
      if (fileRef.current) fileRef.current.value = ""
    } finally {
      setUploading(false)
      setTranslatingStartedAt(null)
    }
  }, [file, targetLanguage, uploading, onRunCreated])

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-2">New Translation</h2>

      {/* Info */}
      <div className="mb-4 rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3 text-xs text-indigo-800 space-y-1">
        <p className="font-semibold text-indigo-900">How Media Studio works</p>
        <p>
          Upload a subtitle file, choose a target language, and AI translates every cue —
          preserving all timestamps exactly. Download the translated file and drop it straight
          into your video player or editor.
        </p>
        <p className="text-indigo-700">
          <strong>Supported formats:</strong> SRT (SubRip) · WebVTT · Max 5 MB per file
        </p>
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer select-none ${
          isDragging
            ? "border-indigo-400 bg-indigo-50"
            : file
            ? "border-green-400 bg-green-50"
            : "border-gray-300 hover:border-indigo-300 hover:bg-gray-50"
        }`}
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
      >
        <svg
          className={`w-10 h-10 mx-auto mb-2 transition-colors ${
            isDragging ? "text-indigo-400" : file ? "text-green-400" : "text-gray-300"
          }`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          {file ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          )}
        </svg>
        {file ? (
          <>
            <p className="text-sm font-medium text-green-700">{file.name}</p>
            <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB · click to change</p>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              {isDragging ? (
                <span className="font-medium text-indigo-600">Release to add file</span>
              ) : (
                <>Drop <strong>.srt</strong> or <strong>.vtt</strong> file here, or{" "}
                  <span className="text-indigo-600 font-medium underline">browse</span></>
              )}
            </p>
            <p className="text-xs text-gray-400 mt-1">Max 5 MB</p>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".srt,.vtt"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ""
        }}
      />

      {/* Language select */}
      <div className="mt-4">
        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
          Target Language
        </label>
        <select
          value={targetLanguage}
          onChange={(e) => setTargetLanguage(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
        >
          {TARGET_LANGUAGES.map((l) => (
            <option key={l.code} value={l.label}>{l.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {/* Translate button */}
      <button
        onClick={handleSubmit}
        disabled={!file || uploading}
        className="mt-4 w-full py-2.5 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {uploading ? (
          <span className="inline-flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {translatingStartedAt
              ? <><ElapsedTimer startedAt={translatingStartedAt} /> — translating…</>
              : "Uploading…"}
          </span>
        ) : (
          "Translate Subtitles"
        )}
      </button>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function MediaStudio({ initialRuns }: Props) {
  const [runs, setRuns] = useState<MediaRun[]>(initialRuns)

  const upsertRun = useCallback((run: MediaRun) => {
    setRuns((prev) => {
      const idx = prev.findIndex((r) => r.id === run.id)
      if (idx === -1) return [run, ...prev]
      const next = [...prev]
      next[idx] = run
      return next
    })
  }, [])

  const refreshRun = useCallback(async (runId: string) => {
    try {
      const res = await fetch(`/api/media/runs/${runId}`)
      if (!res.ok) return
      const data = await res.json() as MediaRun
      upsertRun(data)
    } catch { /* ignore */ }
  }, [upsertRun])

  return (
    <div className="space-y-6">
      <UploadForm onRunCreated={upsertRun} />

      {runs.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Recent Translations
            </h2>
          </div>
          <div className="space-y-3">
            {runs.slice(0, 5).map((run) => (
              <RunCard key={run.id} run={run} onRefresh={refreshRun} />
            ))}
          </div>
          {runs.length > 5 && (
            <p className="text-xs text-gray-400 mt-3 text-center">
              +{runs.length - 5} older runs not shown
            </p>
          )}
        </section>
      )}
    </div>
  )
}
