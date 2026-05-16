"use client"

import { useEffect, useState } from "react"
import { AppShell } from "@/components/app-shell"
import Link from "next/link"

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardData {
  users: {
    total: number
    byRole: Record<string, number>
    paying: number
    newThisMonth: number
    signupsByMonth: { month: string; count: number }[]
  }
  jobs: {
    total: number
    thisMonth: number
    completionRate: number
    failureRate: number
    byModel: { model: string; count: number; totalWords: number; provider: string }[]
    byFormat: { format: string; count: number }[]
    jobsByMonth: { month: string; count: number }[]
  }
  words: { total: number; thisMonth: number }
  revenue: {
    estimatedAllTimeUsd: number
    apiCostAllTimeUsd: number
    grossMarginPct: number
    markup: number
    charged: {
      allTimeCents: number
      thisMonthCents: number
      byMonth: { month: string; amountCents: number }[]
    }
  }
  features: {
    translationJobs: number
    lqaRuns: number
    mediaRuns: number
    integrations: number
  }
  signals: {
    avgJobsPerUser: number
    topLanguages: { language: string; count: number }[]
    topModels: { model: string; count: number; totalWords: number }[]
    topFormats: { format: string; count: number }[]
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(usd: number) {
  if (usd >= 1000) return `$${(usd / 1000).toFixed(1)}k`
  return `$${usd.toFixed(2)}`
}

function fmtWords(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function fmtMonth(m: string) {
  const [y, mo] = m.split("-")
  return new Date(Number(y), Number(mo) - 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" })
}

// ── Mini bar chart ─────────────────────────────────────────────────────────────

function BarChart({
  data,
  color = "bg-indigo-500",
  valueFormatter = (v: number) => String(v),
}: {
  data: { label: string; value: number }[]
  color?: string
  valueFormatter?: (v: number) => string
}) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-1.5 h-20">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <span className="text-[9px] text-gray-400 tabular-nums leading-none">
            {d.value > 0 ? valueFormatter(d.value) : ""}
          </span>
          <div className="w-full flex items-end" style={{ height: 52 }}>
            <div
              className={`w-full rounded-t ${color} transition-all`}
              style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 4 : 0)}%` }}
            />
          </div>
          <span className="text-[9px] text-gray-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent = "text-gray-900",
}: {
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Horizontal bar ─────────────────────────────────────────────────────────────

function HBar({ label, value, max, formatter }: { label: string; value: number; max: number; formatter?: (v: number) => string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-700 font-medium truncate max-w-[160px]">{label}</span>
        <span className="text-gray-500 tabular-nums ml-2">{formatter ? formatter(value) : value}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then(r => r.json())
      .then((d: DashboardData | { error: string }) => {
        if ("error" in d) setError((d as { error: string }).error)
        else setData(d as DashboardData)
      })
      .catch(() => setError("Failed to load dashboard"))
  }, [])

  if (error) {
    return (
      <AppShell>
        <main className="max-w-7xl mx-auto px-6 py-12 text-center text-red-600 text-sm">{error}</main>
      </AppShell>
    )
  }

  if (!data) {
    return (
      <AppShell>
        <main className="max-w-7xl mx-auto px-6 py-12 text-center text-gray-400 text-sm">Loading dashboard…</main>
      </AppShell>
    )
  }

  const { users, jobs, words, revenue, features, signals } = data

  const chargedAllTime = revenue.charged.allTimeCents / 100
  const chargedThisMonth = revenue.charged.thisMonthCents / 100
  const freeToPayingRate = users.total > 0 ? Math.round((users.paying / users.total) * 100) : 0
  const topModelMax = signals.topModels[0]?.count ?? 1
  const topLangMax = signals.topLanguages[0]?.count ?? 1
  const topFormatMax = signals.topFormats[0]?.count ?? 1

  // Model label shortener
  const modelLabel = (id: string) => {
    const map: Record<string, string> = {
      "claude-sonnet-4-6": "Sonnet 4.6",
      "claude-opus-4-5": "Opus 4.5",
      "claude-haiku-4-5-20251001": "Haiku 4.5",
      "gpt-4o": "GPT-4o",
      "gpt-4o-mini": "GPT-4o Mini",
      "deepseek-chat": "DeepSeek Chat",
      "deepseek-reasoner": "DeepSeek R1",
    }
    return map[id] ?? id
  }

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CEO Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">Platform ROI, usage trends, and roadmap signals.</p>
          </div>
          <span className="text-xs text-gray-400">Live · refreshes on page load</span>
        </div>

        {/* ── Top KPIs ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Users"
            value={String(users.total)}
            sub={`+${users.newThisMonth} this month`}
            accent="text-indigo-700"
          />
          <StatCard
            label="Paying Users"
            value={String(users.paying)}
            sub={`${freeToPayingRate}% conversion`}
            accent="text-green-700"
          />
          <StatCard
            label="Words Translated"
            value={fmtWords(words.total)}
            sub={`+${fmtWords(words.thisMonth)} this month`}
          />
          <StatCard
            label="Job Success Rate"
            value={`${jobs.completionRate}%`}
            sub={`${jobs.failureRate}% failed`}
            accent={jobs.completionRate >= 90 ? "text-green-700" : jobs.completionRate >= 70 ? "text-yellow-700" : "text-red-700"}
          />
        </div>

        {/* ── Revenue & Margin ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Revenue & Cost (ROI)</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-green-50 rounded-lg border border-green-100 px-4 py-3">
              <p className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-0.5">Est. Revenue (All Time)</p>
              <p className="text-xl font-bold text-green-800">{fmtMoney(revenue.estimatedAllTimeUsd)}</p>
              <p className="text-xs text-green-600 mt-0.5">{revenue.markup}× markup applied</p>
            </div>
            <div className="bg-red-50 rounded-lg border border-red-100 px-4 py-3">
              <p className="text-xs text-red-600 font-semibold uppercase tracking-wide mb-0.5">AI API Cost (All Time)</p>
              <p className="text-xl font-bold text-red-800">{fmtMoney(revenue.apiCostAllTimeUsd)}</p>
              <p className="text-xs text-red-600 mt-0.5">Raw provider cost</p>
            </div>
            <div className="bg-indigo-50 rounded-lg border border-indigo-100 px-4 py-3">
              <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wide mb-0.5">Gross Margin</p>
              <p className={`text-xl font-bold ${revenue.grossMarginPct >= 70 ? "text-indigo-800" : "text-yellow-700"}`}>
                {revenue.grossMarginPct}%
              </p>
              <p className="text-xs text-indigo-600 mt-0.5">Revenue − API cost</p>
            </div>
            <div className="bg-gray-50 rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-0.5">Stripe Charged</p>
              <p className="text-xl font-bold text-gray-800">{fmtMoney(chargedAllTime)}</p>
              <p className="text-xs text-gray-500 mt-0.5">{fmtMoney(chargedThisMonth)} this month</p>
            </div>
          </div>

          {/* Monthly revenue bar chart */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Stripe Charges · Last 6 Months</p>
            {revenue.charged.byMonth.every(m => m.amountCents === 0) ? (
              <p className="text-sm text-gray-400 py-4">No Stripe charges recorded yet.</p>
            ) : (
              <BarChart
                data={revenue.charged.byMonth.map(m => ({ label: fmtMonth(m.month), value: m.amountCents / 100 }))}
                color="bg-green-500"
                valueFormatter={v => `$${v.toFixed(0)}`}
              />
            )}
          </div>
        </div>

        {/* ── Job Volume & User Growth ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Translation Jobs · Last 6 Months</p>
              <span className="text-sm font-semibold text-gray-700">{jobs.total} total</span>
            </div>
            <BarChart
              data={jobs.jobsByMonth.map(m => ({ label: fmtMonth(m.month), value: m.count }))}
              color="bg-indigo-500"
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">New Users · Last 6 Months</p>
              <span className="text-sm font-semibold text-gray-700">{users.total} total</span>
            </div>
            <BarChart
              data={users.signupsByMonth.map(m => ({ label: fmtMonth(m.month), value: m.count }))}
              color="bg-violet-500"
            />
          </div>
        </div>

        {/* ── Feature Adoption ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Feature Adoption</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Translation Studio", value: features.translationJobs, icon: "🌐", href: "/translation-studio" },
              { label: "LQA Studio", value: features.lqaRuns, icon: "✅", href: "/lqa-studio" },
              { label: "Media Studio", value: features.mediaRuns, icon: "🎬", href: "/media-studio" },
              { label: "Active Integrations", value: features.integrations, icon: "🔌", href: "/integrations" },
            ].map(f => (
              <Link key={f.label} href={f.href} className="bg-gray-50 hover:bg-indigo-50 border border-gray-200 rounded-lg p-4 transition-colors group">
                <span className="text-2xl">{f.icon}</span>
                <p className="text-xl font-bold text-gray-800 mt-1 group-hover:text-indigo-700">{f.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{f.label}</p>
              </Link>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Avg jobs per user: <strong className="text-gray-600">{signals.avgJobsPerUser}</strong>
            &nbsp;·&nbsp;
            User breakdown: {Object.entries(users.byRole).map(([r, c]) => `${c} ${r}s`).join(" · ")}
          </p>
        </div>

        {/* ── Top Models, Languages, Formats ──────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Top AI Models */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Top AI Models</h2>
            <div className="space-y-3">
              {signals.topModels.length === 0
                ? <p className="text-xs text-gray-400">No jobs yet.</p>
                : signals.topModels.map(m => (
                  <HBar
                    key={m.model}
                    label={modelLabel(m.model)}
                    value={m.count}
                    max={topModelMax}
                    formatter={v => `${v} jobs`}
                  />
                ))}
            </div>
            <p className="text-xs text-gray-400 mt-4 leading-relaxed">
              Word volume by model: {signals.topModels.map(m => `${modelLabel(m.model)} ${fmtWords(m.totalWords)}`).join(" · ")}
            </p>
          </div>

          {/* Top Target Languages */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Top Target Languages</h2>
            <div className="space-y-3">
              {signals.topLanguages.length === 0
                ? <p className="text-xs text-gray-400">No completed tasks yet.</p>
                : signals.topLanguages.slice(0, 8).map(l => (
                  <HBar
                    key={l.language}
                    label={l.language}
                    value={l.count}
                    max={topLangMax}
                    formatter={v => `${v} tasks`}
                  />
                ))}
            </div>
          </div>

          {/* Top Source Formats */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Source File Formats</h2>
            <div className="space-y-3">
              {signals.topFormats.length === 0
                ? <p className="text-xs text-gray-400">No jobs yet.</p>
                : signals.topFormats.map(f => (
                  <HBar
                    key={f.format}
                    label={f.format.toUpperCase()}
                    value={f.count}
                    max={topFormatMax}
                    formatter={v => `${v} jobs`}
                  />
                ))}
            </div>
          </div>
        </div>

        {/* ── Roadmap Signals ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Roadmap Signals</h2>
          <p className="text-xs text-gray-400 mb-4">Derived from usage patterns — use to prioritise what to build next.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                signal: "Language demand",
                insight: signals.topLanguages.slice(0, 3).map(l => l.language).join(", ") || "No data yet",
                action: "Invest in quality benchmarks and glossary defaults for top languages",
                color: "border-indigo-200 bg-indigo-50",
                tag: "text-indigo-600",
              },
              {
                signal: "Model preference",
                insight: signals.topModels[0] ? `${modelLabel(signals.topModels[0].model)} leads with ${signals.topModels[0].count} jobs` : "No data yet",
                action: "Negotiate volume pricing with top provider; consider switching default model",
                color: "border-violet-200 bg-violet-50",
                tag: "text-violet-600",
              },
              {
                signal: "Conversion gap",
                insight: `${users.total - users.paying} free users not converting (${100 - freeToPayingRate}%)`,
                action: "Add usage-based nudges: show cost savings vs manual, prompt card on 2nd job",
                color: "border-amber-200 bg-amber-50",
                tag: "text-amber-700",
              },
              {
                signal: "Feature imbalance",
                insight: `LQA (${features.lqaRuns}) and Media (${features.mediaRuns}) far behind Translation (${features.translationJobs})`,
                action: "Run in-app tooltips pointing to LQA and Media Studio after first translation job",
                color: "border-green-200 bg-green-50",
                tag: "text-green-700",
              },
              {
                signal: "Format concentration",
                insight: signals.topFormats[0] ? `${signals.topFormats[0].format.toUpperCase()} is the #1 format (${signals.topFormats[0].count} jobs)` : "No data yet",
                action: "Build format-specific onboarding and template library for top file types",
                color: "border-sky-200 bg-sky-50",
                tag: "text-sky-700",
              },
              {
                signal: "Reliability",
                insight: `${jobs.failureRate}% task failure rate`,
                action: jobs.failureRate > 5
                  ? "Investigate failure root causes — add retry logic and clearer error messages"
                  : "Failure rate healthy — maintain monitoring",
                color: jobs.failureRate > 5 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50",
                tag: jobs.failureRate > 5 ? "text-red-700" : "text-green-700",
              },
            ].map((s, i) => (
              <div key={i} className={`rounded-lg border px-4 py-3 ${s.color}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${s.tag}`}>{s.signal}</p>
                <p className="text-sm font-medium text-gray-800 mb-0.5">{s.insight}</p>
                <p className="text-xs text-gray-500">{s.action}</p>
              </div>
            ))}
          </div>
        </div>

      </main>
    </AppShell>
  )
}
