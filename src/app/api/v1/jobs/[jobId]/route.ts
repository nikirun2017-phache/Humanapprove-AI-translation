import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { resolveAuth } from "@/lib/resolve-auth"

// GET /api/v1/jobs/[jobId] — get job status and per-task details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await resolveAuth(req)
  if (auth.kind === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { jobId } = await params

  const job = await db.translationJob.findUnique({
    where: { id: jobId },
    include: {
      tasks: {
        select: {
          id: true,
          targetLanguage: true,
          status: true,
          wordCount: true,
          completedUnits: true,
          totalUnits: true,
          errorMessage: true,
          updatedAt: true,
        },
        orderBy: { targetLanguage: "asc" },
      },
    },
  })

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Ownership check — API keys can only access their own user's jobs
  if (auth.user.role !== "admin" && job.createdById !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const base = new URL(req.url).origin

  // Derive overall job status from tasks
  const allDone = job.tasks.every(t => t.status === "completed" || t.status === "imported" || t.status === "failed")
  const anyFailed = job.tasks.some(t => t.status === "failed")
  const derivedStatus = !allDone
    ? job.tasks.some(t => t.status === "running") ? "running" : "pending"
    : anyFailed ? "failed" : "completed"

  return NextResponse.json({
    jobId: job.id,
    name: job.name,
    status: derivedStatus,
    sourceFormat: job.sourceFormat,
    sourceLanguage: job.sourceLanguage,
    provider: job.provider,
    model: job.model,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    tasks: job.tasks.map(t => ({
      taskId: t.id,
      targetLanguage: t.targetLanguage,
      status: t.status,
      wordCount: t.wordCount,
      completedUnits: t.completedUnits,
      totalUnits: t.totalUnits,
      errorMessage: t.errorMessage ?? null,
      downloadUrl:
        t.status === "completed" || t.status === "imported"
          ? `${base}/api/v1/jobs/${job.id}/tasks/${t.id}/download`
          : null,
    })),
  })
}
