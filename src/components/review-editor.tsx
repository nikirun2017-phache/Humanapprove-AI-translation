"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { cn, UNIT_STATUS_COLORS } from "@/lib/utils"
import { CommentPanel } from "@/components/comment-panel"

interface AuditEntry {
  id: string
  action: string
  detail: string | null
  createdAt: string
  user: string
  unit: { id: string; xliffUnitId: string; sourceText: string } | null
}

interface Comment {
  id: string
  body: string
  resolved: boolean
  createdAt: string
  author: { id: string; name: string }
}

interface Unit {
  id: string
  xliffUnitId: string
  sourceText: string
  targetText: string
  revisedTarget: string | null
  status: string
  orderIndex: number
  comments: Comment[]
}

interface ReviewEditorProps {
  projectId: string
  isReviewer: boolean
  projectStatus: string
  currentUserId: string
  totalCount: number
  approvedCount: number
}

const STATUS_ICON: Record<string, string> = {
  pending: "○",
  commented: "◎",
  approved: "✓",
  rejected: "✗",
}

export function ReviewEditor({
  projectId,
  isReviewer,
  projectStatus,
  currentUserId,
  totalCount,
  approvedCount: initialApproved,
}: ReviewEditorProps) {
  const router = useRouter()
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draftValue, setDraftValue] = useState("")
  const [isDirty, setIsDirty] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [filter, setFilter] = useState<string>("all")
  const [saving, setSaving] = useState<string | null>(null) // unitId being saved
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [approvedCount, setApprovedCount] = useState(initialApproved)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(totalCount)
  const [showApproveAllDialog, setShowApproveAllDialog] = useState(false)
  const [approvingAll, setApprovingAll] = useState(false)
  const [approveAllConfirmText, setApproveAllConfirmText] = useState("")
  const [rightTab, setRightTab] = useState<"comments" | "audit">("comments")
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  const PAGE_SIZE = 50

  const fetchUnits = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      ...(filter !== "all" ? { status: filter } : {}),
    })
    const res = await fetch(`/api/projects/${projectId}/units?${params}`)
    if (res.ok) {
      const data = await res.json()
      setUnits(data.units)
      setTotal(data.total)
      if (!selectedId && data.units.length > 0) {
        setSelectedId(data.units[0].id)
      }
    }
    setLoading(false)
  }, [projectId, page, filter, selectedId])

  useEffect(() => {
    fetchUnits()
  }, [fetchUnits])

  const selectedUnit = units.find((u) => u.id === selectedId) ?? null

  // Initialise draft whenever the selected unit changes
  useEffect(() => {
    if (selectedUnit) {
      setDraftValue(selectedUnit.revisedTarget ?? selectedUnit.targetText)
      setIsDirty(false)
    }
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard navigation: up/down arrows when textarea is not focused
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
      e.preventDefault()
      setSelectedId((cur) => {
        if (!cur || units.length === 0) return cur
        const idx = units.findIndex((u) => u.id === cur)
        if (e.key === "ArrowDown") return units[Math.min(idx + 1, units.length - 1)].id
        return units[Math.max(idx - 1, 0)].id
      })
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [units])

  async function saveIfDirty(unitId: string, value: string) {
    if (!isDirty) return
    setSaving(unitId)
    const res = await fetch(`/api/units/${unitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revisedTarget: value }),
    })
    if (res.ok) {
      const updated = await res.json()
      setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, ...updated } : u)))
    }
    setIsDirty(false)
    setSaving(null)
  }

  async function navigateTo(id: string) {
    if (selectedUnit && isDirty) await saveIfDirty(selectedUnit.id, draftValue)
    setSelectedId(id)
  }

  async function approveUnit(unitId: string) {
    if (isDirty) await saveIfDirty(unitId, draftValue)
    setSaving(unitId)
    try {
      const res = await fetch(`/api/units/${unitId}/approve`, { method: "POST" })
      if (res.ok) {
        setUnits((prev) =>
          prev.map((u) => (u.id === unitId ? { ...u, status: "approved" } : u))
        )
        setApprovedCount((c) => c + 1)
        const idx = units.findIndex((u) => u.id === unitId)
        const next = units.slice(idx + 1).find((u) => u.status !== "approved")
        if (next) setSelectedId(next.id)
      }
    } finally {
      setSaving(null)
    }
  }

  async function rejectUnit(unitId: string) {
    if (!rejectReason.trim()) return
    setSaving(unitId)
    const res = await fetch(`/api/units/${unitId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason }),
    })
    if (res.ok) {
      setUnits((prev) =>
        prev.map((u) => (u.id === unitId ? { ...u, status: "rejected" } : u))
      )
      setRejectingId(null)
      setRejectReason("")
      await fetchUnits() // refresh comments
    }
    setSaving(null)
  }

  async function submitReview() {
    setSubmitLoading(true)
    setSubmitError("")
    const res = await fetch(`/api/projects/${projectId}/submit`, { method: "POST" })
    const data = await res.json()
    setSubmitLoading(false)
    if (!res.ok) {
      setSubmitError(data.error)
      return
    }
    router.push("/dashboard")
  }

  async function approveAll() {
    setApprovingAll(true)
    setShowApproveAllDialog(false)
    setApproveAllConfirmText("")
    try {
      const res = await fetch(`/api/projects/${projectId}/approve-all`, { method: "POST" })
      if (res.ok) {
        const data = await res.json() as { totalApproved: number }
        setApprovedCount(data.totalApproved)
        await fetchUnits()
      }
    } finally {
      setApprovingAll(false)
    }
  }

  async function handleCommentAdded(unitId: string, comment: Comment) {
    setUnits((prev) =>
      prev.map((u) =>
        u.id === unitId
          ? {
              ...u,
              comments: [...u.comments, comment],
              status: u.status === "pending" ? "commented" : u.status,
            }
          : u
      )
    )
  }

  async function handleCommentResolved(commentId: string) {
    setUnits((prev) =>
      prev.map((u) => ({
        ...u,
        comments: u.comments.map((c) =>
          c.id === commentId ? { ...c, resolved: true } : c
        ),
      }))
    )
  }

  async function fetchAuditLog() {
    setAuditLoading(true)
    const res = await fetch(`/api/projects/${projectId}/audit`)
    if (res.ok) {
      const data = await res.json() as AuditEntry[]
      setAuditLog(data)
    }
    setAuditLoading(false)
  }

  function handleRightTab(tab: "comments" | "audit") {
    setRightTab(tab)
    if (tab === "audit" && auditLog.length === 0) fetchAuditLog()
  }

  const ACTION_LABEL: Record<string, { label: string; color: string }> = {
    approved: { label: "Approved", color: "text-green-600" },
    rejected: { label: "Rejected", color: "text-red-500" },
    revised: { label: "Revised", color: "text-indigo-600" },
    submitted: { label: "Submitted review", color: "text-purple-600" },
    approve_all: { label: "Bulk approved", color: "text-amber-600" },
  }

  const displayedUnits = units

  const canSubmit = isReviewer && projectStatus === "in_review"

  return (
    <div className="flex gap-4 h-[calc(100vh-140px)]">
      {/* Left: Unit list */}
      <div className="w-56 flex-shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-gray-100">
          <select
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setPage(1) }}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All units ({total})</option>
            <option value="pending">Pending</option>
            <option value="commented">Commented</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-xs text-gray-400 text-center">Loading…</div>
          ) : (
            displayedUnits.map((unit) => (
              <button
                key={unit.id}
                onClick={() => navigateTo(unit.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 text-xs border-b border-gray-50 hover:bg-gray-50 transition-colors",
                  selectedId === unit.id && "bg-indigo-50 border-l-2 border-l-indigo-500"
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-gray-400 font-mono truncate">{unit.xliffUnitId}</span>
                  <span className={cn("font-mono text-sm", UNIT_STATUS_COLORS[unit.status])}>
                    {STATUS_ICON[unit.status]}
                  </span>
                </div>
                <p className="text-gray-600 truncate mt-0.5">{unit.sourceText}</p>
              </button>
            ))
          )}
        </div>
        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="p-2 border-t border-gray-100 flex justify-between items-center">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-xs text-gray-500 disabled:opacity-30 hover:text-gray-800"
            >
              ← Prev
            </button>
            <span className="text-xs text-gray-400">{page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * PAGE_SIZE >= total}
              className="text-xs text-gray-500 disabled:opacity-30 hover:text-gray-800"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Center: Editor */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {selectedUnit ? (
          <>
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex-1 flex flex-col gap-4 overflow-y-auto">
              {/* Unit header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                  {selectedUnit.xliffUnitId}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    selectedUnit.status === "approved" && "bg-green-100 text-green-700",
                    selectedUnit.status === "rejected" && "bg-red-100 text-red-700",
                    selectedUnit.status === "commented" && "bg-yellow-100 text-yellow-700",
                    selectedUnit.status === "pending" && "bg-gray-100 text-gray-600"
                  )}
                >
                  {selectedUnit.status}
                </span>
              </div>

              {/* Source */}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
                  Source
                </label>
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {selectedUnit.sourceText}
                </div>
              </div>

              {/* Target */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Target
                    {isDirty && (
                      <span className="ml-1.5 text-amber-500 normal-case font-normal">· unsaved</span>
                    )}
                    {!isDirty && selectedUnit.revisedTarget !== null && (
                      <span className="ml-1.5 text-indigo-500 normal-case font-normal">(revised)</span>
                    )}
                  </label>
                  {saving === selectedUnit.id && (
                    <span className="text-xs text-gray-400">Saving…</span>
                  )}
                </div>

                {isReviewer ? (
                  <textarea
                    ref={textareaRef}
                    value={draftValue}
                    onChange={(e) => { setDraftValue(e.target.value); setIsDirty(true) }}
                    onBlur={() => saveIfDirty(selectedUnit.id, draftValue)}
                    rows={4}
                    className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                ) : (
                  <div className="rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap bg-gray-50 text-gray-800">
                    {selectedUnit.revisedTarget ?? selectedUnit.targetText}
                  </div>
                )}

                {/* Show original if revised */}
                {selectedUnit.revisedTarget !== null && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-400 mb-1">Original translation:</p>
                    <div className="bg-gray-50 rounded p-2 text-xs text-gray-500 line-through">
                      {selectedUnit.targetText}
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {isReviewer && selectedUnit.status !== "approved" && (
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => approveUnit(selectedUnit.id)}
                    disabled={saving === selectedUnit.id}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => setRejectingId(selectedUnit.id)}
                    disabled={saving === selectedUnit.id}
                    className="flex-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-sm font-medium py-2 rounded-lg transition-colors"
                  >
                    ✗ Reject
                  </button>
                </div>
              )}

              {/* Reject dialog inline */}
              {rejectingId === selectedUnit.id && (
                <div className="border border-red-200 bg-red-50 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-red-700">Reason for rejection</p>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Incorrect nuance, missing particle…"
                    className="w-full border border-red-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 bg-white"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") rejectUnit(selectedUnit.id)
                      if (e.key === "Escape") setRejectingId(null)
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => rejectUnit(selectedUnit.id)}
                      disabled={!rejectReason.trim()}
                      className="px-3 py-1 bg-red-600 text-white text-xs rounded disabled:opacity-40 hover:bg-red-700"
                    >
                      Confirm reject
                    </button>
                    <button
                      onClick={() => { setRejectingId(null); setRejectReason("") }}
                      className="px-3 py-1 text-gray-600 border border-gray-300 text-xs rounded hover:bg-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Approve All — always visible to reviewers */}
            {isReviewer && approvedCount < totalCount && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                {showApproveAllDialog && (
                  <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-amber-500 text-base leading-none mt-0.5">⚠</span>
                      <div>
                        <p className="text-sm font-medium text-amber-800">Approve all units?</p>
                        <p className="text-xs text-amber-700 mt-0.5">
                          This will mark all <strong>{totalCount - approvedCount}</strong> remaining units as approved — including ones you have not individually reviewed. This action cannot be undone.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-amber-800 font-medium">
                        Type <span className="font-mono bg-amber-100 px-1 rounded">approve all</span> to confirm
                      </p>
                      <input
                        type="text"
                        value={approveAllConfirmText}
                        onChange={(e) => setApproveAllConfirmText(e.target.value)}
                        placeholder="approve all"
                        className="w-full border border-amber-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={approveAll}
                        disabled={approveAllConfirmText.trim().toLowerCase() !== "approve all"}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg"
                      >
                        Yes, approve all
                      </button>
                      <button
                        onClick={() => { setShowApproveAllDialog(false); setApproveAllConfirmText("") }}
                        className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">{approvedCount}/{totalCount}</span> units approved
                  </p>
                  <button
                    onClick={() => setShowApproveAllDialog(true)}
                    disabled={approvingAll || showApproveAllDialog}
                    className="border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    {approvingAll ? "Approving…" : "Approve all"}
                  </button>
                </div>
              </div>
            )}

            {/* Submit review button */}
            {canSubmit && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                {submitError && (
                  <p className="text-xs text-red-600 mb-2">{submitError}</p>
                )}
                <div className="flex justify-end">
                  <button
                    onClick={submitReview}
                    disabled={submitLoading}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
                  >
                    {submitLoading ? "Submitting…" : "Submit review"}
                  </button>
                </div>
              </div>
            )}

            {/* Export button (for non-reviewers / admin when approved) */}
            {!isReviewer ||
              (projectStatus === "approved" || projectStatus === "exported" ? (
                <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Review {projectStatus}. Download revised XLIFF.
                  </p>
                  <a
                    href={`/api/projects/${projectId}/export`}
                    className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
                  >
                    ↓ Export XLIFF
                  </a>
                </div>
              ) : null)}
          </>
        ) : (
          <div className="flex-1 bg-white rounded-xl border border-gray-200 flex items-center justify-center">
            <p className="text-gray-400 text-sm">Select a unit to review</p>
          </div>
        )}
      </div>

      {/* Right: Comments + Audit */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => handleRightTab("comments")}
            className={cn(
              "flex-1 text-xs font-medium py-2.5 transition-colors",
              rightTab === "comments"
                ? "text-indigo-600 border-b-2 border-indigo-500"
                : "text-gray-500 hover:text-gray-800"
            )}
          >
            Comments
          </button>
          <button
            onClick={() => handleRightTab("audit")}
            className={cn(
              "flex-1 text-xs font-medium py-2.5 transition-colors",
              rightTab === "audit"
                ? "text-indigo-600 border-b-2 border-indigo-500"
                : "text-gray-500 hover:text-gray-800"
            )}
          >
            Audit trail
          </button>
        </div>

        {rightTab === "comments" ? (
          selectedUnit ? (
            <CommentPanel
              unit={selectedUnit}
              currentUserId={currentUserId}
              isReviewer={isReviewer}
              onCommentAdded={(c) => handleCommentAdded(selectedUnit.id, c)}
              onCommentResolved={handleCommentResolved}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-400 text-xs">No unit selected</p>
            </div>
          )
        ) : (
          /* Audit timeline */
          <div className="flex-1 overflow-y-auto">
            {auditLoading ? (
              <div className="p-4 text-xs text-gray-400 text-center">Loading…</div>
            ) : auditLog.length === 0 ? (
              <div className="p-4 text-xs text-gray-400 text-center">No activity yet.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {auditLog.map((entry) => {
                  const meta = ACTION_LABEL[entry.action] ?? { label: entry.action, color: "text-gray-600" }
                  return (
                    <div key={entry.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{entry.user}</p>
                      {entry.unit && (
                        <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">{entry.unit.xliffUnitId}</p>
                      )}
                      {entry.detail && (
                        <p className="text-xs text-gray-400 mt-0.5 italic">"{entry.detail}"</p>
                      )}
                      <p className="text-xs text-gray-300 mt-1">
                        {new Date(entry.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
