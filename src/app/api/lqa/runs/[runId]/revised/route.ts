import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/lqa/runs/[runId]/revised — download the AI-revised bilingual file
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
      targetLanguage: true,
      revisionStatus: true,
      revisedFile: true,
    },
  })

  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 })

  const { id: userId, role } = session.user
  if (role !== "admin" && run.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (run.revisionStatus !== "completed" || !run.revisedFile) {
    return NextResponse.json({ error: "Revised file not ready" }, { status: 409 })
  }

  const safeName = run.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
  const baseName = safeName.replace(/\.(xliff|xlf|tmx)$/i, "")
  const ext = run.fileFormat === "tmx" ? "tmx" : run.fileFormat === "xlf" ? "xlf" : "xliff"
  const downloadName = `${baseName}_revised.${ext}`

  const contentType =
    run.fileFormat === "tmx"
      ? "application/x-tmx+xml"
      : "application/xliff+xml"

  return new NextResponse(run.revisedFile, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${downloadName}"`,
      "Cache-Control": "no-store",
    },
  })
}
