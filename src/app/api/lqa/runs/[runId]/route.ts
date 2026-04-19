import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// DELETE /api/lqa/runs/[runId] — permanently delete a run and its data
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { runId } = await params
  const run = await db.lqaRun.findUnique({ where: { id: runId }, select: { id: true, userId: true } })

  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { id: userId, role } = session.user
  if (role !== "admin" && run.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await db.lqaRun.delete({ where: { id: runId } })
  return NextResponse.json({ ok: true })
}

// GET /api/lqa/runs/[runId] — get run details (used for polling)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { runId } = await params
  const run = await db.lqaRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      userId: true,
      fileName: true,
      fileFormat: true,
      sourceLanguage: true,
      targetLanguage: true,
      status: true,
      totalUnits: true,
      qualityScore: true,
      qualityBand: true,
      accuracyErrors: true,
      languageErrors: true,
      styleErrors: true,
      findings: true,
      revisionStatus: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true,
      // originalFile intentionally excluded — it is large (up to 5 MB) and not
      // needed by the polling client; only the revise/report routes need it.
    },
  })

  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 })

  const { id: userId, role } = session.user
  if (role !== "admin" && run.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Parse findings JSON if present
  const findings = run.findings ? JSON.parse(run.findings) : []

  return NextResponse.json({ ...run, findings })
}
