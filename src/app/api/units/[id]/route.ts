import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// PATCH /api/units/:id - update revisedTarget and/or status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const { revisedTarget, status } = body

  const unit = await db.translationUnit.findUnique({
    where: { id },
    include: { project: true },
  })

  if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { id: userId, role } = session.user
  if (role !== "admin" && unit.project.assignedReviewerId !== userId && unit.project.createdById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const updated = await db.translationUnit.update({
    where: { id },
    data: {
      ...(revisedTarget !== undefined && { revisedTarget }),
      ...(status !== undefined && { status }),
    },
  })

  // Write audit log when target text is actually revised
  if (revisedTarget !== undefined && revisedTarget !== unit.revisedTarget && revisedTarget !== unit.targetText) {
    await db.auditLog.create({
      data: {
        projectId: unit.projectId,
        unitId: id,
        userId,
        action: "revised",
        detail: null,
      },
    })
  }

  return NextResponse.json(updated)
}
