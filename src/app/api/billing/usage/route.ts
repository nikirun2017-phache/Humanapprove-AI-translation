import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { PROVIDER_INFO } from "@/lib/ai-providers/registry"

const ALL_MODELS = PROVIDER_INFO.flatMap((p) => p.models)

const COST_PER_CHAR = 3 / 1_000_000 / 4  // rough: $3/M tokens, 4 chars/token (Sonnet equivalent)

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: userId, role } = session.user

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const jobWhere = role === "admin" ? {} : { createdById: userId }

  const [jobsThisMonth, jobsLastMonth, allTasks, projectsThisMonth, totalProjects] = await Promise.all([
    db.translationJob.count({
      where: { ...jobWhere, createdAt: { gte: startOfMonth } },
    }),
    db.translationJob.count({
      where: { ...jobWhere, createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
    }),
    db.translationTask.findMany({
      where: {
        createdAt: { gte: startOfMonth },
        status: { in: ["completed", "imported"] },
        job: jobWhere,
      },
      include: { job: { select: { model: true } } },
    }),
    db.project.count({
      where: role === "admin" ? { createdAt: { gte: startOfMonth } } : { createdById: userId, createdAt: { gte: startOfMonth } },
    }),
    db.project.count({
      where: role === "admin" ? {} : { createdById: userId },
    }),
  ])

  // Estimate cost from completed tasks: totalUnits * ~300 chars/unit * cost_per_char * 2.1 (in+out)
  let estimatedCostThisMonth = 0
  for (const task of allTasks) {
    const model = ALL_MODELS.find((m) => m.id === task.job.model)
    const units = task.totalUnits || 0
    const charsPerUnit = 300
    const inputTokens = Math.ceil((units * charsPerUnit) / 4)
    const outputTokens = Math.ceil(inputTokens * 1.1)
    if (model) {
      estimatedCostThisMonth +=
        (inputTokens * model.inputPricePer1M + outputTokens * model.outputPricePer1M) / 1_000_000
    } else {
      // fallback
      estimatedCostThisMonth += units * charsPerUnit * 2.1 * COST_PER_CHAR
    }
  }

  const languagesThisMonth = allTasks.length

  return NextResponse.json({
    jobsThisMonth,
    jobsLastMonth,
    languagesThisMonth,
    estimatedCostThisMonth: Math.round(estimatedCostThisMonth * 100) / 100,
    projectsThisMonth,
    totalProjects,
  })
}
