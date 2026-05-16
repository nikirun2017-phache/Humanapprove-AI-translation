"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { PLANS, formatWords, wordsRemaining } from "@/lib/plans"
import type { PlanId } from "@/lib/plans"

// ── Types ─────────────────────────────────────────────────────────────────────

interface UsageData {
  mode: string
  jobsThisMonth: number
  languagesThisMonth: number
  estimatedCharge: number
  estimatedApiCost: number
}

interface JobEntry {
  id: string
  name: string
  createdAt: string
  sourceFormat: string
  languages: string[]
  totalWords: number
  totalCharge: number
  status: string
}

interface JobsData {
  jobs: JobEntry[]
  monthTotal: number
  month: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function usd(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatExt(fmt: string): string {
  const map: Record<string, string> = {
    json: "JSON", csv: "CSV", md: "MD", txt: "TXT", pdf: "PDF",
    xliff: "XLIFF", strings: ".strings", stringsdict: ".stringsdict",
    xcstrings: ".xcstrings", po: ".po", xml: "Android XML",
    arb: ".arb", properties: ".properties",
  }
  return map[fmt] ?? fmt.toUpperCase()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── Skeleton loaders ──────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
      <div className="h-3 w-20 bg-gray-100 rounded mb-3" />
      <div className="h-7 w-24 bg-gray-100 rounded mb-2" />
      <div className="h-3 w-16 bg-gray-100 rounded" />
    </div>
  )
}

// ── Plan + Quota Card ─────────────────────────────────────────────────────────

function PlanQuotaCard({ planId, wordsUsed }: { planId: PlanId; wordsUsed: number }) {
  const plan = PLANS[planId] ?? PLANS.free
  const quota = plan.wordsPerMonth
  const isPayg = !isFinite(quota)
  const pct = isPayg ? 0 : Math.min(100, Math.round((wordsUsed / quota) * 100))
  const remaining = isPayg ? Infinity : wordsRemaining(quota, wordsUsed)
  const showUpgrade = planId === "free" || planId === "starter"

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">{plan.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">Current plan</p>
          </div>
          <span className="text-xs bg-indigo-50 text-indigo-700 font-medium px-2 py-0.5 rounded-full border border-indigo-100">
            {plan.name}
          </span>
        </div>
        {showUpgrade && (
          <Link
            href="/pricing"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100"
          >
            Upgrade plan →
          </Link>
        )}
      </div>

      {isPayg ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700 font-medium">Pay-as-you-go — no word limit</span>
          <span className="text-xs text-gray-400">({wordsUsed.toLocaleString()} words used this month)</span>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-700">
              <span className="font-semibold text-gray-900">{wordsUsed.toLocaleString()}</span>
              {" / "}
              <span>{formatWords(quota)}</span>
              {" words used"}
            </span>
            <span className="text-xs text-gray-500">{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-indigo-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {remaining.toLocaleString()} words remaining this month
          </p>
        </>
      )}
    </div>
  )
}

// ── Savings Card ──────────────────────────────────────────────────────────────

function SavingsCard({ totalWords, aiCost }: { totalWords: number; aiCost: number }) {
  const HUMAN_RATE = 0.12 // $0.12 per word
  const humanCost = totalWords * HUMAN_RATE
  const savings = Math.max(0, humanCost - aiCost)
  const savingsPct = humanCost > 0 ? Math.round((savings / humanCost) * 100) : 0

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 rounded-xl p-5 mb-6">
      <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-4">vs Human Translation</p>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Human rate</p>
          <p className="text-lg font-bold text-gray-900">$0.12<span className="text-xs font-normal text-gray-400"> /word</span></p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">AI cost</p>
          <p className="text-lg font-bold text-indigo-700">{usd(aiCost)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">You saved</p>
          <p className="text-lg font-bold text-green-700">{usd(savings)}</p>
        </div>
      </div>
      {savingsPct > 0 && totalWords > 0 && (
        <div className="mt-4 pt-4 border-t border-indigo-200">
          <p className="text-sm font-semibold text-indigo-800">
            {savingsPct}% cheaper than human translation
          </p>
          <p className="text-xs text-indigo-600 mt-0.5">
            {totalWords.toLocaleString()} words translated — human equivalent would be {usd(humanCost)}
          </p>
        </div>
      )}
      {totalWords === 0 && (
        <p className="text-xs text-indigo-600 mt-3">Translate your first job this month to see savings.</p>
      )}
    </div>
  )
}

// ── Top Languages Chart ───────────────────────────────────────────────────────

