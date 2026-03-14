import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readFile } from "fs/promises"

export async function GET(
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
  if (!task.xliffFileUrl) {
    return NextResponse.json({ error: "XLIFF not yet generated" }, { status: 409 })
  }

  const xliff = await readFile(task.xliffFileUrl, "utf-8")
  const safeName = `${job.name}-${task.targetLanguage}`.replace(/[^a-zA-Z0-9-_]/g, "_")

  return new NextResponse(xliff, {
    headers: {
      "Content-Type": "application/xliff+xml",
      "Content-Disposition": `attachment; filename="${safeName}.xliff"`,
    },
  })
}
