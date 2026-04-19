"use client"

import { useState, useCallback, useRef, useMemo, useEffect } from "react"

// ─── Types ─────────────────────────────────────────────────────────────────────

type ErrorType = "acc" | "lang" | "style"

interface LqaError {
  type: ErrorType
  description: string
  suggestion: string
}

interface LqaFinding {
  unitId: string
  sourceText: string
  targetText: string
  errors: LqaError[]
}

interface LqaRun {
  id: string
  fileName: string
  fileFormat: string
  sourceLanguage: string
  targetLanguage: string
  status: "pending" | "running" | "completed" | "failed"
  totalUnits: number
  qualityScore: number | null
  qualityBand: "High" | "Medium" | "Low" | null
  accuracyErrors: number
  languageErrors: number
  styleErrors: number
  findings?: LqaFinding[]
  revisionStatus: string | null
  errorMessage: string | null
  createdAt: string
}

interface Props {
  initialRuns: Omit<LqaRun, "findings">[]
}

interface QueuedFile {
  fileId: string
  file: File
  status: "waiting" | "uploading" | "analyzing" | "done" | "error"
  error?: string
  totalUnits?: number
  analyzingStartedAt?: number
}

const QUEUE_STATUS_LABELS: Record<QueuedFile["status"], string> = {
  waiting: "Waiting",
  uploading: "Uploading…",
  analyzing: "Analyzing…",
  done: "Done",
  error: "Error",
}

const QUEUE_STATUS_COLORS: Record<QueuedFile["status"], string> = {
  waiting: "bg-gray-100 text-gray-600",
  uploading: "bg-blue-100 text-blue-700",
  analyzing: "bg-blue-100 text-blue-700 animate-pulse",
  done: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
}

const ACCEPTED_EXTS = new Set(["xliff", "xlf", "tmx", "mxliff"])

// ─── Time-estimate helpers ─────────────────────────────────────────────────────

/** Rough estimate: ~4 seconds per batch of 25 units */
function estimateSecs(totalUnits: number): number {
  return Math.max(10, Math.ceil(totalUnits / 25) * 4)
}

function formatDuration(secs: number): string {
  if (secs < 60) return `~${secs}s`
  const m = Math.ceil(secs / 60)
  return `~${m} min`
}

/** Live elapsed-time counter, updates every second */
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

// ─── Helpers ───────────────────────────────────────────────────────────────────

const ERROR_LABELS: Record<ErrorType, string> = {
  acc: "ACCURACY",
  lang: "LANGUAGE",
  style: "STYLE",
}

const ERROR_COLORS: Record<ErrorType, string> = {
  acc: "bg-red-50 border-red-200 text-red-800",
  lang: "bg-orange-50 border-orange-200 text-orange-800",
  style: "bg-yellow-50 border-yellow-200 text-yellow-800",
}

const ERROR_BADGE: Record<ErrorType, string> = {
  acc: "bg-red-100 text-red-700",
  lang: "bg-orange-100 text-orange-700",
  style: "bg-yellow-100 text-yellow-700",
}


