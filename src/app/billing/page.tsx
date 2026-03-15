"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface RequesterUsage {
  mode: "requester"
  jobsThisMonth: number
  jobsLastMonth: number
  languagesThisMonth: number
  estimatedApiCost: number
  estimatedCharge: number
  projectsThisMonth: number
  totalProjects: number
  markup: number
  cardStatus: "none" | "active" | "past_due"
  cardLast4: string | null
  cardBrand: string | null
}

interface AdminUser {
  id: string
  name: string
  email: string
  jobsThisMonth: number
  apiCost: number
  platformRevenue: number
  cardStatus: string
  hasCard: boolean
}

interface AdminUsage {
  mode: "admin"
  totalApiCost: number
  totalRevenue: number
  grossMarginPct: number
  totalJobs: number
  activeCustomers: number
  markup: number
  users: AdminUser[]
}

type UsageData = RequesterUsage | AdminUsage

// ── Helpers ───────────────────────────────────────────────────────────────────

function usd(n: number, decimals = 2) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

function cardLabel(brand: string | null, last4: string | null): string {
  if (!last4) return "Card on file"
  const b = brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : "Card"
  return `${b} ···· ${last4}`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [setupLoading, setSetupLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState("")

  const role = (session?.user as { role?: string })?.role ?? "requester"

  const cardAdded = searchParams.get("card_added") === "true"
  const cardCanceled = searchParams.get("card_canceled") === "true"

  useEffect(() => {
    fetch("/api/billing/usage")
      .then((r) => r.json())
      .then((d: UsageData) => setUsage(d))
      .catch(() => {})
  }, [])

  async function addCard() {
    setError("")
    setSetupLoading(true)
    try {
      const res = await fetch("/api/billing/setup-payment", { method: "POST" })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed to start card setup")
      window.location.href = data.url
    } catch (err) {
      setError((err as Error).message)
      setSetupLoading(false)
    }
  }

  async function openPortal() {
    setError("")
    setPortalLoading(true)
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed to open billing portal")
      window.location.href = data.url
    } catch (err) {
      setError((err as Error).message)
      setPortalLoading(false)
    }
  }

  const monthLabel = new Date().toLocaleString("en-US", { month: "long" })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {role === "admin" ? "Revenue & Billing" : "Billing"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {role === "admin"
              ? "Platform-wide AI spend vs revenue at 30× markup."
              : "Pay as you go — you are billed 30× the AI translation cost. No monthly subscription."}
          </p>
        </div>

        {/* Banners */}
        {cardAdded && (
          <div className="mb-6 flex gap-2 bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm">
            <span>✓</span>
            <span>Payment method added. You can now run AI translations.</span>
          </div>
        )}
        {cardCanceled && (
          <div className="mb-6 flex gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
            <span>ℹ</span>
            <span>Card setup was canceled. No payment method was saved.</span>
          </div>
        )}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* ── ADMIN VIEW ───────────────────────────────────────────────────────── */}
        {role === "admin" && (
          <AdminView usage={usage as AdminUsage | null} monthLabel={monthLabel} />
        )}

        {/* ── REQUESTER / REVIEWER VIEW ────────────────────────────────────────── */}
        {role !== "admin" && (
          <RequesterView
            usage={usage as RequesterUsage | null}
            monthLabel={monthLabel}
            onAddCard={addCard}
            onManageCard={openPortal}
            setupLoading={setupLoading}
            portalLoading={portalLoading}
          />
        )}

      </main>
    </div>
  )
}

// ── Admin sub-view ────────────────────────────────────────────────────────────

