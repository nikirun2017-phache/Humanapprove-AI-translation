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
  integrationId?: string | null
  integrationMeta?: string | null
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

const CONNECTOR_ICONS: Record<string, string> = {
  pendo: "🎯",
  webflow: "🌐",
  salesforce: "☁️",
  zendesk: "🎧",
  contentful: "🧩",
  wordpress: "📝",
  hubspot: "🧲",
  jira: "🔷",
  slack: "💬",
  qualtrics: "📊",
  marketo: "📧",
  googledrive: "📁",
  sharepoint: "🏢",
}

// If a task stays "running" with no completedUnits progress for this long,
// the current fetch is aborted and the task is auto-retried once.
const STALL_TIMEOUT_MS = 8 * 60 * 1000 // 8 minutes

export function JobProgress({ initialJob }: Props) {
  const [job, setJob] = useState<Job>(initialJob)
  const [paused, setPaused] = useState(false)
  const [retrying, setRetrying] = useState<Record<string, boolean>>({})
  const [autoDownloaded, setAutoDownloaded] = useState(false)
  const [pushState, setPushState] = useState<Record<string, { status: "idle" | "pushing" | "done" | "error"; message?: string }>>({})
  const runningRef = useRef(false)
  const pausedRef = useRef(false)
  const autoDownloadedRef = useRef(false)
  // Maps taskId → { lastUnits, lastChangedAt } for stall detection
  const stallTrackerRef = useRef<Record<string, { lastUnits: number; lastChangedAt: number }>>({})
  // Maps taskId → AbortController so the stall detector can abort the fetch
  const abortControllersRef = useRef<Record<string, AbortController>>({})

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
  const isXliff = job.sourceFormat === "xliff" || job.sourceFormat === "xlf" || job.sourceFormat === "mxliff"
  // Formats that produce both a native-format file AND a separate bilingual XLIFF
  const hasNativeAndXliff = !isPdf && !isXliff

  // Integration-job derived info
  const isIntegrationJob = !!job.integrationId
  const integrationMeta = (() => {
    try { return JSON.parse(job.integrationMeta ?? "{}") as Record<string, string> } catch { return {} }
  })()
  const connectorId = integrationMeta.connector ?? ""
  const connectorLabel = connectorId ? connectorId.charAt(0).toUpperCase() + connectorId.slice(1) : ""
  const connectorIcon = CONNECTOR_ICONS[connectorId] ?? "🔗"

  function triggerDownload(url: string) {
    const a = document.createElement("a")
    a.href = url
    a.download = ""
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Auto-download all completed files as soon as translation finishes.
  // Suppressed for integration jobs — those push back to the CMS instead.
  useEffect(() => {
    if (allDone && completedCount > 0 && !autoDownloadedRef.current && !isIntegrationJob) {
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
  }, [allDone, completedCount]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchJob() {
    const res = await fetch(`/api/translation-studio/jobs/${job.id}`)
    if (res.ok) {
      const data = await res.json() as Job
      setJob(data)
      return data
    }
    return null
  }

  async function translateTask(task: Task, isAutoRetry = false): Promise<number> {
    setJob((j) => ({
      ...j,
      tasks: j.tasks.map((t: Task) => t.id === task.id ? { ...t, status: "running" } : t),
    }))

    // Set up abort controller so stall detector can cancel a hung fetch
    const controller = new AbortController()
    abortControllersRef.current[task.id] = controller

    // Initialise stall tracker for this task
    stallTrackerRef.current[task.id] = { lastUnits: task.completedUnits, lastChangedAt: Date.now() }

    const pollInterval = setInterval(async () => {
      const updated = await fetchJob()
      if (!updated) { clearInterval(pollInterval); return }

      // Stall detection: if completedUnits changed, reset the timer
      const freshTask = updated.tasks.find((t: Task) => t.id === task.id)
      if (freshTask) {
        const tracker = stallTrackerRef.current[task.id]
        if (tracker) {
          if (freshTask.completedUnits !== tracker.lastUnits) {
            stallTrackerRef.current[task.id] = { lastUnits: freshTask.completedUnits, lastChangedAt: Date.now() }
          } else if (freshTask.status === "running" && Date.now() - tracker.lastChangedAt > STALL_TIMEOUT_MS) {
            // Stalled — abort the fetch so the server marks it failed and we can retry
            console.warn(`[job-progress] Task ${task.id} stalled for ${STALL_TIMEOUT_MS / 60000} min — aborting`)
            clearInterval(pollInterval)
            controller.abort()
          }
        }
      }
    }, 2500)

    try {
      const res = await fetch(
        `/api/translation-studio/jobs/${job.id}/tasks/${task.id}/translate`,
        { method: "POST", signal: controller.signal }
      )
      clearInterval(pollInterval)
      delete abortControllersRef.current[task.id]
      await fetchJob()
      return res.status
    } catch (err) {
      clearInterval(pollInterval)
      delete abortControllersRef.current[task.id]
      const isAbort = (err as { name?: string }).name === "AbortError"
      await fetchJob()
      // Auto-retry once if this was a stall abort (not a user-initiated pause abort)
      if (isAbort && !isAutoRetry && !pausedRef.current) {
        console.warn(`[job-progress] Auto-retrying stalled task ${task.id}`)
        return translateTask(task, true)
      }
      return 0
    }
  }

  async function runTranslation(retryRound = 0) {
    if (runningRef.current) return
    runningRef.current = true

    const latest = await fetchJob()
    if (!latest) { runningRef.current = false; return }

    // Include "running" tasks — they may be stale from a dead browser session
    // The translate API accepts them and resets progress from scratch
    const pending = latest.tasks.filter((t: Task) => t.status === "pending" || t.status === "running")

    // Run up to 3 languages concurrently (matches server MAX_CONCURRENT_PER_USER)
    const CONCURRENCY = 3
    let i = 0
    async function runNext(): Promise<void> {
      while (i < pending.length) {
        if (pausedRef.current) break
        const task = pending[i++]
        // Retry the same task if the server concurrency limit returns 429.
        let status = await translateTask(task)
        for (let attempt = 1; status === 429 && attempt <= 5 && !pausedRef.current; attempt++) {
          console.warn(`[job-progress] Task ${task.id} got 429 — retrying in ${attempt * 5}s (attempt ${attempt})`)
          await new Promise(r => setTimeout(r, attempt * 5000))
          status = await translateTask(task)
        }
        if (!pausedRef.current) await runNext()
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, runNext))

    runningRef.current = false

    if (!pausedRef.current && retryRound < 3) {
      const refreshed = await fetchJob()
      if (refreshed) {
        const stillPending = refreshed.tasks.filter((t: Task) => t.status === "pending")
        if (stillPending.length > 0) {
          console.warn(`[job-progress] ${stillPending.length} task(s) still pending after run — retrying (round ${retryRound + 1})`)
          await new Promise(r => setTimeout(r, 5000))
          runTranslation(retryRound + 1)
        }
      }
    }
  }

  useEffect(() => {
    const hasActive = initialJob.tasks.some(
      (t: Task) => t.status === "pending" || t.status === "running"
    )
    if (hasActive) runTranslation()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Push a single task's translation back to the connected CMS
  async function pushTask(task: Task) {
    setPushState((s) => ({ ...s, [task.id]: { status: "pushing" } }))
    try {
      const res = await fetch(`/api/integrations/${connectorId}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, targetLanguage: task.targetLanguage }),
      })
      const data = await res.json() as { ok?: boolean; pushedStrings?: number; error?: string }
      if (data.ok) {
        setPushState((s) => ({ ...s, [task.id]: { status: "done", message: `${data.pushedStrings} strings pushed` } }))
      } else {
        setPushState((s) => ({ ...s, [task.id]: { status: "error", message: data.error ?? "Push failed" } }))
      }
    } catch (err) {
      setPushState((s) => ({ ...s, [task.id]: { status: "error", message: (err as Error).message } }))
    }
  }

  // Push all completed tasks back to the CMS
  async function pushAll() {
    const completedTasks = tasks.filter((t) => t.status === "completed")
    for (const task of completedTasks) {
      const current = pushState[task.id]
      if (current?.status === "done") continue // already pushed
      await pushTask(task)
    }
  }

  // Dynamic progress message shown to the user
  function getProgressMessage() {
    if (allDone && (autoDownloaded || isIntegrationJob)) {
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

  // Count tasks already successfully pushed
  const pushedCount = Object.values(pushState).filter((s) => s.status === "done").length
  const allPushed = pushedCount === completedCount && completedCount > 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          {isIntegrationJob && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
              <span>{connectorIcon}</span>
              <span>{connectorLabel} integration</span>
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{job.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {job.provider} · {job.model} · {totalTasks} language{totalTasks !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          {/* Push-to-CMS: primary action for integration jobs */}
          {isIntegrationJob && allDone && completedCount > 0 && !allPushed && (
            <button
              onClick={pushAll}
              className="px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <span>{connectorIcon}</span>
              Push all to {connectorLabel}
            </button>
          )}
          {/* Download: always available, secondary for integration jobs */}
          {readyCount > 0 && (
            <button
              onClick={downloadAll}
              className={cn(
                "px-3 py-2 text-sm border rounded-lg transition-colors",
                isIntegrationJob
                  ? "border-gray-200 text-gray-400 hover:bg-gray-50"
                  : "border-gray-300 hover:bg-gray-50"
              )}
            >
              {autoDownloaded ? `Re-download all (${readyCount})` : `Download all (${readyCount})`}
            </button>
          )}
          {allDone && (
            <a
              href="/translation-studio"
              className={cn(
                "px-3 py-2 text-sm font-semibold rounded-lg transition-colors",
                isIntegrationJob
                  ? "border border-gray-300 hover:bg-gray-50 text-gray-700"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              )}
            >
              + Translate another file
            </a>
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
        <div className={cn("rounded-xl p-5 border", isIntegrationJob ? "bg-indigo-50 border-indigo-200" : "bg-green-50 border-green-200")}>
          <div className="flex items-start gap-3">
            <span className="text-2xl">{allPushed ? "✅" : isIntegrationJob ? connectorIcon : "✅"}</span>
            <div>
              {isIntegrationJob ? (
                allPushed ? (
                  <>
                    <p className="text-sm font-semibold text-green-900">
                      All translations pushed to {connectorLabel} successfully
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Your content is live. You can push again any time using the buttons in the table below.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-indigo-900">
                      {completedCount} {completedCount !== 1 ? "translations" : "translation"} ready — push to {connectorLabel}
                    </p>
                    <p className="text-xs text-indigo-700 mt-1">
                      Click <strong>Push all to {connectorLabel}</strong> above, or push individual languages in the table below.
                      You can also download the translated files if needed.
                    </p>
                  </>
                )
              ) : (
                <>
                  <p className="text-sm font-semibold text-green-900">
                    {completedCount} {completedCount !== 1 ? "files" : "file"} ready — downloading to your Downloads folder
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Use the buttons below to re-download any file.
                  </p>
                </>
              )}
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
              const ps = pushState[task.id]

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
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                      {/* Push-to-CMS action (integration jobs only) */}
                      {isIntegrationJob && task.status === "completed" && (
                        <>
                          {ps?.status === "done" ? (
                            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              {ps.message}
                            </span>
                          ) : ps?.status === "error" ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-red-500" title={ps.message}>Push failed</span>
                              <button
                                onClick={() => pushTask(task)}
                                className="text-xs text-red-600 underline hover:text-red-800"
                              >
                                Retry
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => pushTask(task)}
                              disabled={ps?.status === "pushing"}
                              className="text-xs px-2.5 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium flex items-center gap-1 transition-colors"
                            >
                              {ps?.status === "pushing" ? (
                                <>
                                  <svg className="w-3 h-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                  </svg>
                                  Pushing…
                                </>
                              ) : (
                                <>
                                  <span>{connectorIcon}</span>
                                  Push to {connectorLabel}
                                </>
                              )}
                            </button>
                          )}
                        </>
                      )}

                      {/* Download links */}
                      {task.status === "completed" && !isPdf && (
                        <>
                          <button
                            onClick={() => downloadTask(task)}
                            className={cn(
                              "text-xs underline",
                              isIntegrationJob
                                ? "text-gray-400 hover:text-gray-600"
                                : "text-gray-500 hover:text-gray-700"
                            )}
                          >
                            {isXliff ? "XLIFF" : "Download"}
                          </button>
                          {hasNativeAndXliff && (
                            <a
                              href={`/api/translation-studio/jobs/${job.id}/tasks/${task.id}/download?format=xliff`}
                              download
                              className={cn(
                                "text-xs underline",
                                isIntegrationJob
                                  ? "text-gray-400 hover:text-gray-600"
                                  : "text-indigo-500 hover:text-indigo-700"
                              )}
                            >
                              XLIFF
                            </a>
                          )}
                        </>
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
                          <a
                            href={`/api/translation-studio/jobs/${job.id}/tasks/${task.id}/download?format=xliff`}
                            download
                            className="text-xs text-gray-400 hover:text-gray-600 underline"
                          >
                            XLIFF
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
