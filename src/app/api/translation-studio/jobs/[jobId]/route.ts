import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { jobId } = await params
  const { id: userId, role } = session.user

  const job = await db.translationJob.findUnique({
    where: { id: jobId },
    include: {
      createdBy: { select: { name: true } },
      tasks: { orderBy: { targetLanguage: "asc" } },
    },
  })

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (role !== "admin" && job.createdById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json(job)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { jobId } = await params
  const { id: userId, role } = session.user

  const job = await db.translationJob.findUnique({ where: { id: jobId } })
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (role !== "admin" && job.createdById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await db.translationJob.delete({ where: { id: jobId } })
  // Clean up job-scoped key if it exists
  await db.systemSetting.deleteMany({ where: { key: `ai_job_key_${jobId}` } })

  return new NextResponse(null, { status: 204 })
}
