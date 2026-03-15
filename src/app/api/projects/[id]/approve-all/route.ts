import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// POST /api/projects/:id/approve-all — bulk approve all non-rejected units
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: projectId } = await params
  const { id: userId, role } = session.user

  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (role !== "admin" && project.assignedReviewerId !== userId && project.createdById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { count } = await db.translationUnit.updateMany({
    where: {
      projectId,
      status: { notIn: ["approved", "rejected"] },
    },
    data: { status: "approved" },
  })

  const totalApproved = await db.translationUnit.count({
    where: { projectId, status: "approved" },
  })

  // Single audit entry summarising the bulk action
  if (count > 0) {
    await db.auditLog.create({
      data: {
        projectId,
        userId,
        action: "approve_all",
        detail: `${count} unit${count !== 1 ? "s" : ""} bulk-approved`,
      },
    })
  }

  return NextResponse.json({ updated: count, totalApproved })
}
