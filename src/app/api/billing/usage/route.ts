import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { stripe, PAYG_MARKUP } from "@/lib/stripe"
import { PROVIDER_INFO } from "@/lib/ai-providers/registry"

const ALL_MODELS = PROVIDER_INFO.flatMap((p) => p.models)
const COST_PER_CHAR = 3 / 1_000_000 / 4  // rough: $3/M tokens, 4 chars/token

// Platform reviewer fee: $0.02/word base rate × 1.5 platform surcharge = $0.03/word
const PLATFORM_REVIEW_RATE = 0.03
const AVG_WORDS_PER_UNIT = 15

/** Estimate AI cost in USD from a list of tasks with their job model */
function estimateCost(tasks: Array<{ totalUnits: number; job: { model: string } }>): number {
  let total = 0
  for (const task of tasks) {
    const model = ALL_MODELS.find((m) => m.id === task.job.model)
    const units = task.totalUnits || 0
    const charsPerUnit = 300
    const inputTokens = Math.ceil((units * charsPerUnit) / 4)
    const outputTokens = Math.ceil(inputTokens * 1.1)
    if (model) {
      total += (inputTokens * model.inputPricePer1M + outputTokens * model.outputPricePer1M) / 1_000_000
    } else {
      total += units * charsPerUnit * 2.1 * COST_PER_CHAR
    }
  }
  return total
}

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: userId, role } = session.user

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  // ── ADMIN: platform-wide revenue view ────────────────────────────────────────
  if (role === "admin") {
    const [allTasksThisMonth, totalJobs, allRequesters] = await Promise.all([
      db.translationTask.findMany({
        where: { createdAt: { gte: startOfMonth }, status: { in: ["completed", "imported"] } },
        include: { job: { select: { model: true, createdById: true } } },
      }),
      db.translationJob.count({ where: { createdAt: { gte: startOfMonth } } }),
      db.user.findMany({
        where: { role: "requester" },
        select: {
          id: true, name: true, email: true,
          subscriptionId: true, subscriptionStatus: true, stripeCustomerId: true,
          translationJobs: {
            where: { createdAt: { gte: startOfMonth } },
            select: { id: true },
          },
        },
      }),
    ])

    // Aggregate cost per user
    const costByUser = new Map<string, number>()
    for (const task of allTasksThisMonth) {
      const uid = task.job.createdById
      const prev = costByUser.get(uid) ?? 0
      costByUser.set(uid, prev + estimateCost([task]))
    }

    const totalApiCost = Array.from(costByUser.values()).reduce((s, v) => s + v, 0)
    const totalRevenue = totalApiCost * PAYG_MARKUP
    const activeCustomers = allRequesters.filter((u) => u.subscriptionStatus === "active").length

    const users = allRequesters.map((u) => {
      const apiCost = costByUser.get(u.id) ?? 0
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        jobsThisMonth: u.translationJobs.length,
        apiCost: Math.round(apiCost * 10000) / 10000,
        platformRevenue: Math.round(apiCost * PAYG_MARKUP * 100) / 100,
        cardStatus: u.subscriptionStatus,
        hasCard: u.subscriptionStatus === "active",
      }
    }).sort((a, b) => b.platformRevenue - a.platformRevenue)

    return NextResponse.json({
      mode: "admin",
      totalApiCost: Math.round(totalApiCost * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      grossMarginPct: totalRevenue > 0 ? Math.round(((totalRevenue - totalApiCost) / totalRevenue) * 100) : 0,
      totalJobs,
      activeCustomers,
      markup: PAYG_MARKUP,
      users,
    })
  }

  // ── REQUESTER / REVIEWER: personal usage view ─────────────────────────────────
  const [jobsThisMonth, jobsLastMonth, tasksThisMonth, projectsThisMonth, totalProjects, user, platformProjects] =
    await Promise.all([
      db.translationJob.count({ where: { createdById: userId, createdAt: { gte: startOfMonth } } }),
      db.translationJob.count({
        where: { createdById: userId, createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
      }),
      db.translationTask.findMany({
        where: {
          createdAt: { gte: startOfMonth },
          status: { in: ["completed", "imported"] },
          job: { createdById: userId },
        },
        include: { job: { select: { model: true } } },
      }),
      db.project.count({ where: { createdById: userId, createdAt: { gte: startOfMonth } } }),
      db.project.count({ where: { createdById: userId } }),
      db.user.findUnique({
        where: { id: userId },
        select: { subscriptionId: true, subscriptionStatus: true, stripeCustomerId: true },
      }),
      // Platform reviewer projects this month — billed at $0.03/word
      db.project.findMany({
        where: { createdById: userId, reviewerType: "platform", createdAt: { gte: startOfMonth } },
        include: { _count: { select: { units: true } } },
      }),
    ])

  const estimatedApiCost = estimateCost(tasksThisMonth)
  const platformReviewerFee = platformProjects.reduce(
    (sum, p) => sum + p._count.units * AVG_WORDS_PER_UNIT * PLATFORM_REVIEW_RATE,
    0
  )
  const estimatedCharge = estimatedApiCost * PAYG_MARKUP + platformReviewerFee

  // Fetch card details from Stripe if a payment method is saved
  let cardLast4: string | null = null
  let cardBrand: string | null = null
  if (user?.subscriptionId) {
    try {
      const pm = await stripe.paymentMethods.retrieve(user.subscriptionId)
      cardLast4 = pm.card?.last4 ?? null
      cardBrand = pm.card?.brand ?? null
    } catch {
      // Payment method may have been removed from Stripe
    }
  }

  return NextResponse.json({
    mode: "requester",
    jobsThisMonth,
    jobsLastMonth,
    languagesThisMonth: tasksThisMonth.length,
    estimatedApiCost: Math.round(estimatedApiCost * 10000) / 10000,
    estimatedCharge: Math.round(estimatedCharge * 100) / 100,
    platformReviewerFee: Math.round(platformReviewerFee * 100) / 100,
    platformReviewProjects: platformProjects.length,
    projectsThisMonth,
    totalProjects,
    markup: PAYG_MARKUP,
    cardStatus: user?.subscriptionStatus ?? "none",
    cardLast4,
    cardBrand,
  })
}
