"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { Navbar } from "@/components/navbar"

export default function AccountPage() {
  const { data: session } = useSession()

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null)

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
      </main>
    </div>
  )
}
