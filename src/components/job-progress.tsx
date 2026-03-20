"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getStudioLanguageName } from "@/lib/languages"
import { cn } from "@/lib/utils"

interface Task {
  id: string
  targetLanguage: string
  status: string
  totalUnits: number
  completedUnits: number
  errorMessage: string | null
  projectId: string | null
}

interface Job {
  id: string
  name: string
  provider: string
  model: string
  status: string
  sourceFormat: string
  tasks: Task[]
  createdBy: { name: string }
}

interface Props {
  initialJob: Job
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-500",
  running: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  imported: "bg-purple-100 text-purple-700",
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Waiting",
  running: "Translating…",
  completed: "Done",
  failed: "Failed",
  imported: "In review",
}

export function JobProgress({ initialJob }: Props) {
  const router = useRouter()
  const [job, setJob] = useState<Job>(initialJob)
  const [paused, setPaused] = useState(false)
  const [importing, setImporting] = useState<Record<string, boolean>>({})
  const [importingAll, setImportingAll] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<Record<string, boolean>>({})
  const [autoDownloaded, setAutoDownloaded] = useState(false)
  const runningRef = useRef(false)
  const pausedRef = useRef(false)
  const autoDownloadedRef = useRef(false)

  pausedRef.current = paused

  const tasks = job.tasks
  const totalTasks = tasks.length
  const doneTasks = tasks.filter((t) => t.status === "completed" || t.status === "imported" || t.status === "failed").length
  const overallPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const allDone = doneTasks === totalTasks
  const completedCount = tasks.filter((t) => t.status === "completed").length
  const failedCount = tasks.filter((t) => t.status === "failed").length
  const importedCount = tasks.filter((t) => t.status === "imported").length
  const readyCount = tasks.filter((t) => t.status === "completed" || t.status === "imported").length
  const runningTask = tasks.find((t) => t.status === "running")

  // Auto-download all completed files as soon as translation finishes
  useEffect(() => {
    if (allDone && completedCount > 0 && !autoDownloadedRef.current) {
      autoDownloadedRef.current = true
      setAutoDownloaded(true)
      // Small delay so the browser doesn't block multiple simultaneous downloads
      setTimeout(() => downloadAll(), 500)
    }
  }, [allDone, completedCount])

  async function fetchJob() {
    const res = await fetch(`/api/translation-studio/jobs/${job.id}`)
    if (res.ok) {
      const data = await res.json() as Job
      setJob(data)
      return data
    }
    return null
  }

  async function translateTask(task: Task) {
    setJob((j) => ({
      ...j,
      tasks: j.tasks.map((t) => t.id === task.id ? { ...t, status: "running" } : t),
    }))

    const pollInterval = setInterval(async () => {
      const updated = await fetchJob()
      if (!updated) clearInterval(pollInterval)
    }, 2500)

    try {
      const res = await fetch(
        `/api/translation-studio/jobs/${job.id}/tasks/${task.id}/translate`,
        { method: "POST" }
      )
      clearInterval(pollInterval)
      await fetchJob()
      return res.ok
    } catch {
      clearInterval(pollInterval)
      await fetchJob()
      return false
    }
  }

  async function runTranslation() {
    if (runningRef.current) return
    runningRef.current = true

    const latest = await fetchJob()
    if (!latest) { runningRef.current = false; return }

    const pending = latest.tasks.filter((t) => t.status === "pending")

    for (const task of pending) {
      if (pausedRef.current) break
      await translateTask(task)
    }

    runningRef.current = false
  }

  useEffect(() => {
    const hasPending = initialJob.tasks.some((t) => t.status === "pending")
    if (hasPending) runTranslation()
  }, [])

  async function handleImport(task: Task) {
    setImporting((s) => ({ ...s, [task.id]: true }))
    setImportError(null)
    const res = await fetch(
      `/api/translation-studio/jobs/${job.id}/tasks/${task.id}/import`,
      { method: "POST" }
    )
    if (res.ok) {
      await fetchJob()
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string }
      setImportError(data.error ?? `Import failed (HTTP ${res.status})`)
    }
    setImporting((s) => ({ ...s, [task.id]: false }))
  }

  async function handleRetry(task: Task) {
    setRetrying((s) => ({ ...s, [task.id]: true }))
    await translateTask(task)
    setRetrying((s) => ({ ...s, [task.id]: false }))
  }

  async function retryAllFailed() {
    const failed = job.tasks.filter((t) => t.status === "failed")
    for (const task of failed) {
      if (pausedRef.current) break
      await handleRetry(task)
    }
  }

  async function handleImportAll() {
    setImportingAll(true)
    const completed = job.tasks.filter((t) => t.status === "completed")
    for (const task of completed) {
      await handleImport(task)
    }
    setImportingAll(false)
    router.push("/dashboard")
  }

  function downloadTask(task: Task) {
    const a = document.createElement("a")
    a.href = `/api/translation-studio/jobs/${job.id}/tasks/${task.id}/download`
    a.download = ""
    a.click()
  }

  async function downloadAll() {
    const ready = tasks.filter(
      (t) => t.status === "completed" || t.status === "imported"
    )
    for (const task of ready) {
      downloadTask(task)
      await new Promise((r) => setTimeout(r, 300))
    }
  }

  // Dynamic progress message shown to the user
  function getProgressMessage() {
    if (allDone && autoDownloaded) {
      return null // replaced by the completion banner below
    }
    if (paused) {
      return { icon: "⏸", color: "bg-yellow-50 border-yellow-200 text-yellow-800", text: "Paused — click Resume to continue translating the remaining languages." }
    }
    if (runningTask) {
      const langName = getStudioLanguageName(runningTask.targetLanguage)
      const pct = runningTask.totalUnits > 0
        ? Math.round((runningTask.completedUnits / runningTask.totalUnits) * 100)
        : 0
      return {
        icon: "✦",
        color: "bg-indigo-50 border-indigo-200 text-indigo-800",
        text: `AI is translating into ${langName} — ${pct}% done. Please keep this tab open. This usually takes under a minute per language.`,
      }
    }
    const pendingCount = tasks.filter((t) => t.status === "pending").length
    if (pendingCount > 0) {
      return { icon: "⏳", color: "bg-gray-50 border-gray-200 text-gray-600", text: `${pendingCount} language${pendingCount !== 1 ? "s" : ""} queued and will start automatically.` }
    }
    return null
  }

  const progressMsg = getProgressMessage()

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{job.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {job.provider} · {job.model} · {totalTasks} language{totalTasks !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {!allDone && (
            <button
              onClick={() => {
                if (paused) {
                  setPaused(false)
                  setTimeout(runTranslation, 0)
                } else {
                  setPaused(true)
                }
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {paused ? "Resume" : "Pause"}
            </button>
          )}
          {failedCount > 0 && allDone && (
            <button
              onClick={retryAllFailed}
              className="px-3 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
            >
              Retry failed ({failedCount})
            </button>
          )}
          {readyCount > 0 && (
            <button
              onClick={downloadAll}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Download all ({readyCount})
            </button>
          )}
        </div>
      </div>

      {/* PDF text-only notice */}
      {job.sourceFormat === "pdf" && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <span className="text-blue-500 mt-0.5 shrink-0">ℹ</span>
          <p className="text-sm text-blue-800">
            <strong>Plain text output only.</strong> Translated content is available as .xliff — the original PDF layout and formatting are not reconstructed.
          </p>
        </div>
      )}

      {/* Live progress message */}
      {progressMsg && (
        <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${progressMsg.color}`}>
          <span className="shrink-0 mt-0.5">{progressMsg.icon}</span>
          <p className="text-sm">{progressMsg.text}</p>
        </div>
      )}

      {/* Overall progress bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            {allDone ? "Translation complete" : "Translating…"}
          </span>
          <span className="text-sm text-gray-500">
            {doneTasks}/{totalTasks} languages
            {failedCount > 0 && <span className="ml-2 text-red-500">{failedCount} failed</span>}
            {importedCount > 0 && <span className="ml-2 text-purple-600">{importedCount} in review</span>}
          </span>
        </div>
        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              allDone && failedCount === 0 ? "bg-green-500" : allDone ? "bg-amber-400" : "bg-indigo-500"
            )}
            style={{ width: `${overallPct}%` }}
          />
        </div>
        {!allDone && (
          <p className="text-xs text-gray-400 mt-2">
            Step {doneTasks + 1} of {totalTasks} · Do not close this tab
          </p>
        )}
      </div>

      {/* ── Completion banner ── */}
      {allDone && completedCount > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="text-sm font-semibold text-green-900">
                {completedCount} translation{completedCount !== 1 ? "s" : ""} ready — files are downloading to your Downloads folder
              </p>
              <p className="text-xs text-green-700 mt-1">
                Your translated {completedCount === 1 ? "file has" : "files have"} been saved automatically.
                You can also re-download them any time using the buttons below.
              </p>
            </div>
          </div>

          <div className="border-t border-green-200 pt-4">
            <p className="text-sm font-medium text-green-900 mb-1">
              Want a human to check the translation?
            </p>
            <p className="text-xs text-gray-600 mb-3">
              A reviewer will go through each sentence, approve or fix it, and give you a clean, verified file.
              This is optional — skip it if you are happy with the AI output.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleImportAll}
                disabled={importingAll}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap"
              >
                {importingAll
                  ? "Creating project…"
                  : completedCount === 1
                    ? "Yes — create review project"
                    : `Yes — create ${completedCount} review projects`}
              </button>
              <Link
                href="/dashboard"
                className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
              >
                No thanks, I&apos;m done →
              </Link>
            </div>
            {importError && (
              <p className="text-xs text-red-600 mt-2">Error: {importError}</p>
            )}
          </div>
        </div>
      )}

      {/* All already imported banner */}
      {allDone && completedCount === 0 && importedCount > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-purple-900">
              {importedCount} review project{importedCount !== 1 ? "s" : ""} created
            </p>
            <p className="text-xs text-purple-700 mt-0.5">
              Head to your dashboard to assign reviewers and start the review workflow.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap"
          >
            Go to Dashboard →
          </Link>
        </div>
      )}

      {/* Task list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Languages</p>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-50">
            {tasks.map((task) => {
              const pct = task.totalUnits > 0
                ? Math.round((task.completedUnits / task.totalUnits) * 100)
                : 0
              const isRunning = task.status === "running"

              return (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 w-48">
                    {getStudioLanguageName(task.targetLanguage)}
                    <span className="block text-xs text-gray-400 font-normal">{task.targetLanguage}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-28 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            isRunning ? "bg-blue-400" : task.status === "failed" ? "bg-red-400" : "bg-green-500"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {task.completedUnits}/{task.totalUnits} strings
                      </span>
                    </div>
                    {task.errorMessage && (
                      <p className="text-xs text-red-500 mt-0.5 truncate max-w-xs" title={task.errorMessage}>
                        {task.errorMessage}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full",
                      STATUS_STYLES[task.status] ?? "bg-gray-100 text-gray-500"
                    )}>
                      {STATUS_LABELS[task.status] ?? task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {(task.status === "completed" || task.status === "imported") && (
                        <button
                          onClick={() => downloadTask(task)}
                          className="text-xs text-gray-500 hover:text-gray-700 underline"
                        >
                          Re-download
                        </button>
                      )}
                      {task.status === "failed" && (
                        <button
                          onClick={() => handleRetry(task)}
                          disabled={retrying[task.id]}
                          className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                        >
                          {retrying[task.id] ? "Retrying…" : "Retry"}
                        </button>
                      )}
                      {task.status === "completed" && (
                        <button
                          onClick={() => handleImport(task)}
                          disabled={importing[task.id]}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
                          title={importError ?? undefined}
                        >
                          {importing[task.id] ? "Creating…" : importError ? "Retry import" : "Create review project"}
                        </button>
                      )}
                      {task.status === "imported" && task.projectId && (
                        <Link
                          href={`/projects/${task.projectId}`}
                          className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                        >
                          View review →
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
