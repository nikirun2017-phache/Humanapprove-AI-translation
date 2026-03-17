import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const project = await db.project.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      assignedReviewer: { select: { id: true, name: true, email: true } },
      _count: { select: { units: true } },
    },
  })

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  // Access check: admin sees all, reviewer sees assigned, requester sees own
  const { id: userId, role } = session.user
  if (
    role !== "admin" &&
    project.createdById !== userId &&
    project.assignedReviewerId !== userId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const approvedCount = await db.translationUnit.count({
    where: { projectId: id, status: "approved" },
  })

  return NextResponse.json({ ...project, approvedCount })
}

// DELETE /api/projects/:id - admin or project creator can delete
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { id: userId, role } = session.user

  const project = await db.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (role !== "admin" && project.createdById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await db.project.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}

// PATCH /api/projects/:id - admin or project creator can reassign reviewer / update status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: userId, role } = session.user
  const { id } = await params

  const project = await db.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Admins can patch any project; requesters can only patch their own
  if (role !== "admin" && project.createdById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { assignedReviewerId, reviewerType, status } = body

  const updated = await db.project.update({
    where: { id },
    data: {
      ...(assignedReviewerId !== undefined && { assignedReviewerId }),
      ...(reviewerType !== undefined && { reviewerType }),
      ...(status !== undefined && { status }),
      // When a reviewer is assigned, move from pending_assignment to in_review
      ...(assignedReviewerId && project.status === "pending_assignment" && { status: "in_review" }),
      // When reviewer is cleared, move back to pending_assignment
      ...(assignedReviewerId === null && { status: "pending_assignment" }),
    },
    include: { assignedReviewer: { select: { id: true, name: true, isPlatformReviewer: true } } },
  })

  return NextResponse.json(updated)
}