function AdminView({ usage, monthLabel }: { usage: AdminUsage | null; monthLabel: string }) {
  const kpis = usage
    ? [
        {
          label: "API spend",
          value: usd(usage.totalApiCost),
          sub: `${monthLabel} — your cost`,
          color: "text-red-600",
          dot: "bg-red-400",
          bg: "bg-red-50",
        },
        {
          label: "Platform revenue",
          value: usd(usage.totalRevenue),
          sub: `${usage.markup}× markup on AI cost`,
          color: "text-green-700",
          dot: "bg-green-400",
          bg: "bg-green-50",
        },
        {
          label: "Gross margin",
          value: `${usage.grossMarginPct}%`,
          sub: `${usd(usage.totalRevenue - usage.totalApiCost)} net`,
          color: "text-indigo-700",
          dot: "bg-indigo-400",
          bg: "bg-indigo-50",
        },
        {
          label: "Active customers",
          value: String(usage.activeCustomers),
          sub: `${usage.totalJobs} AI jobs run`,
          color: "text-gray-900",
          dot: "bg-gray-400",
          bg: "bg-gray-50",
        },
      ]
    : []

  return (
    <>
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.length > 0
          ? kpis.map((k) => (
              <div key={k.label} className={cn("rounded-xl border border-gray-200 p-5", k.bg)}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={cn("w-2 h-2 rounded-full", k.dot)} />
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{k.label}</p>
                </div>
                <p className={cn("text-2xl font-bold mb-1", k.color)}>{k.value}</p>
                <p className="text-xs text-gray-400">{k.sub}</p>
              </div>
            ))
          : Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-200 p-5 bg-white animate-pulse">
                <div className="h-3 w-20 bg-gray-100 rounded mb-4" />
                <div className="h-7 w-24 bg-gray-100 rounded mb-2" />
                <div className="h-3 w-16 bg-gray-100 rounded" />
              </div>
            ))}
      </div>

      {/* Markup explanation */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 text-sm text-gray-600 flex gap-3 items-start">
        <span className="text-indigo-500 text-base shrink-0">ℹ</span>
        <span>
          Revenue = API cost × {usage?.markup ?? 30}. Gross margin is{" "}
          <strong>{usage ? `${usage.grossMarginPct}%` : "…"}</strong> because you absorb the raw API spend.
          Each requester is charged their monthly accumulated AI cost times the markup, invoiced via Stripe.
        </span>
      </div>

      {/* Per-user table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">{monthLabel} — per customer</p>
          <p className="text-xs text-gray-400">API cost → 30× revenue</p>
        </div>
        {!usage ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse h-8 bg-gray-50 rounded" />
            ))}
          </div>
        ) : usage.users.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">No requester accounts yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium text-gray-500">
                <th className="px-5 py-3">Customer</th>
                <th className="px-4 py-3 text-right">Jobs</th>
                <th className="px-4 py-3 text-right">API cost</th>
                <th className="px-4 py-3 text-right">Revenue (30×)</th>
                <th className="px-4 py-3 text-center">Card</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {usage.users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{u.jobsThisMonth}</td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {u.apiCost > 0 ? usd(u.apiCost, 4) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">
                    {u.platformRevenue > 0 ? usd(u.platformRevenue) : <span className="text-gray-300 font-normal">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        u.hasCard
                          ? "bg-green-100 text-green-700"
                          : u.cardStatus === "past_due"
                          ? "bg-red-100 text-red-600"
                          : "bg-gray-100 text-gray-500"
                      )}
                    >
                      {u.hasCard ? "on file" : u.cardStatus === "past_due" ? "past due" : "none"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td className="px-5 py-3 text-xs font-semibold text-gray-600">Total</td>
                <td className="px-4 py-3 text-right text-xs font-semibold text-gray-600">{usage.totalJobs}</td>
                <td className="px-4 py-3 text-right text-xs font-semibold text-gray-600">{usd(usage.totalApiCost, 4)}</td>
                <td className="px-4 py-3 text-right text-xs font-bold text-green-700">{usd(usage.totalRevenue)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </>
  )
}

// ── Requester sub-view ────────────────────────────────────────────────────────

function RequesterView({
  usage,
  monthLabel,
  onAddCard,
  onManageCard,
  setupLoading,
  portalLoading,
}: {
  usage: RequesterUsage | null
  monthLabel: string
  onAddCard: () => void
  onManageCard: () => void
  setupLoading: boolean
  portalLoading: boolean
}) {
  const hasCard = usage?.cardStatus === "active"
  const isPastDue = usage?.cardStatus === "past_due"
  const jobDelta = usage ? usage.jobsThisMonth - usage.jobsLastMonth : 0

  return (
    <>
      {/* Payment method card */}
      <div
        className={cn(
          "rounded-xl border p-5 mb-6 flex items-center justify-between gap-4",
          hasCard
            ? "bg-white border-gray-200"
            : isPastDue
            ? "bg-red-50 border-red-200"
            : "bg-amber-50 border-amber-200"
        )}
      >
        <div className="flex items-center gap-3">
          <span className={cn("text-2xl", hasCard ? "" : "opacity-60")}>
            {hasCard ? "💳" : "⚠️"}
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {hasCard
                ? cardLabel(usage?.cardBrand ?? null, usage?.cardLast4 ?? null)
                : isPastDue
                ? "Payment failed — update your card"
                : "No payment method on file"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {hasCard
                ? "You will be invoiced monthly for your AI translation usage."
                : "Add a card to enable AI translations."}
            </p>
          </div>
        </div>
        <div className="shrink-0 flex gap-2">
          {hasCard ? (
            <button
              onClick={onManageCard}
              disabled={portalLoading}
              className="text-sm border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 disabled:opacity-50 text-gray-700"
            >
              {portalLoading ? "Opening…" : "Manage card →"}
            </button>
          ) : (
            <button
              onClick={onAddCard}
              disabled={setupLoading}
              className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 font-medium disabled:opacity-50"
            >
              {setupLoading ? "Redirecting…" : "Add card →"}
            </button>
          )}
        </div>
      </div>

      {/* Usage + charge this month */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Usage stats */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">{monthLabel} usage</p>
          {usage ? (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-2xl font-bold text-gray-900">{usage.jobsThisMonth}</p>
                <p className="text-xs text-gray-400 mt-0.5">AI jobs</p>
                {jobDelta !== 0 && (
                  <p className={cn("text-xs mt-0.5", jobDelta > 0 ? "text-red-500" : "text-green-600")}>
                    {jobDelta > 0 ? "+" : ""}{jobDelta} vs last month
                  </p>
                )}
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{usage.languagesThisMonth}</p>
                <p className="text-xs text-gray-400 mt-0.5">languages</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{usage.totalProjects}</p>
                <p className="text-xs text-gray-400 mt-0.5">total projects</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-7 w-12 bg-gray-100 rounded mb-1" />
                  <div className="h-3 w-16 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Projected charge */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">
            {monthLabel} projected charge
          </p>
          {usage ? (
            <>
              <div className="flex items-end gap-4 mb-3">
                <div>
                  <p className="text-3xl font-bold text-indigo-600">{usd(usage.estimatedCharge)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">your invoice estimate</p>
                </div>
                <div className="text-right pb-1">
                  <p className="text-sm font-medium text-gray-500">{usd(usage.estimatedApiCost, 4)}</p>
                  <p className="text-xs text-gray-400">AI API cost</p>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-3 flex items-center justify-between text-xs text-gray-400">
                <span>
                  Formula: API cost × {usage.markup} = your charge
                </span>
              </div>
            </>
          ) : (
            <div className="animate-pulse space-y-2">
              <div className="h-9 w-28 bg-gray-100 rounded" />
              <div className="h-3 w-36 bg-gray-100 rounded" />
            </div>
          )}
        </div>
      </div>

      {/* Activity overview */}
      {usage && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">Activity overview</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-indigo-600">{usage.totalProjects}</p>
              <p className="text-xs text-gray-500 mt-1">Total projects</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-indigo-600">{usage.projectsThisMonth}</p>
              <p className="text-xs text-gray-500 mt-1">New this month</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-indigo-600">{usage.jobsThisMonth}</p>
              <p className="text-xs text-gray-500 mt-1">AI jobs run</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-indigo-600">{usd(usage.estimatedCharge)}</p>
              <p className="text-xs text-gray-500 mt-1">Est. this month</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4 border-t border-gray-100 pt-3">
            AI cost is estimated from job unit counts and model pricing. Actual charges may differ slightly.
            Invoices are issued monthly and charged to your card on file.
          </p>
        </div>
      )}
    </>
  )
}
