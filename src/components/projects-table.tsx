"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { getLanguageName, STATUS_COLORS } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface Project {
  id: string
  name: string
  sourceLanguage: string
  targetLanguage: string
  status: string
  createdAt: Date | string
  approvedCount: number
  _count: { units: number }
  createdBy: { name: string }
  assignedReviewer: { name: string } | null
}

interface Props {
  initialProjects: Project[]
  role: string
  currentUserId: string
}

export function ProjectsTable({ initialProjects, role }: Props) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [nameFilter, setNameFilter] = useState("")
  const [reviewerFilter, setReviewerFilter] = useState("")
  const [dateSort, setDateSort] = useState<"desc" | "asc">("desc")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const reviewers = useMemo(() => {
    const names = new Set(projects.map((p) => p.assignedReviewer?.name).filter(Boolean) as string[])
    return Array.from(names).sort()
  }, [projects])

  const filtered = useMemo(() => {
    let list = projects
    if (nameFilter.trim()) {
      const q = nameFilter.trim().toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }
    if (reviewerFilter) {
      list = list.filter((p) => p.assignedReviewer?.name === reviewerFilter)
    }
    list = [...list].sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return dateSort === "desc" ? -diff : diff
    })
    return list
  }, [projects, nameFilter, reviewerFilter, dateSort])

  const allSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id))

  function toggleAll() {
    if (allSelected) {
      setSelected((s) => {
        const next = new Set(s)
        filtered.forEach((p) => next.delete(p.id))
        return next
      })
    } else {
      setSelected((s) => {
        const next = new Set(s)
        filtered.forEach((p) => next.add(p.id))
        return next
      })
    }
  }

  function toggleOne(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function deleteProject(id: string) {
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" })
    if (res.ok) {
      setProjects((ps) => ps.filter((p) => p.id !== id))
      setSelected((s) => { const next = new Set(s); next.delete(id); return next })
    }
  }

  async function deleteSelected() {
    if (!confirm(`Delete ${selected.size} project(s)? This cannot be undone.`)) return
    setDeleting(true)
    await Promise.all(Array.from(selected).map(deleteProject))
    setDeleting(false)
  }

  async function exportProject(id: string, name: string) {
    const res = await fetch(`/api/projects/${id}/export`)
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${name.replace(/[^a-z0-9]/gi, "_")}-revised.xliff`
    a.click()
    URL.revokeObjectURL(url)
    // Reflect status change to exported in local state
    setProjects((ps) =>
      ps.map((p) => (p.id === id ? { ...p, status: "exported" } : p))
    )
  }

  async function exportSelected() {
    setExporting(true)
    for (const id of Array.from(selected)) {
      const project = projects.find((p) => p.id === id)
      if (project) await exportProject(id, project.name)
    }
    setExporting(false)
  }

  const selectedCount = selected.size

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search by name…"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52"
        />
        <select
          value={reviewerFilter}
          onChange={(e) => setReviewerFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All reviewers</option>
          {reviewers.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button
          onClick={() => setDateSort((d) => (d === "desc" ? "asc" : "desc"))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50 flex items-center gap-1"
        >
          Date {dateSort === "desc" ? "↓" : "↑"}
        </button>

        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} project{filtered.length !== 1 ? "s" : ""}
        </span>

        {selectedCount > 0 && (
          <>
            <button
              onClick={exportSelected}
              disabled={exporting}
              className="text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg font-medium"
            >
              {exporting ? "Exporting…" : `Export ${selectedCount}`}
            </button>
            {(role === "admin" || role === "requester") && (
              <button
                onClick={deleteSelected}
                disabled={deleting}
                className="text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg font-medium"
              >
                {deleting ? "Deleting…" : `Delete ${selectedCount}`}
              </button>
            )}
          </>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No projects match your filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">Project</th>
                <th className="px-4 py-3 font-medium text-gray-600">Languages</th>
                <th className="px-4 py-3 font-medium text-gray-600">Progress</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">Reviewer</th>
                <th className="px-4 py-3 font-medium text-gray-600">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((project) => {
                const total = project._count.units
                const pct = total > 0 ? Math.round((project.approvedCount / total) * 100) : 0
                const isSelected = selected.has(project.id)

                return (
                  <tr
                    key={project.id}
                    className={cn("hover:bg-gray-50 transition-colors", isSelected && "bg-indigo-50")}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(project.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{project.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                        {getLanguageName(project.sourceLanguage)}
                      </span>
                      <span className="mx-1 text-gray-300">→</span>
                      <span className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
                        {getLanguageName(project.targetLanguage)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {project.approvedCount}/{total}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          STATUS_COLORS[project.status] || "bg-gray-100 text-gray-600"
                        )}
                      >
                        {project.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {project.assignedReviewer?.name || (
                        <span className="text-gray-400 italic">unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/projects/${project.id}`}
                          className="text-indigo-600 hover:text-indigo-800 font-medium text-xs"
                        >
                          {role === "reviewer" ? "Review →" : "View →"}
                        </Link>
                        <button
                          onClick={() => exportProject(project.id, project.name)}
                          className="text-gray-400 hover:text-gray-600 text-xs"
                          title="Export XLIFF"
                        >
                          Export
                        </button>
                        {(role === "admin" || role === "requester") && (
                          <button
                            onClick={async () => {
                              if (confirm(`Delete "${project.name}"? This cannot be undone.`))
                                await deleteProject(project.id)
                            }}
                            className="text-red-400 hover:text-red-600 text-xs"
                            title="Delete project"
                          >
                            Delete
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
      )}
    </div>
  )
}
