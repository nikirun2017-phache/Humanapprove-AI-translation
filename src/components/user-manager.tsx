"use client"

import { useState } from "react"
import { STUDIO_LANGUAGES } from "@/lib/languages"

interface User {
  id: string
  email: string
  name: string
  role: string
  languages: string
  createdAt: Date | string
}

const LANG_LABEL = Object.fromEntries(STUDIO_LANGUAGES.map((l: (typeof STUDIO_LANGUAGES)[number]) => [l.code, l.name]))

function langName(code: string) {
  return LANG_LABEL[code] ?? code
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  reviewer: "bg-indigo-100 text-indigo-700",
  requester: "bg-teal-100 text-teal-700",
}

// ── Add User Form ─────────────────────────────────────────────────────────────

function AddUserForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (u: User) => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "reviewer", languages: [] as string[] })
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [langSearch, setLangSearch] = useState("")

  const filteredLangs = STUDIO_LANGUAGES.filter(
    (l: (typeof STUDIO_LANGUAGES)[number]) =>
      l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.code.toLowerCase().includes(langSearch.toLowerCase())
  )

  function toggleLanguage(code: string) {
    setForm(f => ({
      ...f,
      languages: f.languages.includes(code)
        ? f.languages.filter((l: string) => l !== code)
        : [...f.languages, code],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError("")
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await res.json() as User & { error?: string }
    setSubmitting(false)
    if (!res.ok) { setError(data.error ?? "Failed to create user"); return }
    onCreated({ ...data, createdAt: new Date() })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h2 className="font-medium text-gray-900">Create user</h2>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 flex justify-between">
          {error}
          <button type="button" onClick={() => setError("")} className="text-red-400 hover:text-red-700">✕</button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text" required value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email" required value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password" required minLength={8} value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder="Minimum 8 characters"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
          <select
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value, languages: [] }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="reviewer">Reviewer</option>
            <option value="requester">Requester</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {form.role === "reviewer" && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Target languages
            {form.languages.length > 0 && (
              <span className="ml-2 text-indigo-600 font-normal">{form.languages.length} selected</span>
            )}
          </label>
          {form.languages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.languages.map((code: string) => (
                <span key={code} className="inline-flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  {langName(code)}
                  <button type="button" onClick={() => toggleLanguage(code)} className="text-indigo-400 hover:text-indigo-700">×</button>
                </span>
              ))}
            </div>
          )}
          <input
            type="text" placeholder="Search languages…" value={langSearch}
            onChange={e => setLangSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {filteredLangs.map((lang: (typeof filteredLangs)[number]) => (
              <button
                key={lang.code} type="button" onClick={() => toggleLanguage(lang.code)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
                  form.languages.includes(lang.code)
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                }`}
              >
                <span className="block font-medium truncate">{lang.name}</span>
                <span className="block opacity-60 text-[10px]">{lang.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" disabled={submitting} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {submitting ? "Creating…" : "Create user"}
        </button>
      </div>
    </form>
  )
}

// ── Edit Role Modal ───────────────────────────────────────────────────────────

function EditRoleModal({ user, onClose, onUpdated }: { user: User; onClose: () => void; onUpdated: (u: User) => void }) {
  const [role, setRole] = useState(user.role)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSave() {
    setLoading(true)
    setError("")
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
    const data = await res.json() as User & { error?: string }
    setLoading(false)
    if (!res.ok) { setError(data.error ?? "Failed to update"); return }
    onUpdated({ ...user, ...data })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Edit role</h2>
        <p className="text-sm text-gray-500 mb-4">{user.name} · {user.email}</p>
        {error && <div className="mb-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
        <select
          value={role} onChange={e => setRole(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="requester">Requester</option>
          <option value="reviewer">Reviewer</option>
          <option value="admin">Admin</option>
        </select>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
            {loading ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function UserManager({ initialUsers, currentUserId }: { initialUsers: User[]; currentUserId: string }) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<{ mode: "single" | "bulk"; id?: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchSearch = !search || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchRole = !roleFilter || u.role === roleFilter
    return matchSearch && matchRole
  })

  const allSelected = filtered.length > 0 && filtered.every(u => selected.has(u.id))

  function toggleAll() {
    if (allSelected) {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(u => s.delete(u.id)); return s })
    } else {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(u => s.add(u.id)); return s })
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  async function deleteSingle(id: string) {
    setDeletingId(id)
    setError("")
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" })
    setDeletingId(null)
    setConfirmDelete(null)
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== id))
      setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
    } else {
      const data = await res.json() as { error?: string }
      setError(data.error ?? "Failed to delete user")
    }
  }

  async function deleteBulk() {
    const ids = Array.from(selected)
    setBulkDeleting(true)
    setError("")
    const res = await fetch("/api/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
    setBulkDeleting(false)
    setConfirmDelete(null)
    if (res.ok) {
      setUsers(prev => prev.filter(u => !ids.includes(u.id)))
      setSelected(new Set())
    } else {
      const data = await res.json() as { error?: string }
      setError(data.error ?? "Failed to delete users")
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <select
          value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All roles</option>
          <option value="requester">Requester</option>
          <option value="reviewer">Reviewer</option>
          <option value="admin">Admin</option>
        </select>
        <button
          onClick={() => { setShowForm(v => !v); setError("") }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg whitespace-nowrap"
        >
          + New user
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex justify-between">
          {error}
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-700">✕</button>
        </div>
      )}

      {showForm && (
        <AddUserForm
          onCancel={() => setShowForm(false)}
          onCreated={u => { setUsers(prev => [u, ...prev]); setShowForm(false) }}
        />
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5">
          <span className="text-sm text-indigo-700 font-medium">{selected.size} selected</span>
          <button
            onClick={() => setConfirmDelete({ mode: "bulk" })}
            className="ml-auto text-sm text-red-600 hover:text-red-800 font-medium border border-red-200 rounded-lg px-3 py-1 hover:bg-red-50 transition-colors"
          >
            Delete selected
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm text-gray-500 hover:text-gray-700">
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-400">
            {search || roleFilter ? "No users match your filters." : "No users yet."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                <th className="px-4 py-3">
                  <input
                    type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="px-4 py-3 font-medium text-gray-600">Role</th>
                <th className="px-4 py-3 font-medium text-gray-600">Languages</th>
                <th className="px-4 py-3 font-medium text-gray-600">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((user: User) => {
                let langs: string[] = []
                try { langs = JSON.parse(user.languages) } catch {}
                const isSelf = user.id === currentUserId

                return (
                  <tr key={user.id} className={`hover:bg-gray-50 ${selected.has(user.id) ? "bg-indigo-50/40" : ""}`}>
                    <td className="px-4 py-3">
                      {!isSelf && (
                        <input
                          type="checkbox" checked={selected.has(user.id)} onChange={() => toggleOne(user.id)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {user.name}
                      {isSelf && <span className="ml-1.5 text-xs text-gray-400">(you)</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-600"}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {langs.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {langs.slice(0, 3).map((code: string) => (
                            <span key={code} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {langName(code)}
                            </span>
                          ))}
                          {langs.length > 3 && (
                            <span className="text-xs text-gray-400">+{langs.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isSelf && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditUser(user)}
                            className="text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 rounded px-2 py-1 hover:border-indigo-300 transition-colors"
                          >
                            Edit role
                          </button>
                          <button
                            onClick={() => setConfirmDelete({ mode: "single", id: user.id })}
                            disabled={deletingId === user.id}
                            className="text-xs text-red-500 hover:text-red-700 border border-red-100 rounded px-2 py-1 hover:border-red-300 transition-colors disabled:opacity-50"
                          >
                            {deletingId === user.id ? "Removing…" : "Remove"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {confirmDelete.mode === "bulk"
                ? `Delete ${selected.size} user${selected.size !== 1 ? "s" : ""}?`
                : "Remove user?"}
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              This will permanently delete {confirmDelete.mode === "bulk" ? "the selected accounts" : "this account"}. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete.mode === "bulk" ? deleteBulk() : deleteSingle(confirmDelete.id!)}
                disabled={deletingId !== null || bulkDeleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
              >
                {deletingId !== null || bulkDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editUser && (
        <EditRoleModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onUpdated={updated => {
            setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
            setEditUser(null)
          }}
        />
      )}
    </div>
  )
}