function ScoreBadge({ score, band }: { score: number | null; band: string | null }) {
  if (score === null) return null
  const color =
    band === "High"
      ? "bg-green-100 text-green-800 border-green-300"
      : band === "Medium"
      ? "bg-yellow-100 text-yellow-800 border-yellow-300"
      : "bg-red-100 text-red-800 border-red-300"
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-sm font-bold ${color}`}>
      {score}/100 <span className="font-normal text-xs">({band})</span>
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-gray-100 text-gray-600",
    running: "bg-blue-100 text-blue-700 animate-pulse",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status}
    </span>
  )
}

// ─── Findings panel ────────────────────────────────────────────────────────────

function FindingsPanel({ findings }: { findings: LqaFinding[] }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? findings : findings.slice(0, 5)

  if (findings.length === 0) {
    return (
      <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
        Excellent quality — no issues found
      </p>
    )
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
        Findings ({findings.length} units with issues)
      </p>
      {shown.map((f) => (
        <div key={f.unitId} className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Unit header */}
          <div className="bg-gray-50 px-3 py-1.5 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-gray-500">{f.unitId}</span>
            <div className="flex gap-1">
              {f.errors.map((e, i) => (
                <span key={i} className={`text-xs px-1.5 py-0.5 rounded font-medium ${ERROR_BADGE[e.type]}`}>
                  {ERROR_LABELS[e.type]}
                </span>
              ))}
            </div>
          </div>
          {/* Source / Target preview */}
          <div className="px-3 py-2 space-y-2">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-gray-400 font-medium mb-0.5">Source</p>
                <p className="text-gray-700 leading-relaxed line-clamp-3">{f.sourceText}</p>
              </div>
              <div>
                <p className="text-gray-400 font-medium mb-0.5">Target (current)</p>
                <p className="text-gray-700 leading-relaxed line-clamp-3">{f.targetText || <em className="text-gray-400">empty</em>}</p>
              </div>
            </div>
            {/* Per-error detail */}
            {f.errors.map((e, i) => (
              <div key={i} className={`rounded px-2.5 py-2 border text-xs ${ERROR_COLORS[e.type]}`}>
                <p className="font-semibold mb-0.5">[{ERROR_LABELS[e.type]}] {e.description}</p>
                <p className="opacity-90">Suggestion: {e.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
      {findings.length > 5 && (
        <button
          onClick={() => setExpanded((x) => !x)}
          className="text-xs text-indigo-600 hover:underline"
        >
          {expanded ? "Show less" : `Show all ${findings.length} findings…`}
        </button>
      )}
    </div>
  )
}

// ─── Run card ─────────────────────────────────────────────────────────────────

function RunCard({ run, onRefresh }: { run: LqaRun; onRefresh: (id: string) => Promise<void> }) {
  const [expanded, setExpanded] = useState(false)
  const [showReviseForm, setShowReviseForm] = useState(false)
  const [revising, setRevising] = useState(false)
  const [reviseError, setReviseError] = useState("")

  const handleRevise = async () => {
    setRevising(true)
    setReviseError("")
    try {
      const res = await fetch(`/api/lqa/runs/${run.id}/revise`, { method: "POST" })
      const data = await res.json() as { error?: string }
      if (!res.ok) {
        setReviseError(data.error ?? "Revision failed")
      } else {
        setShowReviseForm(false)
        await onRefresh(run.id)
      }
    } finally {
      setRevising(false)
    }
  }

  const totalErrors = run.accuracyErrors + run.languageErrors + run.styleErrors
  const canRevise =
    run.status === "completed" &&
    run.revisionStatus !== "completed" &&
    run.revisionStatus !== "running" &&
    totalErrors > 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Summary row — always visible */}
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
              {run.sourceLanguage && run.targetLanguage
                ? `${run.sourceLanguage} → ${run.targetLanguage} · `
                : ""}
              {run.totalUnits} units · {new Date(run.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {run.status === "completed" && <ScoreBadge score={run.qualityScore} band={run.qualityBand} />}
          <StatusBadge status={run.status} />
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-5">

          {/* Error breakdown */}
          {run.status === "completed" && (
            <>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                  <span className="text-gray-600">Accuracy: <strong>{run.accuracyErrors}</strong> <span className="text-gray-400 text-xs">(-3 pts each)</span></span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
                  <span className="text-gray-600">Language: <strong>{run.languageErrors}</strong> <span className="text-gray-400 text-xs">(-2 pts each)</span></span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shrink-0" />
                  <span className="text-gray-600">Style: <strong>{run.styleErrors}</strong> <span className="text-gray-400 text-xs">(-1 pt each)</span></span>
                </span>
              </div>

              {/* Findings detail */}
              {run.findings ? (
                <FindingsPanel findings={run.findings} />
              ) : (
                <button
                  className="mt-2 text-xs text-indigo-600 hover:underline"
                  onClick={(e) => { e.stopPropagation(); void onRefresh(run.id) }}
                >
                  Load findings detail
                </button>
              )}
            </>
          )}

          {/* Failure message */}
          {run.status === "failed" && run.errorMessage && (
            <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {run.errorMessage}
            </div>
          )}

          {/* Action buttons */}
          {run.status === "completed" && (
            <div className="mt-4 flex flex-wrap gap-2 items-center">

              {/* Download Excel */}
              <a
                href={`/api/lqa/runs/${run.id}/report`}
                download
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Report (.xlsx)
              </a>

              {/* Revise button — only when there are errors and not yet revised */}
              {canRevise && !showReviseForm && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowReviseForm(true) }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Revise File ({totalErrors} issue{totalErrors !== 1 ? "s" : ""})
                </button>
              )}

              {/* Revision in-progress */}
              {run.revisionStatus === "running" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-lg">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Revising…
                </span>
              )}

              {/* Revision failed */}
              {run.revisionStatus === "failed" && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowReviseForm(true) }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-300 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
                >
                  Retry Revision
                </button>
              )}

              {/* Download revised file */}
              {run.revisionStatus === "completed" && (
                <a
                  href={`/api/lqa/runs/${run.id}/revised`}
                  download
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Revised File
                </a>
              )}
            </div>
          )}

          {/* Inline revise form */}
          {showReviseForm && (
            <div
              className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-semibold text-amber-900">
                Claude will apply fixes for {totalErrors} reported issue{totalErrors !== 1 ? "s" : ""} and return a corrected file.
              </p>
              {reviseError && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                  {reviseError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleRevise}
                  disabled={revising}
                  className="flex-1 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-colors"
                >
                  {revising ? "Revising…" : "Apply Fixes"}
                </button>
                <button
                  onClick={() => { setShowReviseForm(false); setReviseError("") }}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Upload form ───────────────────────────────────────────────────────────────

function UploadForm({ onRunCreated }: { onRunCreated: (run: LqaRun) => void }) {
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [processing, setProcessing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((files: FileList | File[]) => {
    const newEntries: QueuedFile[] = Array.from(files)
      .filter((f) => ACCEPTED_EXTS.has(f.name.split(".").pop()?.toLowerCase() ?? ""))
      .map((f) => ({
        fileId: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file: f,
        status: "waiting" as const,
      }))
    if (newEntries.length) setQueue((prev) => [...prev, ...newEntries])
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }, [])
  const handleDrop      = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const updateFile = useCallback((fileId: string, patch: Partial<QueuedFile>) => {
    setQueue((prev) => prev.map((f) => (f.fileId === fileId ? { ...f, ...patch } : f)))
  }, [])

  const handleRunAll = useCallback(async () => {
    const pending = queue.filter((f) => f.status === "waiting" || f.status === "error")
    if (pending.length === 0 || processing) return
    setProcessing(true)

    try {
      for (const qf of pending) {
        updateFile(qf.fileId, { status: "uploading", error: undefined })

        // Step 1: Upload & parse
        const fd = new FormData()
        fd.append("file", qf.file)
        const uploadRes = await fetch("/api/lqa/runs", { method: "POST", body: fd })
        const uploadData = await uploadRes.json() as {
          runId?: string; totalUnits?: number; sourceLanguage?: string; targetLanguage?: string; error?: string
        }
        if (!uploadRes.ok || !uploadData.runId) {
          updateFile(qf.fileId, { status: "error", error: uploadData.error ?? "Upload failed" })
          continue
        }

        const { runId, totalUnits = 0, sourceLanguage = "", targetLanguage = "" } = uploadData

        // Optimistic run card
        const runningRun: LqaRun = {
          id: runId,
          fileName: qf.file.name,
          fileFormat: qf.file.name.split(".").pop()?.toLowerCase() ?? "xliff",
          sourceLanguage,
          targetLanguage,
          status: "running",
          totalUnits,
          qualityScore: null,
          qualityBand: null,
          accuracyErrors: 0,
          languageErrors: 0,
          styleErrors: 0,
          revisionStatus: null,
          errorMessage: null,
          createdAt: new Date().toISOString(),
        }
        onRunCreated(runningRun)

        // Step 2: Trigger AI analysis (route returns 202 immediately; analysis runs in background)
        updateFile(qf.fileId, { status: "analyzing", totalUnits, analyzingStartedAt: Date.now() })
        const analyzeRes = await fetch(`/api/lqa/runs/${runId}/analyze`, { method: "POST" })
        if (!analyzeRes.ok) {
          const analyzeData = await analyzeRes.json() as { error?: string }
          updateFile(qf.fileId, { status: "error", error: analyzeData.error ?? "Analysis failed" })
          onRunCreated({ ...runningRun, status: "failed", errorMessage: analyzeData.error ?? "Analysis failed" })
          continue
        }

        // Step 3: Poll until analysis completes (handles files of any size)
        const POLL_INTERVAL = 3_000
        const MAX_POLLS = 200 // 10 min max
        let done = false
        for (let p = 0; p < MAX_POLLS && !done; p++) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL))
          try {
            const pollRes = await fetch(`/api/lqa/runs/${runId}`)
            if (!pollRes.ok) continue
            const polledRun = await pollRes.json() as LqaRun
            if (polledRun.status === "completed") {
              updateFile(qf.fileId, { status: "done" })
              onRunCreated(polledRun)
              done = true
            } else if (polledRun.status === "failed") {
              updateFile(qf.fileId, { status: "error", error: polledRun.errorMessage ?? "Analysis failed" })
              onRunCreated(polledRun)
              done = true
            }
          } catch { /* ignore transient errors, keep polling */ }
        }
        if (!done) {
          updateFile(qf.fileId, { status: "error", error: "Analysis is taking too long — check back later" })
        }
      }
    } finally {
      setProcessing(false)
    }
  }, [queue, processing, onRunCreated, updateFile])

  const removeFile = useCallback((fileId: string) => {
    setQueue((prev) => prev.filter((f) => f.fileId !== fileId))
  }, [])

  const clearDone = useCallback(() => {
    setQueue((prev) => prev.filter((f) => f.status !== "done"))
  }, [])

  const pendingCount = useMemo(
    () => queue.filter((f) => f.status === "waiting" || f.status === "error").length,
    [queue]
  )
  const hasDone = useMemo(() => queue.some((f) => f.status === "done"), [queue])

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-2">New LQA Run</h2>

      {/* Help text */}
      <div className="mb-4 rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3 text-xs text-indigo-800 space-y-1">
        <p className="font-semibold text-indigo-900">How LQA works</p>
        <p>
          AI reviews every translation unit and flags <strong>Accuracy</strong> (mistranslations, missing content),{" "}
          <strong>Language</strong> (grammar, spelling, terminology) and <strong>Style</strong> (fluency, readability) errors.
          A normalised quality score (0–100) is calculated so results are comparable regardless of file size.
        </p>
        <p className="text-indigo-700">
          <strong>Processing time:</strong> roughly <strong>4 s per 25 units</strong> — a 100-unit file takes ~16 s,
          a 500-unit file ~80 s. You can leave this page; the run will appear in your history when done.
        </p>
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer select-none ${
          isDragging
            ? "border-indigo-400 bg-indigo-50"
            : "border-gray-300 hover:border-indigo-300 hover:bg-gray-50"
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
      >
        <svg
          className={`w-10 h-10 mx-auto mb-2 transition-colors ${isDragging ? "text-indigo-400" : "text-gray-300"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm text-gray-600">
          {isDragging ? (
            <span className="font-medium text-indigo-600">Release to add files</span>
          ) : (
            <>
              Drop <strong>.xliff</strong>, <strong>.xlf</strong>, <strong>.mxliff</strong> or{" "}
              <strong>.tmx</strong> files here, or{" "}
              <span className="text-indigo-600 font-medium underline">browse</span>
            </>
          )}
        </p>
        <p className="text-xs text-gray-400 mt-1">Multiple files supported · Max 5 MB each</p>
      </div>

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".xliff,.xlf,.tmx,.mxliff"
        multiple
        onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = "" }}
      />

      {queue.length > 0 && (
        <>
          {/* File queue */}
          <div className="mt-4 space-y-2">
            {queue.map((qf) => (
              <div key={qf.fileId} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200">
                <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{qf.file.name}</p>
                  {qf.error ? (
                    <p className="text-xs text-red-600 truncate">{qf.error}</p>
                  ) : qf.status === "analyzing" && qf.totalUnits && qf.analyzingStartedAt ? (
                    <p className="text-xs text-blue-600">
                      {formatDuration(estimateSecs(qf.totalUnits))} · {qf.totalUnits} units ·{" "}
                      <ElapsedTimer startedAt={qf.analyzingStartedAt} />
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400">{(qf.file.size / 1024).toFixed(1)} KB</p>
                  )}
                </div>
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium ${QUEUE_STATUS_COLORS[qf.status]}`}>
                  {QUEUE_STATUS_LABELS[qf.status]}
                </span>
                {qf.status !== "uploading" && qf.status !== "analyzing" && (
                  <button
                    onClick={() => removeFile(qf.fileId)}
                    className="shrink-0 text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Action row */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleRunAll}
              disabled={processing || pendingCount === 0}
              className="flex-1 py-2.5 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {processing ? (() => {
                const analyzing = queue.find((f) => f.status === "analyzing")
                if (analyzing?.totalUnits) {
                  return `Analyzing… ${formatDuration(estimateSecs(analyzing.totalUnits))} est for this file`
                }
                return "Analyzing…"
              })() : `Run LQA on ${pendingCount} file${pendingCount !== 1 ? "s" : ""}`}
            </button>
            {hasDone && !processing && (
              <button
                onClick={clearDone}
                className="px-4 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear done
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function LqaStudio({ initialRuns }: Props) {
  // Runs are keyed by id. When onRunCreated fires for the same id (status update),
  // we replace the existing entry rather than prepend a duplicate.
  const [runs, setRuns] = useState<LqaRun[]>(initialRuns as LqaRun[])

  const upsertRun = useCallback((run: LqaRun) => {
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
      const res = await fetch(`/api/lqa/runs/${runId}`)
      if (!res.ok) return
      const data = await res.json() as LqaRun
      upsertRun(data)
    } catch { /* ignore */ }
  }, [upsertRun])

  return (
    <div className="space-y-6">
      <UploadForm onRunCreated={upsertRun} />

      {runs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
            LQA Runs
          </h2>
          <div className="space-y-3">
            {runs.map((run) => (
              <RunCard key={run.id} run={run} onRefresh={refreshRun} />
            ))}
          </div>
        </section>
      )}

      {runs.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">
          No LQA runs yet. Upload a bilingual file above to get started.
        </div>
      )}
    </div>
  )
}
