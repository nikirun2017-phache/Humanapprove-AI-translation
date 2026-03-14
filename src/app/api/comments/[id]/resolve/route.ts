import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const comment = await db.comment.findUnique({
    where: { id },
    include: {
      unit: { include: { project: true } },
    },
  })

  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { id: userId, role } = session.user
  const project = comment.unit.project
  if (
    role !== "admin" &&
    project.createdById !== userId &&
    project.assignedReviewerId !== userId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const updated = await db.comment.update({
    where: { id },
    data: { resolved: true },
  })

  return NextResponse.json(updated)
}
