import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readFile } from "fs/promises"
import { parseXliff } from "@/lib/xliff-parser"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string; taskId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { jobId, taskId } = await params
  const { id: userId, role } = session.user

  // reviewerType: "platform" = Jendee AI sources reviewer; "own" = customer brings their own
  const body = await req.json().catch(() => ({})) as { reviewerType?: string }
  const reviewerType: "platform" | "own" = body.reviewerType === "platform" ? "platform" : "own"

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

  let xliffContent: string
  try {
    xliffContent = await readFile(task.xliffFileUrl, "utf-8")
  } catch (err) {
    return NextResponse.json({ error: `Could not read XLIFF file: ${(err as Error).message}` }, { status: 500 })
  }

  let parsed: ReturnType<typeof parseXliff>
  try {
    parsed = parseXliff(xliffContent)
  } catch (err) {
    return NextResponse.json({ error: `Failed to parse translated XLIFF: ${(err as Error).message}` }, { status: 500 })
  }

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

  // Clean up any orphaned project from a previous failed import attempt
  // (transaction may have committed project+units but failed before updating task.projectId)
  await db.project.deleteMany({
    where: {
      name: `${job.name} — ${task.targetLanguage}`,
      createdById: userId,
    },
  })

  let project: { id: string }
  try {
    project = await db.$transaction(async (tx) => {
      const proj = await tx.project.create({
        data: {
          name: `${job.name} — ${task.targetLanguage}`,
          sourceLanguage: parsed.sourceLanguage,
          targetLanguage: parsed.targetLanguage,
          xliffFileUrl: task.xliffFileUrl!,
          originalFormat: job.sourceFormat,
          status: reviewerId ? "in_review" : "pending_assignment",
          createdById: userId,
          assignedReviewerId: reviewerType === "platform" ? reviewerId : null,
          reviewerType,
        },
      })

      // Deduplicate by xliffUnitId (Rise 360 XLIFFs can repeat IDs across <file> elements)
      const seen = new Set<string>()
      const uniqueUnits = parsed.units.filter((u) => {
        if (seen.has(u.id)) return false
        seen.add(u.id)
        return true
      })

      // Insert in chunks to avoid SQLite variable binding limits
      const CHUNK = 100
      for (let i = 0; i < uniqueUnits.length; i += CHUNK) {
        await tx.translationUnit.createMany({
          data: uniqueUnits.slice(i, i + CHUNK).map((u) => ({
            projectId: proj.id,
            xliffUnitId: u.id,
            sourceText: u.sourceText,
            targetText: u.targetText,
            orderIndex: u.orderIndex,
            metadata: JSON.stringify(u.metadata),
          })),
        })
      }

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
  } catch (err) {
    return NextResponse.json({ error: `Database error: ${(err as Error).message}` }, { status: 500 })
  }

  return NextResponse.json({ projectId: project.id })
}
