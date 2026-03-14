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

  const { id: unitId } = await params
  const body = await req.json()
  const { body: commentBody } = body

  if (!commentBody?.trim()) {
    return NextResponse.json({ error: "Comment body is required" }, { status: 400 })
  }

  const unit = await db.translationUnit.findUnique({
    where: { id: unitId },
    include: { project: true },
  })

  if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Access check: any participant in the project can comment
  const { id: userId, role } = session.user
  if (
    role !== "admin" &&
    unit.project.createdById !== userId &&
    unit.project.assignedReviewerId !== userId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const comment = await db.comment.create({
    data: {
      unitId,
      authorId: userId,
      body: commentBody.trim(),
    },
    include: {
      author: { select: { id: true, name: true } },
    },
  })

  // Mark unit as commented if still pending
  if (unit.status === "pending") {
    await db.translationUnit.update({
      where: { id: unitId },
      data: { status: "commented" },
    })
  }

  return NextResponse.json(comment, { status: 201 })
}
