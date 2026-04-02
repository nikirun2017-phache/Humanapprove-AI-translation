"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Navbar } from "@/components/navbar"

interface ApiKeyEntry {
  id: string
  name: string
  keyPrefix: string
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

export default function AccountPage() {
  const { data: session } = useSession()

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null)

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([])
  const [keysLoading, setKeysLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState("")
  const [creatingKey, setCreatingKey] = useState(false)
  const [revealedKey, setRevealedKey] = useState<{ id: string; rawKey: string; name: string } | null>(null)
  const [keyStatus, setKeyStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null)

  const loadKeys = useCallback(async () => {
    setKeysLoading(true)
    try {
      const res = await fetch("/api/account/api-keys")
      if (res.ok) setApiKeys(await res.json() as ApiKeyEntry[])
    } finally {
      setKeysLoading(false)
    }
  }, [])

  useEffect(() => { void loadKeys() }, [loadKeys])

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault()
    if (!newKeyName.trim()) return
    setCreatingKey(true)
    setKeyStatus(null)
    try {
      const res = await fetch("/api/account/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      })
      const data = await res.json() as ApiKeyEntry & { rawKey?: string; error?: string }
      if (res.ok && data.rawKey) {
        setRevealedKey({ id: data.id, rawKey: data.rawKey, name: data.name })
        setNewKeyName("")
        await loadKeys()
      } else {
        setKeyStatus({ kind: "error", message: data.error ?? "Failed to create key" })
      }
    } catch {
      setKeyStatus({ kind: "error", message: "Network error — please try again." })
    } finally {
      setCreatingKey(false)
    }
  }

  async function handleRevokeKey(keyId: string) {
    if (!confirm("Revoke this API key? Any integrations using it will stop working immediately.")) return
    try {
      const res = await fetch(`/api/account/api-keys/${keyId}`, { method: "DELETE" })
      if (res.ok) {
        await loadKeys()
      } else {
        const data = await res.json() as { error?: string }
        setKeyStatus({ kind: "error", message: data.error ?? "Failed to revoke key" })
      }
    } catch {
      setKeyStatus({ kind: "error", message: "Network error — please try again." })
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setStatus({ kind: "error", message: "New passwords do not match" })
      return
    }
    setLoading(true)
    setStatus(null)
    try {
      const res = await fetch("/api/account/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (res.ok) {
        setStatus({ kind: "success", message: "Password updated successfully." })
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        setStatus({ kind: "error", message: data.error ?? "Failed to update password" })
      }
    } catch {
      setStatus({ kind: "error", message: "Network error — please try again." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your profile and security settings.</p>
        </div>

        {/* Profile info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Profile</h2>
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <span>{session?.user?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span>{session?.user?.email ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Role</span>
              <span className="capitalize">{session?.user?.role ?? "—"}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            To change your name or email, contact{" "}
            <a href="mailto:support@summontranslator.com" className="text-indigo-600 hover:underline">
              support@summontranslator.com
            </a>
          </p>
        </div>

        {/* Change password */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Change password</h2>

          {status && (
            <div className={`mb-4 text-sm rounded-lg px-3 py-2 ${status.kind === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
              {status.message}
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Current password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
            >
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>

          <p className="text-xs text-gray-400 mt-3">
            Not available for Google or Apple sign-in accounts.{" "}
            <a href="/forgot-password" className="text-indigo-600 hover:underline">Forgot your password?</a>
          </p>
        </div>

        {/* API Keys */}
        {session?.user?.role !== "reviewer" && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mt-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">API Keys</h2>
            <p className="text-xs text-gray-400 mb-4">
              Use API keys to access Summon Translator programmatically (e.g. via OpenClaw).{" "}
              <a href="/llms.txt" target="_blank" className="text-indigo-600 hover:underline">View API docs →</a>
            </p>

            {/* One-time key reveal modal */}
            {revealedKey && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-green-800 mb-1">
                  Key created: <span className="font-normal">{revealedKey.name}</span>
                </p>
                <p className="text-xs text-green-700 mb-2">
                  Copy this key now — it will not be shown again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-green-200 rounded px-3 py-2 text-xs font-mono text-gray-800 break-all select-all">
                    {revealedKey.rawKey}
                  </code>
                  <button
                    onClick={() => { void navigator.clipboard.writeText(revealedKey.rawKey) }}
                    className="shrink-0 text-xs px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                  >
                    Copy
                  </button>
                </div>
                <button
                  onClick={() => setRevealedKey(null)}
                  className="mt-2 text-xs text-green-700 hover:underline"
                >
                  I&apos;ve saved it — dismiss
                </button>
              </div>
            )}

            {keyStatus && (
              <div className={`mb-4 text-xs rounded-lg px-3 py-2 ${keyStatus.kind === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                {keyStatus.message}
              </div>
            )}

            {/* Existing keys */}
            {keysLoading ? (
              <p className="text-xs text-gray-400 py-2">Loading…</p>
            ) : apiKeys.filter(k => !k.revokedAt).length === 0 ? (
              <p className="text-xs text-gray-400 py-2">No API keys yet.</p>
            ) : (
              <div className="mb-4 border border-gray-100 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Name</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Prefix</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Last used</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {apiKeys.filter(k => !k.revokedAt).map(key => (
                      <tr key={key.id}>
                        <td className="px-3 py-2 text-gray-800">{key.name}</td>
                        <td className="px-3 py-2 font-mono text-gray-500">{key.keyPrefix}…</td>
                        <td className="px-3 py-2 text-gray-400">
                          {key.lastUsedAt
                            ? new Date(key.lastUsedAt).toLocaleDateString()
                            : "Never"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => handleRevokeKey(key.id)}
                            className="text-red-500 hover:text-red-700 font-medium"
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Create new key */}
            <form onSubmit={handleCreateKey} className="flex gap-2">
              <input
                type="text"
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="Key name, e.g. OpenClaw agent"
                maxLength={64}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={creatingKey || !newKeyName.trim()}
                className="shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
              >
                {creatingKey ? "Creating…" : "Create key"}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
