import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { stripe, PAYG_MARKUP, PLATFORM_FEE_PER_WORD, PLATFORM_REVIEW_RATE, OWN_REVIEWER_PLATFORM_FEE, AVG_WORDS_PER_UNIT, MIN_JOB_FEE } from "@/lib/stripe"
import { PROVIDER_INFO } from "@/lib/ai-providers/registry"

const ALL_MODELS = PROVIDER_INFO.flatMap((p: (typeof PROVIDER_INFO)[number]) => p.models)
const CHARS_PER_WORD = 5  // 5 chars per word
const COST_PER_WORD_FALLBACK = 3 / 1_000_000 / 4 * 5  // rough fallback: $3/M tokens, 4 chars/token, 5 chars/word

type BillingTask = { totalUnits: number; wordCount: number; jobId: string; job: { model: string } }

/** Words in a task: use stored wordCount if populated, else fall back to units × avg words/unit */
function taskWords(task: { totalUnits: number; wordCount: number }): number {
  return task.wordCount > 0 ? task.wordCount : task.totalUnits * AVG_WORDS_PER_UNIT
}

/** Raw AI API cost — what we pay the model provider */
function estimateApiCost(tasks: BillingTask[]): number {
  let total = 0
  for (const task of tasks) {
    const model = ALL_MODELS.find((m: (typeof ALL_MODELS)[number]) => m.id === task.job.model)
    const words = taskWords(task)
    const inputTokens = Math.ceil(words * CHARS_PER_WORD / 4)
    const outputTokens = Math.ceil(inputTokens * 1.1)
    total += model
      ? (inputTokens * model.inputPricePer1M + outputTokens * model.outputPricePer1M) / 1_000_000
      : words * COST_PER_WORD_FALLBACK
  }
  return total
}

/** Platform service fee based on total words translated — minimum applied per unique job */
function estimatePlatformFee(tasks: BillingTask[]): number {
  const totalWords = tasks.reduce((s, t) => s + taskWords(t), 0)
  const uniqueJobs = new Set(tasks.map(t => t.jobId)).size
  return Math.max(MIN_JOB_FEE * uniqueJobs, totalWords * PLATFORM_FEE_PER_WORD)
}

/** Total charge to customer = (API cost × markup) + platform fee */
function estimateCharge(tasks: BillingTask[]): number {
  return estimateApiCost(tasks) * PAYG_MARKUP + estimatePlatformFee(tasks)
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
    const [allJobsThisMonth, totalJobs, allRequesters] = await Promise.all([
      // Load jobs with their tasks + discount fields so we can apply promo discounts
      db.translationJob.findMany({
        where: { createdAt: { gte: startOfMonth } },
        select: {
          id: true,
          createdById: true,
          discountPct: true,
          promoCode: true,
          tasks: {
            where: { status: { in: ["completed", "imported"] } },
            select: { id: true, totalUnits: true, wordCount: true, jobId: true, job: { select: { model: true } } },
          },
        },
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

    // Compute charge per job applying per-job discount, then group by user
    type JobRow = (typeof allJobsThisMonth)[number]
    type TaskRow = JobRow["tasks"][number]

    function jobCharge(job: JobRow): { apiCost: number; gross: number; discount: number; net: number } {
      const tasks = job.tasks as BillingTask[]
      const apiCost = estimateApiCost(tasks)
      const gross = estimateCharge(tasks)
      const discount = job.discountPct > 0 ? gross * (job.discountPct / 100) : 0
      return { apiCost, gross, discount, net: gross - discount }
    }

    type UserRevenue = { apiCost: number; gross: number; discount: number; net: number }
    const revenueByUser = new Map<string, UserRevenue>()
    for (const job of allJobsThisMonth) {
      const c = jobCharge(job)
      const prev = revenueByUser.get(job.createdById) ?? { apiCost: 0, gross: 0, discount: 0, net: 0 }
      revenueByUser.set(job.createdById, {
        apiCost: prev.apiCost + c.apiCost,
        gross: prev.gross + c.gross,
        discount: prev.discount + c.discount,
        net: prev.net + c.net,
      })
    }

    let totalApiCost = 0
    let totalRevenue = 0
    let totalDiscount = 0
    type Requester = (typeof allRequesters)[number]
    const activeCustomers = allRequesters.filter((u: Requester) => u.subscriptionStatus === "active").length

    const users = allRequesters.map((u: Requester) => {
      const rev = revenueByUser.get(u.id) ?? { apiCost: 0, gross: 0, discount: 0, net: 0 }
      totalApiCost += rev.apiCost
      totalRevenue += rev.net
      totalDiscount += rev.discount
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        jobsThisMonth: u.translationJobs.length,
        apiCost: Math.round(rev.apiCost * 10000) / 10000,
        grossRevenue: Math.round(rev.gross * 100) / 100,
        discount: Math.round(rev.discount * 100) / 100,
        platformRevenue: Math.round(rev.net * 100) / 100,
        cardStatus: u.subscriptionStatus,
        hasCard: u.subscriptionStatus === "active",
      }
    }).sort((a: { platformRevenue: number }, b: { platformRevenue: number }) => b.platformRevenue - a.platformRevenue)

    return NextResponse.json({
      mode: "admin",
      totalApiCost: Math.round(totalApiCost * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      grossRevenue: Math.round((totalRevenue + totalDiscount) * 100) / 100,
      grossMarginPct: totalRevenue > 0 ? Math.round(((totalRevenue - totalApiCost) / totalRevenue) * 100) : 0,
      totalJobs,
      activeCustomers,
      markup: PAYG_MARKUP,
      users,
    })
  }

  // ── REQUESTER / REVIEWER: personal usage view ─────────────────────────────────
  const [jobsThisMonth, jobsLastMonth, tasksThisMonth, projectsThisMonth, totalProjects, user, platformProjects, ownReviewerProjects] =
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
      // Platform reviewer projects this month — billed at PLATFORM_REVIEW_RATE/word
      db.project.findMany({
        where: { createdById: userId, reviewerType: "platform", createdAt: { gte: startOfMonth } },
        include: { _count: { select: { units: true } } },
      }),
      // Own reviewer projects this month — billed at OWN_REVIEWER_PLATFORM_FEE/word
      db.project.findMany({
        where: { createdById: userId, reviewerType: "own", createdAt: { gte: startOfMonth } },
        include: { _count: { select: { units: true } } },
      }),
    ])

  const estimatedApiCost = estimateApiCost(tasksThisMonth)
  const platformReviewerFee = platformProjects.reduce(
    (sum: number, p: { _count: { units: number } }) => sum + p._count.units * AVG_WORDS_PER_UNIT * PLATFORM_REVIEW_RATE,
    0
  )
  const ownReviewerFee = ownReviewerProjects.reduce(
    (sum: number, p: { _count: { units: number } }) => sum + p._count.units * AVG_WORDS_PER_UNIT * OWN_REVIEWER_PLATFORM_FEE,
    0
  )
  const estimatedCharge = estimateCharge(tasksThisMonth) + platformReviewerFee + ownReviewerFee

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
    ownReviewerFee: Math.round(ownReviewerFee * 100) / 100,
    platformReviewProjects: platformProjects.length,
    ownReviewerProjects: ownReviewerProjects.length,
    projectsThisMonth,
    totalProjects,
    markup: PAYG_MARKUP,
    cardStatus: user?.subscriptionStatus ?? "none",
    cardLast4,
    cardBrand,
  })
}
