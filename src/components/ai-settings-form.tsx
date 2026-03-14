"use client"

import { useState } from "react"
import type { ProviderInfo } from "@/lib/ai-providers/types"

interface Props {
  providers: ProviderInfo[]
  keyStatus: Record<string, boolean>
}

export function AiSettingsForm({ providers, keyStatus }: Props) {
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<Record<string, "saving" | "saved" | "error">>({})
  const [currentStatus, setCurrentStatus] = useState<Record<string, boolean>>(keyStatus)

  async function save(providerName: string) {
    const key = keys[providerName]?.trim()
    if (!key) return

    setStatus((s) => ({ ...s, [providerName]: "saving" }))

    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: providerName, key }),
    })

    if (res.ok) {
      setStatus((s) => ({ ...s, [providerName]: "saved" }))
      setCurrentStatus((s) => ({ ...s, [providerName]: true }))
      setKeys((k) => ({ ...k, [providerName]: "" }))
      setTimeout(() => setStatus((s) => ({ ...s, [providerName]: undefined as unknown as "saved" })), 2000)
    } else {
      setStatus((s) => ({ ...s, [providerName]: "error" }))
    }
  }

  async function remove(providerName: string) {
    if (!confirm(`Remove the ${providerName} API key?`)) return
    const res = await fetch("/api/admin/settings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: providerName }),
    })
    if (res.ok) setCurrentStatus((s) => ({ ...s, [providerName]: false }))
  }

  return (
    <div className="space-y-4">
      {providers.map((provider) => {
        const hasKey = currentStatus[provider.name]
        const st = status[provider.name]
        return (
          <div key={provider.name} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-medium text-gray-900">{provider.label}</h2>
                <p className="text-xs text-gray-400">
                  Models: {provider.models.map((m) => m.label).join(", ")}
                </p>
              </div>
              {hasKey ? (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  Key configured
                </span>
              ) : (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  Not set
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Enter API key to set or update…"
                value={keys[provider.name] ?? ""}
                onChange={(e) => setKeys((k) => ({ ...k, [provider.name]: e.target.value }))}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoComplete="off"
              />
              <button
                onClick={() => save(provider.name)}
                disabled={!keys[provider.name]?.trim() || st === "saving"}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {st === "saving" ? "Saving…" : st === "saved" ? "Saved ✓" : "Save"}
              </button>
              {hasKey && (
                <button
                  onClick={() => remove(provider.name)}
                  className="px-3 py-2 text-sm text-red-500 hover:text-red-700 border border-gray-200 rounded-lg"
                >
                  Remove
                </button>
              )}
            </div>
            {st === "error" && (
              <p className="text-xs text-red-500 mt-1">Failed to save. Please try again.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
