import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const MIME_MAP: Record<string, string> = {
  xliff: "application/xliff+xml",
  xlf:   "application/xliff+xml",
  tmx:   "application/x-tmx+xml",
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { runId } = await params
  const { id: userId, role } = session.user

  const run = await db.lqaRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      userId: true,
      fileName: true,
      fileFormat: true,
      originalFile: true,
    },
  })

  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (role !== "admin" && run.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!run.originalFile) {
    return NextResponse.json({ error: "Original file not available" }, { status: 404 })
  }

  const mime = MIME_MAP[run.fileFormat] ?? "application/octet-stream"
  // Use the stored filename directly — it is the original name the user uploaded
  const safeFileName = run.fileName.replace(/[^a-zA-Z0-9-_.]/g, "_")

  return new NextResponse(run.originalFile, {
    headers: {
      "Content-Type": `${mime}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${safeFileName}"`,
    },
  })
}
