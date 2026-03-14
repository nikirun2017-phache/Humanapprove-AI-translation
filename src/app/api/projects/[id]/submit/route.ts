import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { _count: { select: { units: true } } },
  })

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Only assigned reviewer can submit
  if (
    session.user.role !== "admin" &&
    project.assignedReviewerId !== session.user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Check that all units have been reviewed (approved or rejected)
  const pendingCount = await db.translationUnit.count({
    where: { projectId, status: "pending" },
  })

  if (pendingCount > 0) {
    return NextResponse.json(
      {
        error: `${pendingCount} units still pending. Approve or reject all units before submitting.`,
      },
      { status: 400 }
    )
  }

  const rejectedCount = await db.translationUnit.count({
    where: { projectId, status: "rejected" },
  })

  // Determine project status based on outcome
  const newProjectStatus = rejectedCount > 0 ? "in_review" : "approved"

  await db.$transaction([
    db.reviewSession.updateMany({
      where: {
        projectId,
        reviewerId: session.user.id,
        approvalStatus: "in_progress",
      },
      data: {
        submittedAt: new Date(),
        approvalStatus: rejectedCount > 0 ? "submitted" : "approved",
      },
    }),
    db.project.update({
      where: { id: projectId },
      data: { status: newProjectStatus },
    }),
  ])

  return NextResponse.json({ status: newProjectStatus, rejectedCount })
}
