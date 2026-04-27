import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/media/runs/[runId] — poll run status and get preview data
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { runId } = await params
  const run = await db.mediaRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      fileName: true,
      fileFormat: true,
      targetLanguage: true,
      status: true,
      totalEntries: true,
      previewData: true,
      errorMessage: true,
      createdAt: true,
      userId: true,
    },
  })

  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 })

  const { id: userId, role } = session.user
  if (role !== "admin" && run.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Omit userId from response
  const { userId: _uid, ...rest } = run
  return NextResponse.json(rest)
}
