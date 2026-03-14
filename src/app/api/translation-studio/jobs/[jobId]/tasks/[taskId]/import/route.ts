import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readFile } from "fs/promises"
import { parseXliff } from "@/lib/xliff-parser"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string; taskId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { jobId, taskId } = await params
  const { id: userId, role } = session.user

  const [job, task] = await Promise.all([
    db.translationJob.findUnique({ where: { id: jobId } }),
    db.translationTask.findUnique({ where: { id: taskId } }),
  ])

  if (!job || !task || task.jobId !== jobId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (role !== "admin" && job.createdById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (task.status !== "completed") {
    return NextResponse.json({ error: "Task is not completed yet" }, { status: 409 })
  }
  if (task.projectId) {
    return NextResponse.json({ projectId: task.projectId })
  }
  if (!task.xliffFileUrl) {
    return NextResponse.json({ error: "XLIFF file not found" }, { status: 404 })
  }

  const xliffContent = await readFile(task.xliffFileUrl, "utf-8")
  const parsed = parseXliff(xliffContent)

  // Auto-assign reviewer by language capability
  let reviewerId: string | null = null
  const candidates = await db.user.findMany({ where: { role: "reviewer" } })
  const match = candidates.find((u) => {
    try {
      const langs: string[] = JSON.parse(u.languages)
      return langs.some(
        (l) =>
          l === task.targetLanguage ||
          l.startsWith(task.targetLanguage.split("-")[0])
      )
    } catch {
      return false
    }
  })
  if (match) reviewerId = match.id

  const project = await db.$transaction(async (tx) => {
    const proj = await tx.project.create({
      data: {
        name: `${job.name} — ${task.targetLanguage}`,
        sourceLanguage: parsed.sourceLanguage,
        targetLanguage: parsed.targetLanguage,
        xliffFileUrl: task.xliffFileUrl!,
        status: reviewerId ? "in_review" : "pending_assignment",
        createdById: userId,
        assignedReviewerId: reviewerId,
      },
    })

    await tx.translationUnit.createMany({
      data: parsed.units.map((u) => ({
        projectId: proj.id,
        xliffUnitId: u.id,
        sourceText: u.sourceText,
        targetText: u.targetText,
        orderIndex: u.orderIndex,
        metadata: JSON.stringify(u.metadata),
      })),
    })

    if (reviewerId) {
      await tx.reviewSession.create({
        data: { projectId: proj.id, reviewerId },
      })
    }

    await tx.translationTask.update({
      where: { id: taskId },
      data: { status: "imported", projectId: proj.id },
    })

    return proj
  })

  return NextResponse.json({ projectId: project.id })
}
