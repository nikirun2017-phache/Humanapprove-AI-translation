import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const { reason } = body

  const unit = await db.translationUnit.findUnique({
    where: { id },
    include: { project: true },
  })

  if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { id: userId, role } = session.user
  if (role !== "admin" && unit.project.assignedReviewerId !== userId && unit.project.createdById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [updated] = await db.$transaction([
    db.translationUnit.update({
      where: { id },
      data: { status: "rejected" },
    }),
    ...(reason
      ? [
          db.comment.create({
            data: {
              unitId: id,
              authorId: userId,
              body: `[Rejected] ${reason}`,
            },
          }),
        ]
      : []),
    db.auditLog.create({
      data: {
        projectId: unit.projectId,
        unitId: id,
        userId,
        action: "rejected",
        detail: reason ?? null,
      },
    }),
  ])

  return NextResponse.json(updated)
}
