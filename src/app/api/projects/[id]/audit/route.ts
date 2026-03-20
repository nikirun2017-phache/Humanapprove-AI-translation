import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/projects/:id/audit — last 100 audit log entries for a project
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: projectId } = await params

  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, assignedReviewerId: true, createdById: true } })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { id: userId, role } = session.user
  if (role !== "admin" && project.assignedReviewerId !== userId && project.createdById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const logs = await db.auditLog.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { name: true } },
    },
  })

  // Attach xliffUnitId for unit-level events
  const unitIds = logs.map((l: (typeof logs)[number]) => l.unitId).filter(Boolean) as string[]
  const units = unitIds.length
    ? await db.translationUnit.findMany({
        where: { id: { in: unitIds } },
        select: { id: true, xliffUnitId: true, sourceText: true },
      })
    : []
  const unitMap = Object.fromEntries(units.map((u: (typeof units)[number]) => [u.id, u]))

  const result = logs.map((l: (typeof logs)[number]) => ({
    id: l.id,
    action: l.action,
    detail: l.detail,
    createdAt: l.createdAt,
    user: l.user.name,
    unit: l.unitId ? unitMap[l.unitId] ?? null : null,
  }))

  return NextResponse.json(result)
}
