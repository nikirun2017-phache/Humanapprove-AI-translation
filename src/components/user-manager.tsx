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

export function UserManager({ initialUsers, currentUserId }: { initialUsers: User[]; currentUserId: string }) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "reviewer",
    languages: [] as string[],
  })
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [langSearch, setLangSearch] = useState("")
  const filteredLangs = STUDIO_LANGUAGES.filter(
    (l: (typeof STUDIO_LANGUAGES)[number]) =>
      l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.code.toLowerCase().includes(langSearch.toLowerCase())
  )

  function toggleLanguage(code: string) {
    setForm((f) => ({
      ...f,
      languages: f.languages.includes(code)
        ? f.languages.filter((l: string) => l !== code)
        : [...f.languages, code],
    }))
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError("")
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) {
      setError(data.error)
      return
    }
    setUsers((u) => [...u, { ...data, createdAt: new Date() }])
    setShowForm(false)
    setLangSearch("")
    setForm({ name: "", email: "", password: "", role: "reviewer", languages: [] })
  }

  async function deleteUser(userId: string) {
    setDeletingId(userId)
    const res = await fetch(`/api/users/${userId}`, { method: "DELETE" })
    setDeletingId(null)
    setConfirmDeleteId(null)
    if (res.ok) {
      setUsers((u: User[]) => u.filter((x: User) => x.id !== userId))
    } else {
      const data = await res.json() as { error?: string }
      setError(data.error ?? "Failed to delete user")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + New user
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
          <button onClick={() => setError("")} className="ml-2 text-red-400 hover:text-red-700">✕</button>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={createUser}
          className="bg-white rounded-xl border border-gray-200 p-5 space-y-4"
        >
          <h2 className="font-medium text-gray-900">Create user</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value, languages: [] }))}
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

              {/* Selected chips */}
              {form.languages.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.languages.map((code: string) => (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full"
                    >
                      {langName(code)}
                      <button type="button" onClick={() => toggleLanguage(code)} className="text-indigo-400 hover:text-indigo-700">×</button>
                    </span>
                  ))}
                </div>
              )}

              <input
                type="text"
                placeholder="Search languages…"
                value={langSearch}
                onChange={(e) => setLangSearch(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {filteredLangs.map((lang: (typeof filteredLangs)[number]) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => toggleLanguage(lang.code)}
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
            <button
              type="button"
              onClick={() => { setShowForm(false); setLangSearch("") }}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create user"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-left">
              <th className="px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="px-4 py-3 font-medium text-gray-600">Target languages</th>
              <th className="px-4 py-3 font-medium text-gray-600">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((user: User) => {
              let langs: string[] = []
              try { langs = JSON.parse(user.languages) } catch {}
              const isSelf = user.id === currentUserId

              return (
                <tr key={user.id} className="hover:bg-gray-50">
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
                        {langs.map((code: string) => (
                          <span
                            key={code}
                            title={code}
                            className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                          >
                            {langName(code)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!isSelf && (
                      confirmDeleteId === user.id ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-xs text-gray-500">Remove {user.name}?</span>
                          <button
                            onClick={() => deleteUser(user.id)}
                            disabled={deletingId === user.id}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg disabled:opacity-50"
                          >
                            {deletingId === user.id ? "Removing…" : "Confirm"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(user.id)}
                          className="text-xs text-gray-400 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50"
                        >
                          Remove
                        </button>
                      )
                    )}
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
