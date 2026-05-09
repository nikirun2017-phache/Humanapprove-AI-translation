"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { STUDIO_LANGUAGES } from "@/lib/languages"
import type { ProviderInfo } from "@/lib/ai-providers/types"

// ── Types ──────────────────────────────────────────────────────────────────────

interface Integration {
  id?: string
  connector: string
  status: "connected" | "disconnected" | "error"
  lastTestedAt?: string
  credentials: Record<string, string>
  config: Record<string, string>
}

interface ContentItem {
  id: string
  name: string
  state: string
  itemCount: number
}

interface WebflowSite {
  id: string
  displayName: string
  shortName: string
}

interface ConnectorDef {
  id: string
  name: string
  tagline: string
  description: string
  icon: string
  iconBg: string
  fields: { key: string; label: string; type: string; placeholder: string }[]
  configFields?: { key: string; label: string; type: string; placeholder: string }[]
  docsUrl?: string
}

const CONNECTORS: ConnectorDef[] = [
  {
    id: "pendo",
    name: "Pendo",
    tagline: "Onboarding & in-app guides",
    description: "Pull guide content from Pendo Engage, translate it, and push the translated text back — ready for your localised user onboarding.",
    icon: "🎯",
    iconBg: "bg-purple-100",
    fields: [
      { key: "apiKey", label: "Integration Key", type: "password", placeholder: "Pendo integration key…" },
    ],
    docsUrl: "https://engageapi.pendo.io/",
  },
  {
    id: "webflow",
    name: "Webflow",
    tagline: "CMS collections & pages",
    description: "Connect to your Webflow CMS collections. Import text fields, translate them, and push the localised content back to your collections.",
    icon: "🌐",
    iconBg: "bg-blue-100",
    fields: [
      { key: "apiKey", label: "API Token", type: "password", placeholder: "Webflow API token…" },
    ],
    configFields: [
      { key: "siteId", label: "Site ID (optional — choose after connecting)", type: "text", placeholder: "e.g. 6437a98a7f..." },
    ],
    docsUrl: "https://developers.webflow.com/",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    tagline: "CMS content & Knowledge articles",
    description: "Translate Salesforce CMS managed content and Knowledge articles. Provide your org's instance URL and an OAuth access token.",
    icon: "☁️",
    iconBg: "bg-sky-100",
    fields: [
      { key: "instanceUrl", label: "Instance URL", type: "text", placeholder: "https://yourorg.my.salesforce.com" },
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "OAuth access token…" },
    ],
    docsUrl: "https://developer.salesforce.com/docs/atlas.en-us.cms_dev.meta/cms_dev/",
  },
]

// ── Small helper components ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "connected") return <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">● Connected</span>
  if (status === "error") return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">● Error</span>
  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">○ Not connected</span>
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

// ── Language picker (simplified multi-select) ─────────────────────────────────

