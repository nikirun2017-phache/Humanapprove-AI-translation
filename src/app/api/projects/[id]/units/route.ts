import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params
  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get("status") // pending|approved|rejected|commented
  const page = parseInt(searchParams.get("page") || "1", 10)
  const pageSize = parseInt(searchParams.get("pageSize") || "50", 10)

  // Verify access
  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { id: userId, role } = session.user
  if (
    role !== "admin" &&
    project.createdById !== userId &&
    project.assignedReviewerId !== userId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const where = {
    projectId,
    ...(statusFilter ? { status: statusFilter } : {}),
  }

  const [units, total] = await Promise.all([
    db.translationUnit.findMany({
      where,
      orderBy: { orderIndex: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        comments: {
          include: {
            author: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    db.translationUnit.count({ where }),
  ])

  return NextResponse.json({ units, total, page, pageSize })
}
