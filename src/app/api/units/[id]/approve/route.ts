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

  const { id } = await params

  const unit = await db.translationUnit.findUnique({
    where: { id },
    include: { project: true },
  })

  if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { id: userId, role } = session.user
  if (role !== "admin" && unit.project.assignedReviewerId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const updated = await db.translationUnit.update({
    where: { id },
    data: { status: "approved" },
  })

  return NextResponse.json(updated)
}