function TopLanguagesChart({ jobs }: { jobs: JobEntry[] }) {
  const counts: Record<string, number> = {}
  for (const job of jobs) {
    for (const lang of job.languages) {
      counts[lang] = (counts[lang] ?? 0) + 1
    }
  }

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  const max = sorted[0]?.[1] ?? 1

  if (sorted.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <p className="text-sm font-semibold text-gray-900 mb-4">Top Languages</p>
        <p className="text-sm text-gray-400 text-center py-6">No language data yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <p className="text-sm font-semibold text-gray-900 mb-4">Top Languages</p>
      <div className="space-y-2.5">
        {sorted.map(([lang, count]) => (
          <div key={lang} className="flex items-center gap-3">
            <span className="text-xs font-mono text-gray-600 w-12 shrink-0">{lang}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-indigo-500 transition-all"
                style={{ width: `${Math.round((count / max) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 w-8 text-right shrink-0">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Jobs Table ────────────────────────────────────────────────────────────────

type SortDir = "asc" | "desc"

function JobsTable({ jobs }: { jobs: JobEntry[] }) {
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const sorted = [...jobs]
    .sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return sortDir === "desc" ? -diff : diff
    })
    .slice(0, 10)

  function toggleSort() {
    setSortDir(d => (d === "desc" ? "asc" : "desc"))
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Recent Jobs</p>
        <p className="text-xs text-gray-400">Last 10 jobs this month</p>
      </div>
      {jobs.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-gray-400">No jobs this month.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium text-gray-500">
              <th className="px-5 py-3">Job name</th>
              <th className="px-4 py-3">Format</th>
              <th className="px-4 py-3">Languages</th>
              <th className="px-4 py-3 text-right">Words</th>
              <th className="px-4 py-3 text-right">
                <button
                  onClick={toggleSort}
                  className="flex items-center gap-1 ml-auto hover:text-gray-700 transition-colors"
                >
                  Date
                  <span className="text-gray-300">{sortDir === "desc" ? "↓" : "↑"}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((job) => (
              <tr key={job.id} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-900 truncate max-w-[200px]" title={job.name}>
                    {job.name}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">
                    {formatExt(job.sourceFormat)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1 max-w-[160px]">
                    {job.languages.slice(0, 4).map((l) => (
                      <span key={l} className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
                        {l}
                      </span>
                    ))}
                    {job.languages.length > 4 && (
                      <span className="text-xs text-gray-400">+{job.languages.length - 4}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                  {job.totalWords > 0 ? job.totalWords.toLocaleString() : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-right text-gray-500 text-xs whitespace-nowrap">
                  {formatDate(job.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { data: session } = useSession()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [jobsData, setJobsData] = useState<JobsData | null>(null)
  const [loading, setLoading] = useState(true)

  const planId = ((session?.user as { plan?: string })?.plan ?? "free") as PlanId
  const wordsUsedFromJobs = jobsData?.jobs.reduce((sum, j) => sum + j.totalWords, 0) ?? 0
  const uniqueLangs = jobsData
    ? new Set(jobsData.jobs.flatMap((j) => j.languages)).size
    : 0
  const totalWords = wordsUsedFromJobs

  const monthLabel = new Date().toLocaleString("en-US", { month: "long", year: "numeric" })

  useEffect(() => {
    Promise.all([
      fetch("/api/billing/usage").then((r) => r.json()),
      fetch("/api/billing/jobs").then((r) => r.json()),
    ])
      .then(([u, j]: [UsageData, JobsData]) => {
        setUsage(u)
        setJobsData(j)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const statCards = [
    {
      label: "Jobs this month",
      value: usage ? String(usage.jobsThisMonth) : "—",
      sub: monthLabel,
    },
    {
      label: "Languages translated",
      value: uniqueLangs > 0 ? String(uniqueLangs) : usage ? String(usage.languagesThisMonth) : "—",
      sub: "Unique target languages",
    },
    {
      label: "Words translated",
      value: totalWords > 0 ? totalWords.toLocaleString() : "—",
      sub: "Source words this month",
    },
    {
      label: "Estimated cost",
      value: usage ? usd(usage.estimatedCharge) : "—",
      sub: "AI + platform fees",
    },
  ]

  return (
    <AppShell>
      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Usage &amp; Analytics</h1>
            <p className="text-sm text-gray-500 mt-1">{monthLabel}</p>
          </div>
          <button
            className="flex items-center gap-2 border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download report
          </button>
        </div>

        {/* Plan + Quota */}
        {session ? (
          <PlanQuotaCard planId={planId} wordsUsed={totalWords} />
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 animate-pulse">
            <div className="h-4 w-32 bg-gray-100 rounded mb-4" />
            <div className="h-2 w-full bg-gray-100 rounded" />
          </div>
        )}

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
            : statCards.map((c) => (
                <StatCard key={c.label} label={c.label} value={c.value} sub={c.sub} />
              ))}
        </div>

        {/* Savings Card */}
        {loading ? (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 mb-6 animate-pulse">
            <div className="h-3 w-32 bg-indigo-100 rounded mb-4" />
            <div className="grid grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <div className="h-3 w-16 bg-indigo-100 rounded mb-2" />
                  <div className="h-6 w-20 bg-indigo-100 rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <SavingsCard
            totalWords={totalWords}
            aiCost={usage?.estimatedCharge ?? 0}
          />
        )}

        {/* Bottom two-column layout: chart + table */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
              <div className="h-4 w-28 bg-gray-100 rounded mb-5" />
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 mb-3">
                  <div className="h-3 w-10 bg-gray-100 rounded" />
                  <div className="flex-1 h-2 bg-gray-100 rounded-full" />
                  <div className="h-3 w-6 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
              <div className="h-4 w-28 bg-gray-100 rounded mb-5" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-50 rounded mb-2" />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopLanguagesChart jobs={jobsData?.jobs ?? []} />
            <JobsTable jobs={jobsData?.jobs ?? []} />
          </div>
        )}

      </main>
    </AppShell>
  )
}
