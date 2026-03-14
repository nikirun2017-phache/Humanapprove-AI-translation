"use client"

import { useState } from "react"

interface User {
  id: string
  email: string
  name: string
  role: string
  languages: string
  createdAt: Date | string
}

const ALL_LANGUAGES = [
  { code: "ja-JP", label: "Japanese" },
  { code: "zh-CN", label: "Chinese (Simplified)" },
  { code: "zh-TW", label: "Chinese (Traditional)" },
  { code: "ko-KR", label: "Korean" },
  { code: "fr-FR", label: "French" },
  { code: "de-DE", label: "German" },
  { code: "es-ES", label: "Spanish" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "it-IT", label: "Italian" },
  { code: "ru-RU", label: "Russian" },
  { code: "ar", label: "Arabic" },
  { code: "th-TH", label: "Thai" },
  { code: "vi-VN", label: "Vietnamese" },
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
]

export function UserManager({ initialUsers }: { initialUsers: User[] }) {
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

  function toggleLanguage(code: string) {
    setForm((f) => ({
      ...f,
      languages: f.languages.includes(code)
        ? f.languages.filter((l) => l !== code)
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
    setForm({ name: "", email: "", password: "", role: "reviewer", languages: [] })
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

      {showForm && (
        <form
          onSubmit={createUser}
          className="bg-white rounded-xl border border-gray-200 p-5 space-y-4"
        >
          <h2 className="font-medium text-gray-900">Create user</h2>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>
          )}
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
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
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
                Languages (native)
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => toggleLanguage(lang.code)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      form.languages.includes(lang.code)
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-indigo-300"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
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
              <th className="px-4 py-3 font-medium text-gray-600">Languages</th>
              <th className="px-4 py-3 font-medium text-gray-600">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map((user) => {
              let langs: string[] = []
              try { langs = JSON.parse(user.languages) } catch {}
              return (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                  <td className="px-4 py-3 text-gray-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{user.role}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {langs.length > 0 ? langs.join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString()}
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
