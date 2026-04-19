"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Navbar } from "@/components/navbar"
import Link from "next/link"

// ─── Translation Jobs ─────────────────────────────────────────────────────────

interface Task {
  id: string
  targetLanguage: string
  status: string
}

interface Job {
  id: string
  name: string
  sourceFormat: string
  sourceLanguage: string
  status: string
  createdAt: string
  completedTasks: number
  failedTasks: number
  tasks: Task[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function formatExt(fmt: string) {
  const map: Record<string, string> = {
    json: "JSON", csv: "CSV", md: "MD", txt: "TXT", pdf: "PDF",
    xliff: "XLIFF", strings: ".strings", stringsdict: ".stringsdict",
    xcstrings: ".xcstrings", po: ".po", xml: "Android XML",
    arb: ".arb", properties: ".properties",
  }
  return map[fmt] ?? fmt.toUpperCase()
}

function JobStatusBadge({ status, completed, total, failed }: { status: string; completed: number; total: number; failed: number }) {
  const allDone = completed === total && total > 0
  const hasRunning = status === "pending" || status === "running"
  if (allDone && failed === 0)
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Done</span>
  if (failed > 0 && completed + failed === total)
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">{failed} failed</span>
  if (hasRunning || (completed > 0 && completed < total))
    return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />{completed}/{total}
    </span>
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">Pending</span>
}

function DownloadButton({ jobId, task, sourceFormat }: { jobId: string; task: Task; sourceFormat: string }) {
  const [open, setOpen] = useState(false)
  const base = `/api/translation-studio/jobs/${jobId}/tasks/${task.id}/download`
  if (task.status !== "completed") return null
  if (sourceFormat !== "pdf") {
    return <a href={base} className="text-xs text-indigo-600 hover:underline font-medium" download>↓ {formatExt(sourceFormat)}</a>
  }
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} className="text-xs text-indigo-600 hover:underline font-medium flex items-center gap-0.5">
        ↓ Download ▾
      </button>
      {open && (
        <div className="absolute right-0 top-5 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[130px]" onMouseLeave={() => setOpen(false)}>
          {[{ label: "PDF", q: "pdf" }, { label: "TXT", q: "txt" }, { label: "XLIFF", q: "xliff" }].map(({ label, q }) => (
            <a key={q} href={`${base}?format=${q}`} download
               className="block px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
               onClick={() => setOpen(false)}>{label}</a>
          ))}
        </div>
      )}
    </div>
  )
}

function ZipButton({ job }: { job: Job }) {
  const [busy, setBusy] = useState(false)
  const completedCount = job.tasks.filter(t => t.status === "completed").length
  if (completedCount < 2) return null

  async function handleZip() {
    setBusy(true)
    try {
      const res = await fetch(`/api/translation-studio/jobs/${job.id}/download-zip`)
      if (!res.ok) { alert("ZIP generation failed"); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${job.name.replace(/[^a-zA-Z0-9-_]/g, "_")}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); handleZip() }}
      disabled={busy}
      className="text-xs text-indigo-600 hover:underline font-medium disabled:opacity-50"
    >
      {busy ? "Zipping…" : `↓ ZIP (${completedCount})`}
    </button>
  )
}

