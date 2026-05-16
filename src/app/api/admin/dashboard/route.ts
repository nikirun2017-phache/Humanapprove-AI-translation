import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { PROVIDER_INFO } from "@/lib/ai-providers/registry"
import { AVG_WORDS_PER_UNIT, PAYG_MARKUP, PLATFORM_FEE_PER_WORD, MIN_JOB_FEE } from "@/lib/pricing"

const ALL_MODELS = PROVIDER_INFO.flatMap(p => p.models)
const CHARS_PER_WORD = 5
const COST_PER_WORD_FALLBACK = (3 / 1_000_000 / 4) * 5

function getModelInfo(modelId: string) {
  return ALL_MODELS.find(m => m.id === modelId) ?? null
}

function estimateTaskApiCost(wordCount: number, totalUnits: number, modelId: string): number {
  const words = wordCount > 0 ? wordCount : totalUnits * AVG_WORDS_PER_UNIT
  const m = getModelInfo(modelId)
  const inputTokens = Math.ceil(words * CHARS_PER_WORD / 4)
  const outputTokens = Math.ceil(inputTokens * 1.1)
  return m
    ? (inputTokens * m.inputPricePer1M + outputTokens * m.outputPricePer1M) / 1_000_000
    : words * COST_PER_WORD_FALLBACK
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function last6Months(): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(monthKey(d))
  }
  return months
}

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  sixMonthsAgo.setDate(1)
  sixMonthsAgo.setHours(0, 0, 0, 0)

  const startOfThisMonth = new Date()
  startOfThisMonth.setDate(1)
  startOfThisMonth.setHours(0, 0, 0, 0)

  const months = last6Months()

  // ── Fetch everything in parallel ────────────────────────────────────────────
  const [
    allUsers,
    allJobs,
    completedTasks,
    lqaCount,
    mediaCount,
    integrationCount,
    monthlyCharges,
  ] = await Promise.all([
    db.user.findMany({
      select: { id: true, role: true, subscriptionStatus: true, createdAt: true },
    }),
    db.translationJob.findMany({
      select: {
        id: true,
        model: true,
        provider: true,
        sourceFormat: true,
        discountPct: true,
        createdAt: true,
        tasks: {
          select: { id: true, targetLanguage: true, wordCount: true, totalUnits: true, status: true },
        },
      },
    }),
    db.translationTask.findMany({
      where: { status: { in: ["completed", "imported"] } },
      select: { wordCount: true, totalUnits: true, targetLanguage: true, job: { select: { model: true } } },
    }),
    db.lqaRun.count(),
    db.mediaRun.count(),
    db.integration.count({ where: { status: "connected" } }),
    db.monthlyCharge.findMany({
      where: { status: "charged" },
      select: { amountCents: true, billingMonth: true },
    }),
  ])

  // ── Users ────────────────────────────────────────────────────────────────────
  const totalUsers = allUsers.length
  const byRole = allUsers.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  const payingUsers = allUsers.filter(u => u.subscriptionStatus === "active").length
  const newThisMonth = allUsers.filter(u => u.createdAt >= startOfThisMonth).length

  const signupsByMonth: Record<string, number> = Object.fromEntries(months.map(m => [m, 0]))
  allUsers.forEach(u => {
    const m = monthKey(u.createdAt)
    if (m in signupsByMonth) signupsByMonth[m]++
  })

  // ── Jobs ─────────────────────────────────────────────────────────────────────
  const totalJobs = allJobs.length
  const jobsThisMonth = allJobs.filter(j => j.createdAt >= startOfThisMonth).length

  const jobsByMonth: Record<string, number> = Object.fromEntries(months.map(m => [m, 0]))
  allJobs.forEach(j => {
    const m = monthKey(j.createdAt)
    if (m in jobsByMonth) jobsByMonth[m]++
  })

  // Jobs by model
  const modelMap: Record<string, { count: number; totalWords: number; provider: string }> = {}
  allJobs.forEach(j => {
    if (!modelMap[j.model]) modelMap[j.model] = { count: 0, totalWords: 0, provider: j.provider }
    modelMap[j.model].count++
    j.tasks.forEach(t => {
      modelMap[j.model].totalWords += t.wordCount > 0 ? t.wordCount : t.totalUnits * AVG_WORDS_PER_UNIT
    })
  })
  const byModel = Object.entries(modelMap)
    .map(([model, d]) => ({ model, ...d }))
    .sort((a, b) => b.count - a.count)

  // Jobs by format
  const formatMap: Record<string, number> = {}
  allJobs.forEach(j => { formatMap[j.sourceFormat] = (formatMap[j.sourceFormat] ?? 0) + 1 })
  const byFormat = Object.entries(formatMap)
    .map(([format, count]) => ({ format, count }))
    .sort((a, b) => b.count - a.count)

  // Completion / failure stats across all tasks
  const allTasksFlat = allJobs.flatMap(j => j.tasks.map(t => ({ ...t, model: j.model, discountPct: j.discountPct })))
  const completedCount = allTasksFlat.filter(t => t.status === "completed" || t.status === "imported").length
  const failedCount = allTasksFlat.filter(t => t.status === "failed").length
  const totalTasks = allTasksFlat.length
  const completionRate = totalTasks > 0 ? completedCount / totalTasks : 0

  // ── Words ────────────────────────────────────────────────────────────────────
  const totalWords = completedTasks.reduce((s, t) => s + (t.wordCount > 0 ? t.wordCount : t.totalUnits * AVG_WORDS_PER_UNIT), 0)
  const wordsThisMonth = allJobs
    .filter(j => j.createdAt >= startOfThisMonth)
    .flatMap(j => j.tasks.filter(t => t.status === "completed" || t.status === "imported"))
    .reduce((s, t) => s + (t.wordCount > 0 ? t.wordCount : t.totalUnits * AVG_WORDS_PER_UNIT), 0)

  // ── Revenue & Cost ───────────────────────────────────────────────────────────
  let estimatedApiCostUsd = 0
  let estimatedRevenueUsd = 0

  allJobs.forEach(j => {
    const jobCompletedTasks = j.tasks.filter(t => t.status === "completed" || t.status === "imported")
    if (jobCompletedTasks.length === 0) return

    const jobApiCost = jobCompletedTasks.reduce((s, t) => s + estimateTaskApiCost(t.wordCount, t.totalUnits, j.model), 0)
    const jobWords = jobCompletedTasks.reduce((s, t) => s + (t.wordCount > 0 ? t.wordCount : t.totalUnits * AVG_WORDS_PER_UNIT), 0)
    const platformFee = Math.max(MIN_JOB_FEE, jobWords * PLATFORM_FEE_PER_WORD)
    const base = jobApiCost * PAYG_MARKUP + platformFee
    const discount = j.discountPct > 0 ? base * (j.discountPct / 100) : 0
    estimatedApiCostUsd += jobApiCost
    estimatedRevenueUsd += base - discount
  })

  const grossMarginPct = estimatedRevenueUsd > 0
    ? Math.round(((estimatedRevenueUsd - estimatedApiCostUsd) / estimatedRevenueUsd) * 100)
    : 0

  // Actual charged revenue from Stripe (MonthlyCharge table)
  const chargedAllTimeCents = monthlyCharges.reduce((s, c) => s + c.amountCents, 0)
  const chargedThisMonthCents = monthlyCharges
    .filter(c => c.billingMonth === monthKey(startOfThisMonth))
    .reduce((s, c) => s + c.amountCents, 0)

  const chargedByMonth: Record<string, number> = Object.fromEntries(months.map(m => [m, 0]))
  monthlyCharges.forEach(c => {
    if (c.billingMonth in chargedByMonth) chargedByMonth[c.billingMonth] += c.amountCents
  })

  // ── Languages ────────────────────────────────────────────────────────────────
  const langMap: Record<string, number> = {}
  completedTasks.forEach(t => { langMap[t.targetLanguage] = (langMap[t.targetLanguage] ?? 0) + 1 })
  const topLanguages = Object.entries(langMap)
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)

  // ── Roadmap signals ──────────────────────────────────────────────────────────
  const avgJobsPerUser = totalUsers > 0 ? (totalJobs / totalUsers) : 0
  const failureRate = totalTasks > 0 ? Math.round((failedCount / totalTasks) * 100) : 0

  return NextResponse.json({
    users: {
      total: totalUsers,
      byRole,
      paying: payingUsers,
      newThisMonth,
      signupsByMonth: months.map(m => ({ month: m, count: signupsByMonth[m] })),
    },
    jobs: {
      total: totalJobs,
      thisMonth: jobsThisMonth,
      completionRate: Math.round(completionRate * 100),
      failureRate,
      byModel,
      byFormat,
      jobsByMonth: months.map(m => ({ month: m, count: jobsByMonth[m] })),
    },
    words: {
      total: totalWords,
      thisMonth: wordsThisMonth,
    },
    revenue: {
      estimatedAllTimeUsd: Math.round(estimatedRevenueUsd * 100) / 100,
      estimatedThisMonthUsd: 0, // computed on client from job dates
      apiCostAllTimeUsd: Math.round(estimatedApiCostUsd * 100) / 100,
      grossMarginPct,
      markup: PAYG_MARKUP,
      charged: {
        allTimeCents: chargedAllTimeCents,
        thisMonthCents: chargedThisMonthCents,
        byMonth: months.map(m => ({ month: m, amountCents: chargedByMonth[m] })),
      },
    },
    features: {
      translationJobs: totalJobs,
      lqaRuns: lqaCount,
      mediaRuns: mediaCount,
      integrations: integrationCount,
    },
    signals: {
      avgJobsPerUser: Math.round(avgJobsPerUser * 10) / 10,
      topLanguages,
      topModels: byModel.slice(0, 5),
      topFormats: byFormat.slice(0, 5),
    },
  })
}
