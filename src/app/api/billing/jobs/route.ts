import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { PAYG_MARKUP, PLATFORM_FEE_PER_WORD, MIN_JOB_FEE, AVG_WORDS_PER_UNIT } from "@/lib/stripe"
import { PROVIDER_INFO } from "@/lib/ai-providers/registry"

const ALL_MODELS = PROVIDER_INFO.flatMap((p: (typeof PROVIDER_INFO)[number]) => p.models)
const CHARS_PER_WORD = 5
const COST_PER_WORD_FALLBACK = 3 / 1_000_000 / 4 * 5

function taskWords(task: { totalUnits: number; wordCount: number }): number {
  return task.wordCount > 0 ? task.wordCount : task.totalUnits * AVG_WORDS_PER_UNIT
}

function estimateApiCostForTask(task: { totalUnits: number; wordCount: number; job: { model: string } }): number {
  const model = ALL_MODELS.find((m: (typeof ALL_MODELS)[number]) => m.id === task.job.model)
  const words = taskWords(task)
  const inputTokens = Math.ceil(words * CHARS_PER_WORD / 4)
  const outputTokens = Math.ceil(inputTokens * 1.1)
  return model
    ? (inputTokens * model.inputPricePer1M + outputTokens * model.outputPricePer1M) / 1_000_000
    : words * COST_PER_WORD_FALLBACK
}

// GET /api/billing/jobs?month=2026-03
// Returns per-job cost breakdown for the authenticated requester
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: userId, role } = session.user

  // Parse month param (default: current month)
  const monthParam = new URL(req.url).searchParams.get("month")
  let startOfMonth: Date
  let endOfMonth: Date
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [year, month] = monthParam.split("-").map(Number)
    startOfMonth = new Date(year, month - 1, 1)
    endOfMonth = new Date(year, month, 1)
  } else {
    const now = new Date()
    startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  }

  // Admins can optionally query a specific requester
  const targetUserId = (role === "admin" && new URL(req.url).searchParams.get("userId")) || userId

  const jobs = await db.translationJob.findMany({
    where: {
      createdById: targetUserId,
      createdAt: { gte: startOfMonth, lt: endOfMonth },
    },
    include: {
      tasks: {
        where: { status: { in: ["completed", "imported"] } },
        select: { id: true, targetLanguage: true, totalUnits: true, wordCount: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const result = jobs.map(job => {
    const tasks = job.tasks.map(t => ({ ...t, job: { model: job.model } }))
    const totalWords = tasks.reduce((s, t) => s + taskWords(t), 0)
    const apiCost = tasks.reduce((s, t) => s + estimateApiCostForTask(t), 0)
    const platformFee = Math.max(MIN_JOB_FEE, totalWords * PLATFORM_FEE_PER_WORD)
    const totalCharge = apiCost * PAYG_MARKUP + platformFee
    const languages = job.tasks.map(t => t.targetLanguage)

    return {
      id: job.id,
      name: job.name ?? job.sourceFormat ?? "Translation job",
      createdAt: job.createdAt,
      model: job.model,
      sourceLanguage: job.sourceLanguage,
      languages,
      languageCount: languages.length,
      totalWords,
      apiCost: Math.round(apiCost * 100000) / 100000,
      platformFee: Math.round(platformFee * 100) / 100,
      totalCharge: Math.round(totalCharge * 100) / 100,
      status: job.tasks.every(t => t.status === "completed" || t.status === "imported") ? "completed" : "in_progress",
    }
  })

  const monthTotal = result.reduce((s, j) => s + j.totalCharge, 0)

  return NextResponse.json({
    jobs: result,
    monthTotal: Math.round(monthTotal * 100) / 100,
    month: startOfMonth.toISOString(),
  })
}
