"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { useSession } from "next-auth/react"
import { PLANS } from "@/lib/stripe"
import type { PlanId } from "@/lib/stripe"
import { cn } from "@/lib/utils"

const PLAN_LIST = Object.values(PLANS)

interface UsageStats {
  jobsThisMonth: number
  jobsLastMonth: number
  languagesThisMonth: number
  estimatedCostThisMonth: number
  projectsThisMonth: number
  totalProjects: number
}

export default function BillingPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState<PlanId | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState("")
  const [usage, setUsage] = useState<UsageStats | null>(null)

  const success = searchParams.get("success") === "true"
  const canceled = searchParams.get("canceled") === "true"
  const successPlan = searchParams.get("plan") as PlanId | null

  const currentPlan = (session?.user as { plan?: string })?.plan ?? "free"
  const subscriptionStatus = (session?.user as { subscriptionStatus?: string })?.subscriptionStatus ?? "none"

  useEffect(() => {
    fetch("/api/billing/usage")
      .then((r) => r.json())
      .then((d: UsageStats) => setUsage(d))
      .catch(() => {})
  }, [])

  async function subscribe(planId: PlanId) {
    setError("")
    setLoading(planId)
    try {
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed to create checkout session")
      window.location.href = data.url
    } catch (err) {
      setError((err as Error).message)
      setLoading(null)
    }
  }

  async function openPortal() {
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

  const statusLabel: Record<string, string> = {
    active: "Active",
    trialing: "Trial",
    past_due: "Past due",
    canceled: "Canceled",
    none: "—",
  }

  const monthLabel = new Date().toLocaleString("en-US", { month: "long" })
  const jobDelta = usage ? usage.jobsThisMonth - usage.jobsLastMonth : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-10">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Billing & Plans</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your subscription, monitor usage, and update payment details.
          </p>
        </div>

        {/* Banners */}
        {success && (
          <div className="mb-6 flex gap-2 bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm">
            <span>✓</span>
            <span>
              Payment successful! You are now on the <strong className="capitalize">{successPlan ?? "Pro"}</strong> plan.
              It may take a few seconds for your plan to reflect in the UI.
            </span>
          </div>
        )}
        {canceled && (
          <div className="mb-6 flex gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
            <span>ℹ</span>
            <span>Checkout was canceled. Your plan was not changed.</span>
          </div>
        )}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Current plan + usage side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Plan card */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Current plan</p>
              <p className="text-lg font-semibold text-gray-900 capitalize">{currentPlan}</p>
              {subscriptionStatus !== "none" && (
                <p className={cn(
                  "text-xs mt-0.5",
                  subscriptionStatus === "active" || subscriptionStatus === "trialing" ? "text-green-600" :
                  subscriptionStatus === "past_due" ? "text-red-500" : "text-gray-400"
                )}>
                  {statusLabel[subscriptionStatus] ?? subscriptionStatus}
                </p>
              )}
            </div>
            {currentPlan !== "free" && (
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="text-sm border border-gray-300 rounded-lg px-4 py-2 hover:bg-gray-50 disabled:opacity-50 text-gray-700"
              >
                {portalLoading ? "Opening…" : "Manage billing →"}
              </button>
            )}
          </div>

          {/* Usage this month */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">{monthLabel} usage</p>
            {usage ? (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{usage.jobsThisMonth}</p>
                  <p className="text-xs text-gray-400 mt-0.5">AI jobs</p>
                  {jobDelta !== 0 && (
                    <p className={`text-xs mt-0.5 ${jobDelta > 0 ? "text-red-500" : "text-green-600"}`}>
                      {jobDelta > 0 ? "+" : ""}{jobDelta} vs last month
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{usage.languagesThisMonth}</p>
                  <p className="text-xs text-gray-400 mt-0.5">languages translated</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    ${usage.estimatedCostThisMonth.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">est. AI cost</p>
                  <p className="text-xs text-gray-300 mt-0.5">approx. only</p>
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
        </div>

        {/* Usage breakdown */}
        {usage && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
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
                <p className="text-3xl font-bold text-indigo-600">${usage.estimatedCostThisMonth.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">AI spend (est.)</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-4 border-t border-gray-100 pt-3">
              AI cost is estimated from job unit counts and model pricing. Actual API spend may differ. Check your AI provider dashboard for exact billing.
            </p>
          </div>
        )}

        {/* Pricing cards */}
        <h2 className="text-base font-semibold text-gray-900 mb-4">Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLAN_LIST.map((plan) => {
            const isCurrent = currentPlan === plan.id
            const isUpgrade = plan.price > (PLANS[currentPlan as PlanId]?.price ?? 0)

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative bg-white rounded-xl border p-6 flex flex-col",
                  plan.id === "pro" ? "border-indigo-400 shadow-md" : "border-gray-200",
                  isCurrent && "ring-2 ring-indigo-500"
                )}
              >
                {plan.id === "pro" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-indigo-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                      Most popular
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <h2 className="text-lg font-bold text-gray-900">{plan.label}</h2>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {plan.price === 0 ? "Free" : `$${plan.price}`}
                    {plan.price > 0 && <span className="text-sm font-normal text-gray-400"> / month</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{plan.description}</p>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="text-center text-sm font-medium text-indigo-600 py-2 border border-indigo-200 rounded-lg bg-indigo-50">
                    Current plan
                  </div>
                ) : plan.id === "free" ? (
                  <div className="text-center text-sm text-gray-400 py-2">
                    Downgrade by canceling your subscription
                  </div>
                ) : !plan.stripePriceId ? (
                  <div className="text-center text-sm text-gray-400 py-2 border border-gray-200 rounded-lg bg-gray-50">
                    Contact sales
                  </div>
                ) : (
                  <button
                    onClick={() => subscribe(plan.id as PlanId)}
                    disabled={!!loading}
                    className={cn(
                      "w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50",
                      isUpgrade
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                        : "border border-gray-300 hover:bg-gray-50 text-gray-700"
                    )}
                  >
                    {loading === plan.id ? "Redirecting…" : isUpgrade ? `Upgrade to ${plan.label}` : `Switch to ${plan.label}`}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <p className="text-xs text-gray-400 text-center mt-8">
          Payments are processed securely by Stripe. Cancel anytime from the billing portal.
        </p>
      </main>
    </div>
  )
}