function LanguagePicker({ selected, onChange }: { selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const [search, setSearch] = useState("")
  const filtered = STUDIO_LANGUAGES.filter(
    (l) => !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.code.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 40)
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-100">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search languages…"
          className="w-full text-sm outline-none bg-transparent"
        />
      </div>
      <div className="max-h-36 overflow-y-auto grid grid-cols-2 gap-px p-2">
        {filtered.map((l) => (
          <label key={l.code} className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-gray-50 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={selected.has(l.code)}
              onChange={(e) => {
                const next = new Set(selected)
                e.target.checked ? next.add(l.code) : next.delete(l.code)
                onChange(next)
              }}
              className="accent-indigo-600"
            />
            {l.name}
          </label>
        ))}
      </div>
      {selected.size > 0 && (
        <div className="px-3 py-1.5 border-t border-gray-100 text-xs text-indigo-600 font-medium">
          {selected.size} language{selected.size !== 1 ? "s" : ""} selected
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function IntegrationsManager({ providers }: { providers: ProviderInfo[] }) {
  const router = useRouter()
  const [saved, setSaved] = useState<Record<string, Integration>>({})
  const [forms, setForms] = useState<Record<string, Record<string, string>>>({})
  const [configs, setConfigs] = useState<Record<string, Record<string, string>>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [testing, setTesting] = useState<Record<string, boolean>>({})
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; error?: string } | null>>({})
  const [content, setContent] = useState<Record<string, ContentItem[]>>({})
  const [sites, setSites] = useState<Record<string, WebflowSite[]>>({})
  const [loadingContent, setLoadingContent] = useState<Record<string, boolean>>({})
  const [importing, setImporting] = useState<string | null>(null)
  const [pushing, setPushing] = useState<string | null>(null)
  const [importForm, setImportForm] = useState<{
    contentId: string; contentName: string; langs: Set<string>; provider: string; model: string
  } | null>(null)
  const [importError, setImportError] = useState("")
  const [recentJobs, setRecentJobs] = useState<{ id: string; name: string; status: string; tasks: { targetLanguage: string; status: string }[] }[]>([])

  // Default provider + model from first provider
  const defaultProvider = providers[0]?.name ?? "anthropic"
  const defaultModel = providers[0]?.models[0]?.id ?? ""

  const loadIntegrations = useCallback(async () => {
    const res = await fetch("/api/integrations")
    if (!res.ok) return
    const list = await res.json() as Integration[]
    const map: Record<string, Integration> = {}
    list.forEach((i) => { map[i.connector] = i })
    setSaved(map)
  }, [])

  useEffect(() => { loadIntegrations() }, [loadIntegrations])

  // Load content automatically when a connected connector is expanded
  useEffect(() => {
    if (!expanded) return
    const s = saved[expanded]
    if (s?.status === "connected" && !content[expanded] && !loadingContent[expanded]) {
      fetchContent(expanded)
    }
  }, [expanded, saved]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load recent integration jobs
  useEffect(() => {
    fetch("/api/translation-studio/jobs")
      .then((r) => r.json())
      .then((jobs: { id: string; name: string; status: string; integrationId?: string; tasks: { targetLanguage: string; status: string }[] }[]) => {
        if (!Array.isArray(jobs)) return
        setRecentJobs(jobs.filter((j) => j.integrationId).slice(0, 10))
      })
      .catch(() => {})
  }, [])

  function setForm(connector: string, key: string, val: string) {
    setForms((f) => ({ ...f, [connector]: { ...f[connector], [key]: val } }))
  }
  function setConfig(connector: string, key: string, val: string) {
    setConfigs((c) => ({ ...c, [connector]: { ...c[connector], [key]: val } }))
  }

  async function save(connector: string) {
    setSaving((s) => ({ ...s, [connector]: true }))
    setTestResult((r) => ({ ...r, [connector]: null }))
    const res = await fetch("/api/integrations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connector, credentials: forms[connector] ?? {}, config: configs[connector] ?? {} }),
    })
    setSaving((s) => ({ ...s, [connector]: false }))
    if (res.ok) {
      await loadIntegrations()
      setForms((f) => ({ ...f, [connector]: {} }))
    }
  }

  async function testConnection(connector: string) {
    setTesting((t) => ({ ...t, [connector]: true }))
    setTestResult((r) => ({ ...r, [connector]: null }))
    const res = await fetch(`/api/integrations/${connector}/test`, { method: "POST" })
    const data = await res.json() as { ok: boolean; error?: string }
    setTesting((t) => ({ ...t, [connector]: false }))
    setTestResult((r) => ({ ...r, [connector]: data }))
    await loadIntegrations()
    if (data.ok) fetchContent(connector)
  }

  async function fetchContent(connector: string) {
    setLoadingContent((l) => ({ ...l, [connector]: true }))
    const siteId = configs[connector]?.siteId ?? saved[connector]?.config?.siteId ?? ""
    const url = `/api/integrations/${connector}/content${siteId ? `?siteId=${siteId}` : ""}`
    const res = await fetch(url)
    setLoadingContent((l) => ({ ...l, [connector]: false }))
    if (!res.ok) return
    const data = await res.json() as { items?: ContentItem[]; sites?: WebflowSite[] } | ContentItem[]
    if (Array.isArray(data)) {
      setContent((c) => ({ ...c, [connector]: data }))
    } else {
      if (data.sites) setSites((s) => ({ ...s, [connector]: data.sites! }))
      if (data.items) setContent((c) => ({ ...c, [connector]: data.items! }))
    }
  }

  async function disconnect(connector: string) {
    await fetch(`/api/integrations?connector=${connector}`, { method: "DELETE" })
    await loadIntegrations()
    setContent((c) => ({ ...c, [connector]: [] }))
    setTestResult((r) => ({ ...r, [connector]: null }))
  }

  function openImport(item: ContentItem, connector: string) {
    setImportForm({
      contentId: item.id,
      contentName: item.name,
      langs: new Set<string>(),
      provider: defaultProvider,
      model: defaultModel,
    })
    setImportError("")
  }

  async function runImport(connector: string) {
    if (!importForm || importForm.langs.size === 0) {
      setImportError("Select at least one target language")
      return
    }
    setImporting(importForm.contentId)
    setImportError("")
    const body = {
      contentId: importForm.contentId,
      contentName: importForm.contentName,
      targetLanguages: Array.from(importForm.langs),
      provider: importForm.provider,
      model: importForm.model,
      siteId: configs[connector]?.siteId ?? saved[connector]?.config?.siteId,
    }
    const res = await fetch(`/api/integrations/${connector}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json() as { jobId?: string; error?: string }
    setImporting(null)
    if (!res.ok || !data.jobId) {
      setImportError(data.error ?? "Import failed")
      return
    }
    setImportForm(null)
    router.push(`/translation-studio/${data.jobId}`)
  }

  async function pushBack(jobId: string, connector: string, targetLanguage: string) {
    setPushing(`${jobId}-${targetLanguage}`)
    const res = await fetch(`/api/integrations/${connector}/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, targetLanguage }),
    })
    setPushing(null)
    const data = await res.json() as { ok?: boolean; pushedStrings?: number; error?: string }
    if (data.ok) {
      alert(`✓ Pushed ${data.pushedStrings} strings back to ${connector.charAt(0).toUpperCase() + connector.slice(1)}`)
    } else {
      alert(`Push failed: ${data.error}`)
    }
  }

  return (
    <div className="space-y-6">

      {/* Connector cards */}
      {CONNECTORS.map((def) => {
        const s = saved[def.id]
        const isConnected = s?.status === "connected"
        const isOpen = expanded === def.id
        const form = forms[def.id] ?? {}
        const cfg = configs[def.id] ?? {}
        const tr = testResult[def.id]

        return (
          <div key={def.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {/* Card header */}
            <div
              className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setExpanded(isOpen ? null : def.id)}
            >
              <div className={`w-10 h-10 rounded-xl ${def.iconBg} flex items-center justify-center text-xl shrink-0`}>
                {def.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">{def.name}</span>
                  <span className="text-xs text-gray-400">{def.tagline}</span>
                  <StatusBadge status={s?.status ?? "disconnected"} />
                </div>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{def.description}</p>
              </div>
              <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Expanded body */}
            {isOpen && (
              <div className="border-t border-gray-100 px-5 py-5 space-y-5">
                <p className="text-sm text-gray-600">{def.description}</p>

                {/* Credentials form */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Credentials</p>
                  {def.fields.map((field) => (
                    <div key={field.key}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{field.label}</label>
                      <input
                        type={field.type}
                        value={form[field.key] ?? ""}
                        onChange={(e) => setForm(def.id, field.key, e.target.value)}
                        placeholder={s?.credentials?.[field.key] ? `Current: ${s.credentials[field.key]}` : field.placeholder}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  ))}
                  {def.configFields?.map((field) => (
                    <div key={field.key}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{field.label}</label>
                      <input
                        type={field.type}
                        value={cfg[field.key] ?? ""}
                        onChange={(e) => setConfig(def.id, field.key, e.target.value)}
                        placeholder={s?.config?.[field.key] ?? field.placeholder}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  ))}
                </div>

                {/* Webflow site picker */}
                {def.id === "webflow" && sites["webflow"]?.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Select site</label>
                    <select
                      value={cfg.siteId ?? ""}
                      onChange={(e) => setConfig("webflow", "siteId", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">— choose a site —</option>
                      {sites["webflow"].map((site) => (
                        <option key={site.id} value={site.id}>{site.displayName} ({site.shortName})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => save(def.id)}
                    disabled={saving[def.id] || Object.keys(form).length === 0}
                    className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
                  >
                    {saving[def.id] ? "Saving…" : "Save credentials"}
                  </button>
                  {s && (
                    <button
                      onClick={() => testConnection(def.id)}
                      disabled={testing[def.id]}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors flex items-center gap-2"
                    >
                      {testing[def.id] && <Spinner />}
                      {testing[def.id] ? "Testing…" : "Test connection"}
                    </button>
                  )}
                  {isConnected && (
                    <button
                      onClick={() => fetchContent(def.id)}
                      disabled={loadingContent[def.id]}
                      className="px-4 py-2 text-sm border border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50 disabled:opacity-40 transition-colors flex items-center gap-2"
                    >
                      {loadingContent[def.id] && <Spinner />}
                      {loadingContent[def.id] ? "Loading…" : "Refresh content"}
                    </button>
                  )}
                  {isConnected && (
                    <button
                      onClick={() => disconnect(def.id)}
                      className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Disconnect
                    </button>
                  )}
                </div>

                {/* Test result */}
                {tr && (
                  <div className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2 ${tr.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
                    <span>{tr.ok ? "✓" : "✕"}</span>
                    <span>{tr.ok ? "Connection successful" : (tr.error ?? "Connection failed")}</span>
                  </div>
                )}

                {/* Docs link */}
                {def.docsUrl && (
                  <p className="text-xs text-gray-400">
                    API docs:{" "}
                    <a href={def.docsUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">
                      {def.docsUrl}
                    </a>
                  </p>
                )}

                {/* Content list */}
                {isConnected && content[def.id]?.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Available content</p>
                    <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                      {content[def.id].map((item) => (
                        <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {item.state}
                              {item.itemCount > 0 && ` · ${item.itemCount} step${item.itemCount !== 1 ? "s" : ""}`}
                            </p>
                          </div>
                          <button
                            onClick={() => openImport(item, def.id)}
                            className="ml-4 shrink-0 px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                          >
                            Import for translation
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isConnected && loadingContent[def.id] && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Spinner /> Loading content…
                  </div>
                )}

                {isConnected && !loadingContent[def.id] && content[def.id]?.length === 0 && (
                  <p className="text-sm text-gray-400">No content found. Make sure the credentials have read access.</p>
                )}

                {/* Import modal (inline) */}
                {importForm && (
                  <div className="border border-indigo-200 bg-indigo-50 rounded-2xl p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-indigo-900 text-sm">Import: {importForm.contentName}</p>
                        <p className="text-xs text-indigo-600 mt-0.5">Choose target languages and AI model, then import.</p>
                      </div>
                      <button onClick={() => setImportForm(null)} className="text-indigo-400 hover:text-indigo-600 text-lg leading-none">×</button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-indigo-800 mb-1">AI Model</label>
                        <select
                          value={importForm.model}
                          onChange={(e) => setImportForm((f) => f ? { ...f, model: e.target.value } : f)}
                          className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {providers.flatMap((p) => p.models.map((m) => (
                            <option key={`${p.name}:${m.id}`} value={m.id}>{m.label}</option>
                          )))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-indigo-800 mb-1">Target languages</label>
                      <LanguagePicker
                        selected={importForm.langs}
                        onChange={(langs) => setImportForm((f) => f ? { ...f, langs } : f)}
                      />
                    </div>

                    {importError && (
                      <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{importError}</p>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => runImport(def.id)}
                        disabled={importing === importForm.contentId}
                        className="px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                      >
                        {importing === importForm.contentId && <Spinner />}
                        {importing === importForm.contentId ? "Importing…" : "Import & translate"}
                      </button>
                      <button onClick={() => setImportForm(null)} className="px-5 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Recent integration jobs */}
      {recentJobs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recent integration jobs</p>
          </div>
          <div className="divide-y divide-gray-100">
            {recentJobs.map((job) => {
              const completedTasks = job.tasks.filter((t) => t.status === "completed")
              const connectorName = CONNECTORS.find((c) => job.name.toLowerCase().startsWith(`[${c.id}`))
              return (
                <div key={job.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <a href={`/translation-studio/${job.id}`} className="text-sm font-medium text-gray-900 hover:text-indigo-600 truncate block">
                      {job.name}
                    </a>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {job.status === "completed" ? `✓ ${completedTasks.length} language${completedTasks.length !== 1 ? "s" : ""} ready` : `${job.status}`}
                    </p>
                  </div>
                  {job.status === "completed" && completedTasks.length > 0 && connectorName && (
                    <div className="flex flex-wrap gap-1">
                      {completedTasks.map((t) => (
                        <button
                          key={t.targetLanguage}
                          onClick={() => pushBack(job.id, connectorName.id, t.targetLanguage)}
                          disabled={pushing === `${job.id}-${t.targetLanguage}`}
                          className="text-xs px-2.5 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                          {pushing === `${job.id}-${t.targetLanguage}` ? "Pushing…" : `Push ${t.targetLanguage}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
