"use client"

import { useEffect, useState } from "react"
import { Navbar } from "@/components/navbar"
import Link from "next/link"

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

function StatusBadge({ status, completed, total, failed }: { status: string; completed: number; total: number; failed: number }) {
  const allDone = completed === total && total > 0
  const hasRunning = status === "pending" || status === "running"

  if (allDone && failed === 0) {
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Done</span>
  }
  if (failed > 0 && completed + failed === total) {
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">{failed} failed</span>
  }
  if (hasRunning || (completed > 0 && completed < total)) {
    return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
      {completed}/{total}
    </span>
  }
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">Pending</span>
}

function DownloadButton({ jobId, task, sourceFormat }: { jobId: string; task: Task; sourceFormat: string }) {
  const [open, setOpen] = useState(false)
  const base = `/api/translation-studio/jobs/${jobId}/tasks/${task.id}/download`

  if (task.status !== "completed") return null

  const isPdf = sourceFormat === "pdf"
  const isXliff = sourceFormat === "xliff"
  const isResourceFmt = ["strings","stringsdict","xcstrings","po","xml","arb","properties"].includes(sourceFormat)

  // Simple single-button for most formats
  if (!isPdf) {
    const href = isXliff || isResourceFmt ? base : base
    const label = isXliff ? "XLIFF" : isResourceFmt ? `.${sourceFormat}` : sourceFormat.toUpperCase()
    return (
      <a
        href={href}
        className="text-xs text-indigo-600 hover:underline font-medium"
        download
      >
        ↓ {label}
      </a>
    )
  }

  // PDF: dropdown for multiple formats
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-indigo-600 hover:underline font-medium flex items-center gap-0.5"
      >
        ↓ Download ▾
      </button>
      {open && (
        <div className="absolute right-0 top-5 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[130px]" onMouseLeave={() => setOpen(false)}>
          {[{ label: "PDF", q: "pdf" }, { label: "TXT", q: "txt" }, { label: "XLIFF", q: "xliff" }].map(({ label, q }) => (
            <a
              key={q}
              href={`${base}?format=${q}`}
              download
              className="block px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              {label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function JobRow({ job }: { job: Job }) {
  const [expanded, setExpanded] = useState(false)
  const total = job.tasks.length

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
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
          <StatusBadge status={job.status} completed={job.completedTasks} total={total} failed={job.failedTasks} />
        </td>
        <td className="px-4 py-3 text-right">
          <Link
            href={`/translation-studio/${job.id}`}
            className="text-xs text-gray-500 hover:text-indigo-600 font-medium"
            onClick={e => e.stopPropagation()}
          >
            View →
          </Link>
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
                    {task.status === "completed" ? (
                      <span className="text-xs text-green-600 font-medium">Done</span>
                    ) : task.status === "failed" ? (
                      <span className="text-xs text-red-600 font-medium">Failed</span>
                    ) : task.status === "running" ? (
                      <span className="text-xs text-indigo-600 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" /> Translating
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Pending</span>
                    )}
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

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/translation-studio/jobs")
      .then(r => r.json())
      .then((data: Job[] | { error: string }) => {
        if (Array.isArray(data)) setJobs(data)
        else setError((data as { error: string }).error ?? "Failed to load jobs")
      })
      .catch(() => setError("Failed to load jobs"))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Jobs</h1>
            <p className="text-sm text-gray-500 mt-0.5">All your translation jobs and download links.</p>
          </div>
          <Link
            href="/translation-studio"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + New translation
          </Link>
        </div>

        {loading ? (
          <div className="text-sm text-gray-400 py-12 text-center">Loading…</div>
        ) : error ? (
          <div className="text-sm text-red-600 py-12 text-center">{error}</div>
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
                {jobs.map(job => <JobRow key={job.id} job={job} />)}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
