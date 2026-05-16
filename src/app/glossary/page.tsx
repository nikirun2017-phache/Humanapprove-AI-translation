"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { AppShell } from "@/components/app-shell"
import { STUDIO_LANGUAGES } from "@/lib/languages"

interface GlossaryEntry {
  id: string
  sourceTerm: string
  targetTerm: string
  sourceLang: string
  targetLang: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

const LANGUAGE_OPTIONS = [{ code: "en-US", name: "English (United States)" }, ...STUDIO_LANGUAGES]

function getLangName(code: string): string {
  const found = LANGUAGE_OPTIONS.find((l) => l.code === code)
  return found ? found.name : code
}

// ─── Add Entry Form ────────────────────────────────────────────────────────────

interface AddFormProps {
  onAdded: (entry: GlossaryEntry) => void
}

function AddEntryForm({ onAdded }: AddFormProps) {
  const [sourceTerm, setSourceTerm] = useState("")
  const [targetTerm, setTargetTerm] = useState("")
  const [sourceLang, setSourceLang] = useState("en-US")
  const [targetLang, setTargetLang] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!sourceTerm.trim() || !targetTerm.trim() || !sourceLang || !targetLang) {
      setError("Source term, target term, source language, and target language are all required.")
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/glossary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceTerm, targetTerm, sourceLang, targetLang, notes: notes || undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setError(data.error ?? "Failed to create glossary entry.")
        return
      }
      const data = await res.json() as { entry: GlossaryEntry }
      onAdded(data.entry)
      setSourceTerm("")
      setTargetTerm("")
      setNotes("")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Add New Entry</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source term</label>
            <input
              type="text"
              value={sourceTerm}
              onChange={(e) => setSourceTerm(e.target.value)}
              placeholder="e.g. Enterprise"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target term</label>
            <input
              type="text"
              value={targetTerm}
              onChange={(e) => setTargetTerm(e.target.value)}
              placeholder="e.g. 企业版"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source language</label>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            >
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target language</label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            >
              <option value="">Select language…</option>
              {STUDIO_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Product tier name — do not localise further"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Adding…" : "Add entry"}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Edit Row Form ─────────────────────────────────────────────────────────────

interface EditRowProps {
  entry: GlossaryEntry
  onSaved: (updated: GlossaryEntry) => void
  onCancel: () => void
}

function EditRow({ entry, onSaved, onCancel }: EditRowProps) {
  const [targetTerm, setTargetTerm] = useState(entry.targetTerm)
  const [notes, setNotes] = useState(entry.notes ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!targetTerm.trim()) {
      setError("Target term cannot be empty.")
      return
    }
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/glossary/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTerm, notes: notes || undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setError(data.error ?? "Failed to save.")
        return
      }
      const data = await res.json() as { entry: GlossaryEntry }
      onSaved(data.entry)
    } catch {
      setError("Network error.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="bg-indigo-50">
      <td className="px-4 py-3 text-sm text-gray-700 align-top">{entry.sourceTerm}</td>
      <td className="px-4 py-3 align-top">
        <input
          type="text"
          value={targetTerm}
          onChange={(e) => setTargetTerm(e.target.value)}
          className="w-full rounded border border-indigo-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 align-top whitespace-nowrap">
        {getLangName(entry.sourceLang)} → {getLangName(entry.targetLang)}
      </td>
      <td className="px-4 py-3 align-top">
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes…"
          className="w-full rounded border border-indigo-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs font-medium text-indigo-700 hover:text-indigo-900 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={onCancel} className="text-xs font-medium text-gray-500 hover:text-gray-700">
            Cancel
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function GlossaryPage() {
  const { status } = useSession()
  const [entries, setEntries] = useState<GlossaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Filter state
  const [filterSourceLang, setFilterSourceLang] = useState("")
  const [filterTargetLang, setFilterTargetLang] = useState("")

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterSourceLang) params.set("sourceLang", filterSourceLang)
      if (filterTargetLang) params.set("targetLang", filterTargetLang)
      const url = `/api/glossary${params.toString() ? `?${params.toString()}` : ""}`
      const res = await fetch(url)
      if (!res.ok) {
        setError("Failed to load glossary entries.")
        return
      }
      const data = await res.json() as { entries: GlossaryEntry[] }
      setEntries(data.entries)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [filterSourceLang, filterTargetLang])

  useEffect(() => {
    if (status === "authenticated") {
      void fetchEntries()
    }
  }, [status, fetchEntries])

  function handleAdded(entry: GlossaryEntry) {
    setEntries((prev) => [entry, ...prev])
  }

  function handleSaved(updated: GlossaryEntry) {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    setEditingId(null)
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this glossary entry? This cannot be undone.")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/glossary?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id))
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string }
        alert(data.error ?? "Failed to delete entry.")
      }
    } catch {
      alert("Network error. Please try again.")
    } finally {
      setDeletingId(null)
    }
  }

  if (status === "loading") {
    return (
      <AppShell>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center justify-center h-40 text-sm text-gray-500">Loading…</div>
        </main>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Glossary</h1>
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                {entries.length} {entries.length === 1 ? "entry" : "entries"}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Define brand terms and required translations. These terms will be applied consistently across all your translation jobs.
            </p>
          </div>
        </div>

        {/* Add Entry Form */}
        <div className="mb-6">
          <AddEntryForm onAdded={handleAdded} />
        </div>

        {/* Filter Bar */}
        <div className="mb-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Filter by source language</label>
            <select
              value={filterSourceLang}
              onChange={(e) => setFilterSourceLang(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All source languages</option>
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Filter by target language</label>
            <select
              value={filterTargetLang}
              onChange={(e) => setFilterTargetLang(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All target languages</option>
              {STUDIO_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>
          {(filterSourceLang || filterTargetLang) && (
            <button
              onClick={() => { setFilterSourceLang(""); setFilterTargetLang("") }}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium pb-2"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Entries Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-sm text-gray-500">Loading entries…</div>
          ) : error ? (
            <div className="flex items-center justify-center h-40 text-sm text-red-600">{error}</div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-center px-4">
              <p className="text-sm font-medium text-gray-700">No glossary entries yet</p>
              <p className="text-sm text-gray-500">
                Add your first entry above. Glossary terms ensure brand names, product tiers, and
                specialist vocabulary are always translated consistently.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Source term</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Target</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Lang pair</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {entries.map((entry) =>
                    editingId === entry.id ? (
                      <EditRow
                        key={entry.id}
                        entry={entry}
                        onSaved={handleSaved}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 align-top">{entry.sourceTerm}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 align-top">{entry.targetTerm}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 align-top whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-600">{entry.sourceLang}</span>
                            <span className="text-gray-400">→</span>
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-600">{entry.targetLang}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 align-top">
                          {entry.notes ? (
                            <span className="italic">{entry.notes}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setEditingId(entry.id)}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(entry.id)}
                              disabled={deletingId === entry.id}
                              className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
                            >
                              {deletingId === entry.id ? "Deleting…" : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  )
}
