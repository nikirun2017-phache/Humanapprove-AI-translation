"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

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
  comments: Comment[]
}

interface CommentPanelProps {
  unit: Unit
  currentUserId: string
  isReviewer: boolean
  onCommentAdded: (comment: Comment) => void
  onCommentResolved: (commentId: string) => void
}

export function CommentPanel({
  unit,
  currentUserId,
  onCommentAdded,
  onCommentResolved,
}: CommentPanelProps) {
  const [newComment, setNewComment] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const active = unit.comments.filter((c) => !c.resolved)
  const resolved = unit.comments.filter((c) => c.resolved)

  async function submitComment() {
    if (!newComment.trim()) return
    setSubmitting(true)
    const res = await fetch(`/api/units/${unit.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newComment.trim() }),
    })
    if (res.ok) {
      const comment = await res.json()
      onCommentAdded(comment)
      setNewComment("")
    }
    setSubmitting(false)
  }

  async function resolveComment(commentId: string) {
    const res = await fetch(`/api/comments/${commentId}/resolve`, { method: "PATCH" })
    if (res.ok) {
      onCommentResolved(commentId)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-800">Comments</h3>
        {active.length > 0 && (
          <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
            {active.length} open
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {unit.comments.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No comments yet</p>
        )}

        {active.map((comment) => (
          <CommentCard
            key={comment.id}
            comment={comment}
            currentUserId={currentUserId}
            onResolve={resolveComment}
          />
        ))}

        {resolved.length > 0 && (
          <>
            <p className="text-xs text-gray-400 pt-2">Resolved</p>
            {resolved.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                resolved
              />
            ))}
          </>
        )}
      </div>

      {/* Add comment */}
      <div className="p-3 border-t border-gray-100 space-y-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment…"
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment()
          }}
        />
        <button
          onClick={submitComment}
          disabled={!newComment.trim() || submitting}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
        >
          {submitting ? "Adding…" : "Add comment"}
        </button>
      </div>
    </div>
  )
}

function CommentCard({
  comment,
  currentUserId,
  resolved = false,
  onResolve,
}: {
  comment: Comment
  currentUserId: string
  resolved?: boolean
  onResolve?: (id: string) => void
}) {
  return (
    <div
      className={cn(
        "rounded-lg p-2.5 text-xs space-y-1",
        resolved ? "bg-gray-50 opacity-60" : "bg-yellow-50 border border-yellow-100"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-700">{comment.author.name}</span>
        <span className="text-gray-400">
          {new Date(comment.createdAt).toLocaleDateString()}
        </span>
      </div>
      <p className={cn("text-gray-700 leading-relaxed", resolved && "line-through text-gray-400")}>
        {comment.body}
      </p>
      {!resolved && onResolve && (
        <button
          onClick={() => onResolve(comment.id)}
          className="text-gray-400 hover:text-green-600 transition-colors"
        >
          ✓ Resolve
        </button>
      )}
    </div>
  )
}