function JobRow({ job }: { job: Job }) {
  const [expanded, setExpanded] = useState(false)
  const total = job.tasks.length
  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate max-w-[220px]">{job.name}</span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{formatDate(job.createdAt)}</div>
        </td>
        <td className="px-4 py-3">
          <span className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{formatExt(job.sourceFormat)}</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {job.tasks.slice(0, 4).map(t => (
              <span key={t.id} className="text-xs text-gray-500">{t.targetLanguage}</span>
            ))}
            {job.tasks.length > 4 && <span className="text-xs text-gray-400">+{job.tasks.length - 4} more</span>}
          </div>
        </td>
        <td className="px-4 py-3">
          <JobStatusBadge status={job.status} completed={job.completedTasks} total={total} failed={job.failedTasks} />
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-3">
            <ZipButton job={job} />
            <Link href={`/translation-studio/${job.id}`}
              className="text-xs text-gray-500 hover:text-indigo-600 font-medium"
              onClick={e => e.stopPropagation()}>
              View →
            </Link>
          </div>
        </td>
      </tr>
      {expanded && job.tasks.length > 0 && (
        <tr>
          <td colSpan={5} className="px-4 pb-3 pt-0">
            <div className="bg-gray-50 rounded-lg border border-gray-100 divide-y divide-gray-100">
              {job.tasks.map(task => (
                <div key={task.id} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-700">{task.targetLanguage}</span>
                  <div className="flex items-center gap-3">
                    {task.status === "completed" ? <span className="text-xs text-green-600 font-medium">Done</span>
                      : task.status === "failed" ? <span className="text-xs text-red-600 font-medium">Failed</span>
                      : task.status === "running" ? <span className="text-xs text-indigo-600 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" /> Translating</span>
                      : <span className="text-xs text-gray-400">Pending</span>}
                    <DownloadButton jobId={job.id} task={task} sourceFormat={job.sourceFormat} />
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── LQA Runs ────────────────────────────────────────────────────────────────

interface LqaRun {
  id: string
  fileName: string
  fileFormat: string
  sourceLanguage: string
  targetLanguage: string
  status: string
  totalUnits: number
  qualityScore: number | null
  qualityBand: string | null
  accuracyErrors: number
  languageErrors: number
  styleErrors: number
  revisionStatus: string | null
  errorMessage: string | null
  createdAt: string
}

function LqaScoreBadge({ score, band }: { score: number | null; band: string | null }) {
  if (score === null) return null
  const color = band === "High" ? "text-green-700 bg-green-50 border-green-200"
    : band === "Medium" ? "text-yellow-700 bg-yellow-50 border-yellow-200"
    : "text-red-700 bg-red-50 border-red-200"
  return (
    <span className={`inline-flex items-center text-xs font-semibold border rounded-full px-2 py-0.5 ${color}`}>
      {score}/100 · {band}
    </span>
  )
}

function LqaStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:   "text-gray-600 bg-gray-100",
    running:   "text-blue-700 bg-blue-100 animate-pulse",
    completed: "text-green-700 bg-green-100",
    failed:    "text-red-700 bg-red-100",
  }
  const labels: Record<string, string> = { pending: "Pending", running: "Analyzing…", completed: "Done", failed: "Failed" }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] ?? "bg-gray-100 text-gray-600"}`}>{labels[status] ?? status}</span>
}

function LqaRunRow({ run, onDelete }: { run: LqaRun; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Delete LQA run for "${run.fileName}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/lqa/runs/${run.id}`, { method: "DELETE" })
      if (res.ok) onDelete(run.id)
      else alert("Failed to delete run")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-gray-900 truncate max-w-[220px]">{run.fileName}</p>
        <p className="text-xs text-gray-400 mt-0.5">{formatDate(run.createdAt)}</p>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{run.fileFormat.toUpperCase()}</span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-600">
        {run.sourceLanguage && run.targetLanguage ? `${run.sourceLanguage} → ${run.targetLanguage}` : "—"}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">{run.totalUnits} units</td>
      <td className="px-4 py-3">
        {run.status === "completed"
          ? <LqaScoreBadge score={run.qualityScore} band={run.qualityBand} />
          : <LqaStatusBadge status={run.status} />}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-3">
          {run.status === "completed" && (
            <a href={`/lqa-studio`} className="text-xs text-indigo-600 hover:underline font-medium">View</a>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
            title="Delete this run"
          >
            {deleting ? "…" : "Delete"}
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export default function JobsPage() {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<"translation" | "lqa">(
    searchParams.get("tab") === "lqa" ? "lqa" : "translation"
  )

  // Translation jobs state
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [jobsError, setJobsError] = useState("")
  const [jobsPage, setJobsPage] = useState(0)

  // LQA runs state
  const [lqaRuns, setLqaRuns] = useState<LqaRun[]>([])
  const [lqaLoading, setLqaLoading] = useState(false)
  const [lqaError, setLqaError] = useState("")
  const [lqaPage, setLqaPage] = useState(0)
  const [lqaLoaded, setLqaLoaded] = useState(false)

  // Load LQA runs on mount if starting on that tab
  useEffect(() => {
    if (tab === "lqa") loadLqa()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/translation-studio/jobs")
      .then(r => r.json())
      .then((data: Job[] | { error: string }) => {
        if (Array.isArray(data)) setJobs(data)
        else setJobsError((data as { error: string }).error ?? "Failed to load jobs")
      })
      .catch(() => setJobsError("Failed to load jobs"))
      .finally(() => setJobsLoading(false))
  }, [])

  function loadLqa() {
    if (lqaLoaded) return
    setLqaLoading(true)
    fetch("/api/lqa/runs")
      .then(r => r.json())
      .then((data: LqaRun[] | { error: string }) => {
        if (Array.isArray(data)) setLqaRuns(data)
        else setLqaError((data as { error: string }).error ?? "Failed to load LQA runs")
        setLqaLoaded(true)
      })
      .catch(() => setLqaError("Failed to load LQA runs"))
      .finally(() => setLqaLoading(false))
  }

  function switchTab(t: "translation" | "lqa") {
    setTab(t)
    if (t === "lqa") loadLqa()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Jobs</h1>
            <p className="text-sm text-gray-500 mt-0.5">All your translation jobs and LQA history.</p>
          </div>
          <div className="flex gap-2">
            {tab === "lqa" && (
              <Link href="/lqa-studio"
                className="border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                + New LQA run
              </Link>
            )}
            {tab === "translation" && (
              <Link href="/translation-studio"
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                + New translation
              </Link>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => switchTab("translation")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === "translation" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            Translation Jobs {jobs.length > 0 && <span className="ml-1 text-xs text-gray-400">{jobs.length}</span>}
          </button>
          <button
            onClick={() => switchTab("lqa")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === "lqa" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            LQA Runs {lqaLoaded && lqaRuns.length > 0 && <span className="ml-1 text-xs text-gray-400">{lqaRuns.length}</span>}
          </button>
        </div>

        {/* Translation Jobs tab */}
        {tab === "translation" && (
          jobsLoading ? (
            <div className="text-sm text-gray-400 py-12 text-center">Loading…</div>
          ) : jobsError ? (
            <div className="text-sm text-red-600 py-12 text-center">{jobsError}</div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-500 text-sm mb-4">No translation jobs yet.</p>
              <Link href="/translation-studio" className="text-indigo-600 font-medium text-sm hover:underline">
                Start your first translation →
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Job</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Format</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Languages</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {jobs.slice(jobsPage * PAGE_SIZE, (jobsPage + 1) * PAGE_SIZE).map(job => <JobRow key={job.id} job={job} />)}
                </tbody>
              </table>
              {jobs.length > PAGE_SIZE && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                  <span className="text-xs text-gray-500">
                    {jobsPage * PAGE_SIZE + 1}–{Math.min((jobsPage + 1) * PAGE_SIZE, jobs.length)} of {jobs.length} jobs
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => setJobsPage(p => p - 1)} disabled={jobsPage === 0}
                      className="text-xs px-3 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40">← Prev</button>
                    <button onClick={() => setJobsPage(p => p + 1)} disabled={(jobsPage + 1) * PAGE_SIZE >= jobs.length}
                      className="text-xs px-3 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40">Next →</button>
                  </div>
                </div>
              )}
            </div>
          )
        )}

        {/* LQA Runs tab */}
        {tab === "lqa" && (
          lqaLoading ? (
            <div className="text-sm text-gray-400 py-12 text-center">Loading…</div>
          ) : lqaError ? (
            <div className="text-sm text-red-600 py-12 text-center">{lqaError}</div>
          ) : lqaRuns.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-500 text-sm mb-4">No LQA runs yet.</p>
              <Link href="/lqa-studio" className="text-indigo-600 font-medium text-sm hover:underline">
                Run your first quality check →
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">File</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Format</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Languages</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Units</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lqaRuns.slice(lqaPage * PAGE_SIZE, (lqaPage + 1) * PAGE_SIZE).map(run => (
                    <LqaRunRow
                      key={run.id}
                      run={run}
                      onDelete={id => setLqaRuns(prev => prev.filter(r => r.id !== id))}
                    />
                  ))}
                </tbody>
              </table>
              {lqaRuns.length > PAGE_SIZE && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                  <span className="text-xs text-gray-500">
                    {lqaPage * PAGE_SIZE + 1}–{Math.min((lqaPage + 1) * PAGE_SIZE, lqaRuns.length)} of {lqaRuns.length} runs
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => setLqaPage(p => p - 1)} disabled={lqaPage === 0}
                      className="text-xs px-3 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40">← Prev</button>
                    <button onClick={() => setLqaPage(p => p + 1)} disabled={(lqaPage + 1) * PAGE_SIZE >= lqaRuns.length}
                      className="text-xs px-3 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40">Next →</button>
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </main>
    </div>
  )
}
