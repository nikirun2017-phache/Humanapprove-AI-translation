"use client"

import { useEffect, useState, Suspense, useRef } from "react"
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
  grossRevenue: number
  discount: number
  platformRevenue: number
  cardStatus: string
  hasCard: boolean
}

interface AdminUsage {
  mode: "admin"
  totalApiCost: number
  totalRevenue: number
  grossRevenue: number
  totalDiscount: number
  grossMarginPct: number
  totalJobs: number
  activeCustomers: number
  markup: number
  users: AdminUser[]
}

interface DownloadableTask {
  id: string
  targetLanguage: string
}

interface JobEntry {
  id: string
  name: string
  createdAt: string
  model: string
  sourceLanguage: string
  sourceFormat: string
  languages: string[]
  languageCount: number
  totalWords: number
  apiCost: number
  platformFee: number
  totalCharge: number
  status: "completed" | "in_progress"
  downloadableTasks: DownloadableTask[]
}

interface JobsData {
  jobs: JobEntry[]
  monthTotal: number
  month: string
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

function shortModel(model: string) {
  // e.g. "claude-sonnet-4-6" → "Claude Sonnet 4.6"
  return model.replace(/^claude-/, "Claude ").replace(/-(\d)/g, " $1").replace(/-/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
}

// ── PDF Invoice Generator ──────────────────────────────────────────────────────

function generateInvoiceHtml(
  jobs: JobEntry[],
  monthTotal: number,
  monthLabel: string,
  userName: string,
  userEmail: string
): string {
  const now = new Date()
  const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`
  const rows = jobs.map(j => `
    <tr>
      <td>${j.name.replace(/</g, "&lt;")}</td>
      <td>${new Date(j.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
      <td>${j.languageCount} lang${j.languageCount !== 1 ? "s" : ""}</td>
      <td>${j.totalWords.toLocaleString()} words</td>
      <td class="num total">$${j.totalCharge.toFixed(2)}</td>
    </tr>`).join("")

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Invoice ${invoiceNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, Arial, sans-serif; color: #1a1a1a; padding: 48px; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
  .brand { font-size: 22px; font-weight: 700; color: #4f46e5; }
  .brand-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .invoice-meta { text-align: right; }
  .invoice-meta h2 { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 6px; }
  .invoice-meta p { color: #6b7280; font-size: 12px; line-height: 1.6; }
  .bill-section { display: flex; justify-content: space-between; margin-bottom: 32px; background: #f9fafb; border-radius: 8px; padding: 20px 24px; }
  .bill-to h3 { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .bill-to p { line-height: 1.6; }
  .period h3 { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; text-align: right; }
  .period p { text-align: right; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead tr { background: #4f46e5; color: white; }
  thead th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  thead th.num { text-align: right; }
  tbody tr { border-bottom: 1px solid #f3f4f6; }
  tbody tr:nth-child(even) { background: #fafafa; }
  td { padding: 9px 12px; vertical-align: top; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.total { font-weight: 600; }
  .totals { display: flex; justify-content: flex-end; margin-bottom: 40px; }
  .totals-box { min-width: 280px; }
  .totals-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
  .totals-row.grand { border-top: 2px solid #4f46e5; border-bottom: none; padding-top: 12px; margin-top: 4px; font-size: 16px; font-weight: 700; color: #4f46e5; }
  .footnote { border-top: 1px solid #e5e7eb; padding-top: 20px; color: #9ca3af; font-size: 11px; line-height: 1.7; }
  @media print { body { padding: 24px; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">Jendee AI</div>
      <div class="brand-sub">AI Translation Platform</div>
    </div>
    <div class="invoice-meta">
      <h2>Invoice</h2>
      <p>${invoiceNumber}<br/>Issue date: ${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
    </div>
  </div>

  <div class="bill-section">
    <div class="bill-to">
      <h3>Bill to</h3>
      <p><strong>${userName.replace(/</g, "&lt;")}</strong><br/>${userEmail.replace(/</g, "&lt;")}</p>
    </div>
    <div class="period">
      <h3>Billing period</h3>
      <p>${monthLabel}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Job name</th>
        <th>Date</th>
        <th>Languages</th>
        <th>Words</th>
        <th class="num">Charge</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:24px">No completed jobs this month</td></tr>'}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-box">
      <div class="totals-row"><span>Subtotal</span><span>${usd(monthTotal)}</span></div>
      <div class="totals-row"><span>Tax</span><span>$0.00</span></div>
      <div class="totals-row grand"><span>Total due</span><span>${usd(monthTotal)}</span></div>
    </div>
  </div>

  <div class="footnote">
    <p>All charges reflect professional AI-powered translation services, including quality assurance and platform support. Final amounts may vary slightly based on content volume and complexity.</p>
    <p>Questions about your invoice? We're here to help — contact support@jendeeai.com</p>
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`
}

// ── Download dropdown ─────────────────────────────────────────────────────────

function DownloadDropdown({ job }: { job: JobEntry }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])

  const isSingleLang = job.downloadableTasks.length === 1

  // For a single language, download directly; for multiple, show a dropdown
  function downloadUrl(task: DownloadableTask) {
    return `/api/translation-studio/jobs/${job.id}/tasks/${task.id}/download`
  }

  if (isSingleLang) {
    return (
      <a
        href={downloadUrl(job.downloadableTasks[0])}
        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors"
        title="Download translated file"
      >
        ↓ Download
      </a>
    )
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors"
      >
        ↓ Files ▾
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {job.downloadableTasks.map(task => (
            <a
              key={task.id}
              href={downloadUrl(task)}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            >
              <span className="text-indigo-400">↓</span>
              <span>{task.targetLanguage}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

function BillingPageInner() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [jobs, setJobs] = useState<JobsData | null>(null)
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

  useEffect(() => {
    if (role !== "admin") {
      fetch("/api/billing/jobs")
        .then(r => r.json())
        .then((d: JobsData) => setJobs(d))
        .catch(() => {})
    }
  }, [role])

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

  function downloadInvoice() {
    if (!jobs || !session?.user) return
    const monthDate = new Date(jobs.month)
    const monthLabel = monthDate.toLocaleString("en-US", { month: "long", year: "numeric" })
    const html = generateInvoiceHtml(
      jobs.jobs,
      jobs.monthTotal,
      monthLabel,
      session.user.name ?? "Customer",
      session.user.email ?? ""
    )
    const win = window.open("", "_blank")
    if (win) {
      win.document.write(html)
      win.document.close()
    }
  }

  const monthLabel = new Date().toLocaleString("en-US", { month: "long" })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {role === "admin" ? "Revenue & Billing" : "Billing"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {role === "admin"
                ? `Platform-wide AI spend vs revenue at ${5}× markup + $0.007/word platform fee.`
                : "Pay as you go. No monthly subscription."}
            </p>
          </div>
          {role !== "admin" && (
            <button
              onClick={downloadInvoice}
              disabled={!jobs}
              className="flex items-center gap-2 border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              <span>↓</span> Download invoice PDF
            </button>
          )}
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
            jobs={jobs}
            monthLabel={monthLabel}
            onAddCard={addCard}
            onManageCard={openPortal}
            setupLoading={setupLoading}
            portalLoading={portalLoading}
            onDownloadInvoice={downloadInvoice}
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
          label: "Net revenue",
          value: usd(usage.totalRevenue),
          sub: usage.totalDiscount > 0 ? `${usd(usage.grossRevenue)} gross − ${usd(usage.totalDiscount)} discounts` : `${usage.markup}× markup on AI cost`,
          color: "text-green-700",
          dot: "bg-green-400",
          bg: "bg-green-50",
        },
        {
          label: "Promo discounts",
          value: usd(usage.totalDiscount),
          sub: usage.totalDiscount > 0 ? `${usd(usage.grossRevenue)} gross revenue` : "No promos applied",
          color: usage.totalDiscount > 0 ? "text-amber-700" : "text-gray-400",
          dot: usage.totalDiscount > 0 ? "bg-amber-400" : "bg-gray-200",
          bg: usage.totalDiscount > 0 ? "bg-amber-50" : "bg-gray-50",
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {kpis.length > 0
          ? kpis.map((k: (typeof kpis)[number]) => (
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
          Revenue = API cost × {usage?.markup ?? 5}. Gross margin is{" "}
          <strong>{usage ? `${usage.grossMarginPct}%` : "…"}</strong> because you absorb the raw API spend.
          Each requester is charged their monthly accumulated AI cost times the markup, invoiced via Stripe.
        </span>
      </div>

      {/* Per-user table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">{monthLabel} — per customer</p>
          <p className="text-xs text-gray-400">API cost → {usage?.markup ?? 5}× + platform fee</p>
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
                <th className="px-4 py-3 text-right">Gross ({usage.markup}×)</th>
                <th className="px-4 py-3 text-right">Discount</th>
                <th className="px-4 py-3 text-right">Net revenue</th>
                <th className="px-4 py-3 text-center">Card</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {usage.users.map((u: AdminUser) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{u.jobsThisMonth}</td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {u.apiCost > 0 ? usd(u.apiCost, 4) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {u.grossRevenue > 0 ? usd(u.grossRevenue) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-600">
                    {u.discount > 0 ? `−${usd(u.discount)}` : <span className="text-gray-300">—</span>}
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
                <td className="px-4 py-3 text-right text-xs font-semibold text-gray-600">{usd(usage.grossRevenue)}</td>
                <td className="px-4 py-3 text-right text-xs font-semibold text-amber-600">
                  {usage.totalDiscount > 0 ? `−${usd(usage.totalDiscount)}` : <span className="text-gray-300">—</span>}
                </td>
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
  jobs,
  monthLabel,
  onAddCard,
  onManageCard,
  setupLoading,
  portalLoading,
  onDownloadInvoice,
}: {
  usage: RequesterUsage | null
  jobs: JobsData | null
  monthLabel: string
  onAddCard: () => void
  onManageCard: () => void
  setupLoading: boolean
  portalLoading: boolean
  onDownloadInvoice: () => void
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
                ? "You're charged per job when it completes."
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

      {/* Usage stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                <p className="text-xs text-gray-400 mt-0.5">task runs</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{usage.totalProjects}</p>
                <p className="text-xs text-gray-400 mt-0.5">total projects</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i: number) => (
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
            {monthLabel} total charge
          </p>
          {jobs ? (
            <>
              <p className="text-3xl font-bold text-indigo-600 mb-1">{usd(jobs.monthTotal)}</p>
              <p className="text-xs text-gray-400">
                {jobs.jobs.length} job{jobs.jobs.length !== 1 ? "s" : ""} this month
              </p>
              <button
                onClick={onDownloadInvoice}
                className="mt-3 text-xs text-indigo-600 hover:text-indigo-800 font-medium underline underline-offset-2"
              >
                Download PDF invoice →
              </button>
            </>
          ) : (
            <div className="animate-pulse space-y-2">
              <div className="h-9 w-28 bg-gray-100 rounded" />
              <div className="h-3 w-36 bg-gray-100 rounded" />
            </div>
          )}
        </div>
      </div>

      {/* Per-job breakdown table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">{monthLabel} — job breakdown</p>
          <p className="text-xs text-gray-400">Per-job charges for this month</p>
        </div>

        {!jobs ? (
          <div className="p-6 space-y-3">
            {[0, 1, 2].map(i => <div key={i} className="animate-pulse h-10 bg-gray-50 rounded" />)}
          </div>
        ) : jobs.jobs.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">No completed jobs this month.</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium text-gray-500">
                  <th className="px-5 py-3">Job name</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Languages</th>
                  <th className="px-4 py-3 text-right">Words</th>
                  <th className="px-4 py-3 text-right">Charge</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Files</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {jobs.jobs.map((job: JobEntry) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900 truncate max-w-[180px]" title={job.name}>{job.name}</p>
                      <p className="text-xs text-gray-400">{shortModel(job.model)}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(job.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[140px]">
                        {job.languages.slice(0, 3).map((l: string) => (
                          <span key={l} className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">{l}</span>
                        ))}
                        {job.languages.length > 3 && (
                          <span className="text-xs text-gray-400">+{job.languages.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 tabular-nums">
                      {job.totalWords > 0 ? job.totalWords.toLocaleString() : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-indigo-700 tabular-nums">
                      {usd(job.totalCharge)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        job.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      )}>
                        {job.status === "completed" ? "done" : "running"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {job.downloadableTasks.length > 0
                        ? <DownloadDropdown job={job} />
                        : <span className="text-xs text-gray-300">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50">
                  <td colSpan={4} className="px-5 py-3 text-xs font-semibold text-gray-600 text-right">Month total</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-indigo-700">{usd(jobs.monthTotal)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </>
        )}
      </div>

      <p className="text-xs text-gray-400 px-1">
        AI cost is estimated from word count and model pricing. Actual charges may differ slightly.
        Invoices are issued monthly and charged to your card on file.
      </p>
    </>
  )
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingPageInner />
    </Suspense>
  )
}
