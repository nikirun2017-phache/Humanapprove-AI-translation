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

export function JobProgress({ initialJob }: Props) {
  const router = useRouter()
  const [job, setJob] = useState<Job>(initialJob)
  const [paused, setPaused] = useState(false)
  const [importing, setImporting] = useState<Record<string, boolean>>({})
  const [importingAll, setImportingAll] = useState(false)
  const [retrying, setRetrying] = useState<Record<string, boolean>>({})
  const runningRef = useRef(false)
  const pausedRef = useRef(false)

  pausedRef.current = paused

  const tasks = job.tasks
  const totalTasks = tasks.length
  const doneTasks = tasks.filter((t) => t.status === "completed" || t.status === "imported" || t.status === "failed").length
  const overallPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const allDone = doneTasks === totalTasks

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
    // Optimistically mark as running in local state
    setJob((j) => ({
      ...j,
      tasks: j.tasks.map((t) => t.id === task.id ? { ...t, status: "running" } : t),
    }))

    // Poll for progress while translating
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

    // Re-fetch to get latest state
    const latest = await fetchJob()
    if (!latest) { runningRef.current = false; return }

    const pending = latest.tasks.filter((t) => t.status === "pending")

    for (const task of pending) {
      if (pausedRef.current) break
      await translateTask(task)
    }

    runningRef.current = false
  }

  // Auto-start on mount if there are pending tasks
  useEffect(() => {
    const hasPending = initialJob.tasks.some((t) => t.status === "pending")
    if (hasPending) runTranslation()
  }, [])

  async function handleImport(task: Task) {
    setImporting((s) => ({ ...s, [task.id]: true }))
    const res = await fetch(
      `/api/translation-studio/jobs/${job.id}/tasks/${task.id}/import`,
      { method: "POST" }
    )
    if (res.ok) await fetchJob()
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
    const completed = job.tasks.filter(
      (t) => t.status === "completed" || t.status === "imported"
    )
    for (const task of completed) {
      downloadTask(task)
      await new Promise((r) => setTimeout(r, 300))
    }
  }

  const completedCount = tasks.filter((t) => t.status === "completed").length
  const failedCount = tasks.filter((t) => t.status === "failed").length
  const importedCount = tasks.filter((t) => t.status === "imported").length
  const readyCount = tasks.filter((t) => t.status === "completed" || t.status === "imported").length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{job.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {job.provider} · {job.model} · {totalTasks} languages
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

      {/* Overall progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Overall progress</span>
          <span className="text-sm text-gray-500">
            {doneTasks}/{totalTasks} languages
            {failedCount > 0 && <span className="ml-2 text-red-500">{failedCount} failed</span>}
            {importedCount > 0 && <span className="ml-2 text-purple-600">{importedCount} imported</span>}
          </span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${overallPct}%` }}
          />
        </div>
        {paused && !allDone && (
          <p className="text-xs text-yellow-600 mt-2">Paused — remaining languages will not start until resumed.</p>
        )}
      </div>

      {/* Completion banner — shown when all done and at least one task can be imported */}
      {allDone && completedCount > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-green-900">
              Translation complete — {completedCount} language{completedCount !== 1 ? "s" : ""} ready for human review
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              Import {completedCount === 1 ? "it" : "all"} as a review project to start approving, rejecting, and editing segments.
            </p>
          </div>
          <button
            onClick={handleImportAll}
            disabled={importingAll}
            className="shrink-0 bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap"
          >
            {importingAll
              ? "Importing…"
              : completedCount === 1
                ? "Import as review project →"
                : `Import all ${completedCount} as review projects →`}
          </button>
        </div>
      )}

      {/* All imported banner */}
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
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left">
              <th className="px-4 py-3 font-medium text-gray-600">Language</th>
              <th className="px-4 py-3 font-medium text-gray-600">Progress</th>
              <th className="px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {tasks.map((task) => {
              const pct = task.totalUnits > 0
                ? Math.round((task.completedUnits / task.totalUnits) * 100)
                : 0
              const isRunning = task.status === "running"

              return (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {getStudioLanguageName(task.targetLanguage)}
                    <span className="ml-2 text-xs text-gray-400">{task.targetLanguage}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            isRunning ? "bg-blue-400" : task.status === "failed" ? "bg-red-400" : "bg-green-500"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {task.completedUnits}/{task.totalUnits}
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
                      {task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {(task.status === "completed" || task.status === "imported") && (
                        <button
                          onClick={() => downloadTask(task)}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          Download
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
                        >
                          {importing[task.id] ? "Importing…" : "Import as project"}
                        </button>
                      )}
                      {task.status === "imported" && task.projectId && (
                        <Link
                          href={`/projects/${task.projectId}`}
                          className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                        >
                          View project →
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
