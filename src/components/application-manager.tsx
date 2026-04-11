"use client"

import { useState } from "react"
import { STUDIO_LANGUAGES } from "@/lib/languages"

interface Application {
  id: string
  fullName: string
  email: string
  languagePairs: string  // JSON string
  yearsExperience: number
  catTools: string       // JSON string
  mtExperience: boolean
  bio: string
  profileUrl: string | null
  ratePerWord: number | null
  ratePerHour: number | null
  cvFileName: string | null
  status: string
  resolvedUserId: string | null
  createdAt: Date | string
}

const LANG_LABEL = Object.fromEntries(STUDIO_LANGUAGES.map((l) => [l.code, l.name]))

function langName(code: string) {
  return LANG_LABEL[code] ?? code
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
}

function DetailPanel({
  app,
  onAction,
}: {
  app: Application
  onAction: (id: string, action: "approve" | "reject", result: Application) => void
}) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null)
  const [error, setError] = useState("")

  let langs: string[] = []
  try { langs = JSON.parse(app.languagePairs) } catch {}

  let tools: string[] = []
  try { tools = JSON.parse(app.catTools) } catch {}

  async function handleAction(action: "approve" | "reject") {
    setLoading(action)
    setError("")
    try {
      const res = await fetch(`/api/reviewer-applications/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json() as { ok?: boolean; status?: string; error?: string; emailFailed?: boolean }
      if (!res.ok) { setError(data.error ?? "Request failed"); return }
      onAction(app.id, action, { ...app, status: data.status ?? action === "approve" ? "approved" : "rejected" })
    } catch {
      setError("Network error — please try again.")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-gray-50 border-t border-gray-100 px-6 py-5 space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5 flex justify-between">
          {error}
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-700">✕</button>
        </div>
      )}

      {/* Language pairs */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Language pairs</p>
        <div className="flex flex-wrap gap-1.5">
          {langs.map((code) => (
            <span key={code} className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">
              {langName(code)} <span className="opacity-60 font-mono">{code}</span>
            </span>
          ))}
          {langs.length === 0 && <span className="text-xs text-gray-400">—</span>}
        </div>
      </div>

      {/* Meta row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Years of experience</p>
          <p className="font-medium text-gray-800">{app.yearsExperience}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-0.5">MT post-editing</p>
          <p className="font-medium text-gray-800">{app.mtExperience ? "Yes" : "No"}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-gray-400 mb-0.5">CAT tools</p>
          <p className="font-medium text-gray-800">{tools.length > 0 ? tools.join(", ") : "—"}</p>
        </div>
      </div>

      {/* Bio */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Introduction</p>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{app.bio}</p>
      </div>

      {/* Rates */}
      {(app.ratePerWord != null || app.ratePerHour != null) && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Rates (USD)</p>
          <div className="flex gap-4 text-sm text-gray-700">
            {app.ratePerWord != null && (
              <span><strong>${app.ratePerWord.toFixed(3)}</strong> / word</span>
            )}
            {app.ratePerHour != null && (
              <span><strong>${app.ratePerHour.toFixed(2)}</strong> / hour</span>
            )}
          </div>
        </div>
      )}

      {/* CV Download */}
      {app.cvFileName && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">CV / Résumé</p>
          <a
            href={`/api/reviewer-applications/${app.id}/cv`}
            download={app.cvFileName}
            className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:underline"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {app.cvFileName}
          </a>
        </div>
      )}

      {/* Profile URL */}
      {app.profileUrl && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Profile</p>
          <a
            href={app.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-600 hover:underline break-all"
          >
            {app.profileUrl}
          </a>
        </div>
      )}

      {/* Actions */}
      {app.status === "pending" && (
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => handleAction("approve")}
            disabled={loading !== null}
            className="px-4 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {loading === "approve" ? "Approving…" : "Approve"}
          </button>
          <button
            onClick={() => handleAction("reject")}
            disabled={loading !== null}
            className="px-4 py-2 text-sm font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg disabled:opacity-50 transition-colors"
          >
            {loading === "reject" ? "Rejecting…" : "Reject"}
          </button>
        </div>
      )}
    </div>
  )
}

export function ApplicationManager({ initialApplications }: { initialApplications: Application[] }) {
  const [applications, setApplications] = useState<Application[]>(initialApplications)
  const [statusFilter, setStatusFilter] = useState("pending")
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = applications.filter((a) => {
    const matchStatus = !statusFilter || a.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch =
      !search ||
      a.fullName.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const counts = {
    pending: applications.filter((a) => a.status === "pending").length,
    approved: applications.filter((a) => a.status === "approved").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  }

  function handleAction(id: string, _action: "approve" | "reject", result: Application) {
    setApplications((prev) => prev.map((a) => (a.id === id ? result : a)))
    setExpanded(null)
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {(["pending", "approved", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s === statusFilter ? "" : s)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              statusFilter === s
                ? "border-indigo-300 bg-indigo-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <p className="text-2xl font-bold text-gray-900">{counts[s]}</p>
            <p className="text-xs text-gray-500 capitalize mt-0.5">{s}</p>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
        {filtered.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-400">
            {search || statusFilter ? "No applications match your filters." : "No applications yet."}
          </p>
        ) : (
          filtered.map((app) => {
            let langs: string[] = []
            try { langs = JSON.parse(app.languagePairs) } catch {}
            const isOpen = expanded === app.id

            return (
              <div key={app.id}>
                <button
                  onClick={() => setExpanded(isOpen ? null : app.id)}
                  className="w-full text-left px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 text-sm">{app.fullName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[app.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {app.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{app.email}</p>
                      {langs.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {langs.slice(0, 4).map((code) => (
                            <span key={code} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                              {code}
                            </span>
                          ))}
                          {langs.length > 4 && (
                            <span className="text-xs text-gray-400">+{langs.length - 4} more</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-gray-400">
                        {new Date(app.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <DetailPanel app={app} onAction={handleAction} />
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
