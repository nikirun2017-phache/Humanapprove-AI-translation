"use client"

import { useState, useEffect, useRef } from "react"
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
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Waiting",
  running: "Translating…",
  completed: "Done",
  failed: "Failed",
}

export function JobProgress({ initialJob }: Props) {
  const [job, setJob] = useState<Job>(initialJob)
  const [paused, setPaused] = useState(false)
  const [retrying, setRetrying] = useState<Record<string, boolean>>({})
  const [autoDownloaded, setAutoDownloaded] = useState(false)
  const runningRef = useRef(false)
  const pausedRef = useRef(false)
  const autoDownloadedRef = useRef(false)

  pausedRef.current = paused

  const tasks = job.tasks
  const totalTasks = tasks.length
  const doneTasks = tasks.filter((t: Task) => t.status === "completed" || t.status === "failed").length
  const overallPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const allDone = doneTasks === totalTasks
  const completedCount = tasks.filter((t: Task) => t.status === "completed").length
  const failedCount = tasks.filter((t: Task) => t.status === "failed").length
  const readyCount = tasks.filter((t: Task) => t.status === "completed").length
  const runningTask = tasks.find((t: Task) => t.status === "running")

  const isPdf = job.sourceFormat === "pdf"

  function triggerDownload(url: string) {
    const a = document.createElement("a")
    a.href = url
    a.download = ""
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Auto-download all completed files as soon as translation finishes
  useEffect(() => {
    if (allDone && completedCount > 0 && !autoDownloadedRef.current) {
      autoDownloadedRef.current = true
      setAutoDownloaded(true)
      ;(async () => {
        for (const task of tasks) {
          if (task.status === "completed") {
            const base = `/api/translation-studio/jobs/${job.id}/tasks/${task.id}/download`
            if (isPdf) {
              // PDF source: download translated .txt then .pdf
              triggerDownload(`${base}?format=txt`)
              await new Promise(r => setTimeout(r, 800))
              triggerDownload(`${base}?format=pdf`)
              await new Promise(r => setTimeout(r, 800))
            } else {
              triggerDownload(base)
              await new Promise(r => setTimeout(r, 800))
            }
          }
        }
      })()
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
      tasks: j.tasks.map((t: Task) => t.id === task.id ? { ...t, status: "running" } : t),
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

    // Include "running" tasks — they may be stale from a dead browser session
    // The translate API accepts them and resets progress from scratch
    const pending = latest.tasks.filter((t: Task) => t.status === "pending" || t.status === "running")

    for (const task of pending) {
      if (pausedRef.current) break
      await translateTask(task)
    }

    runningRef.current = false
  }

  useEffect(() => {
    // Resume if there are pending tasks OR stale "running" tasks from a
    // previous session that was closed mid-translation
    const hasActive = initialJob.tasks.some(
      (t: Task) => t.status === "pending" || t.status === "running"
    )
    if (hasActive) runTranslation()
  }, [])

  async function handleRetry(task: Task) {
    setRetrying((s) => ({ ...s, [task.id]: true }))
    await translateTask(task)
    setRetrying((s) => ({ ...s, [task.id]: false }))
  }

  async function retryAllFailed() {
    const failed = job.tasks.filter((t: Task) => t.status === "failed")
    for (const task of failed) {
      if (pausedRef.current) break
      await handleRetry(task)
    }
  }

  async function downloadTask(task: Task) {
    const base = `/api/translation-studio/jobs/${job.id}/tasks/${task.id}/download`
    if (isPdf) {
      triggerDownload(`${base}?format=txt`)
      await new Promise(r => setTimeout(r, 600))
      triggerDownload(`${base}?format=pdf`)
    } else {
      triggerDownload(base)
    }
  }

  async function downloadAll() {
    const ready = tasks.filter((t) => t.status === "completed")
    for (const task of ready) {
      await downloadTask(task)
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
        text: `Translating ${langName} — ${pct}% done. You'll receive an email when all files are ready — you can close this tab if needed.`,
      }
    }
    const pendingCount = tasks.filter((t: Task) => t.status === "pending").length
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
              title={paused
                ? "Resume — continue translating remaining languages"
                : "Pause after the current language finishes. The translation in progress will not be interrupted."}
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
              {autoDownloaded ? `Re-download all (${readyCount})` : `Download all (${readyCount})`}
            </button>
          )}
        </div>
      </div>

      {/* PDF output notice */}
      {job.sourceFormat === "pdf" && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <span className="text-blue-500 mt-0.5 shrink-0">ℹ</span>
          <p className="text-sm text-blue-800">
            <strong>Two files download automatically when done:</strong> a <strong>.txt</strong> you can open, copy, or import anywhere, and a <strong>.pdf</strong> with the translated content ready to share. Original layout is not preserved.
          </p>
        </div>
      )}

      {/* Live progress message */}
      {progressMsg && (
        <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${progressMsg.color}`}>
          {progressMsg.icon === "✦" ? (
            <svg className="shrink-0 w-4 h-4 animate-spin text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <span className="shrink-0">{progressMsg.icon}</span>
          )}
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
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
            <svg className="w-3 h-3 animate-spin shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Language {doneTasks + 1} of {totalTasks} in progress · We'll email you when done
          </p>
        )}
      </div>

      {/* Completion banner */}
      {allDone && completedCount > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="text-sm font-semibold text-green-900">
                {completedCount} {completedCount !== 1 ? "files" : "file"} ready — downloading to your Downloads folder
              </p>
              <p className="text-xs text-green-700 mt-1">
                Use the buttons below to re-download any file.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Languages</p>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-50">
            {tasks.map((task: Task) => {
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
                      {task.status === "completed" && !isPdf && (
                        <button
                          onClick={() => downloadTask(task)}
                          className="text-xs text-gray-500 hover:text-gray-700 underline"
                        >
                          Download
                        </button>
                      )}
                      {task.status === "completed" && isPdf && (
                        <>
                          <a
                            href={`/api/translation-studio/jobs/${job.id}/tasks/${task.id}/download?format=txt`}
                            download
                            className="text-xs text-gray-500 hover:text-gray-700 underline"
                          >
                            .txt
                          </a>
                          <a
                            href={`/api/translation-studio/jobs/${job.id}/tasks/${task.id}/download?format=pdf`}
                            download
                            className="text-xs text-indigo-600 hover:text-indigo-800 underline font-medium"
                          >
                            .pdf
                          </a>
                        </>
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
