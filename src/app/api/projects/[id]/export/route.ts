import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { exportRevisedXliff } from "@/lib/xliff-exporter"
import { readFile } from "fs/promises"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params

  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Access check
  const { id: userId, role } = session.user
  if (
    role !== "admin" &&
    project.createdById !== userId &&
    project.assignedReviewerId !== userId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const units = await db.translationUnit.findMany({
    where: { projectId },
    orderBy: { orderIndex: "asc" },
  })

  // Read original XLIFF
  const originalXml = await readFile(project.xliffFileUrl, "utf-8")

  // Merge revisions
  const revisedXml = exportRevisedXliff(
    originalXml,
    units.map((u: (typeof units)[number]) => ({
      xliffUnitId: u.xliffUnitId,
      revisedTarget: u.revisedTarget,
      targetText: u.targetText,
      status: u.status,
    }))
  )

  // Mark project as exported
  await db.project.update({
    where: { id: projectId },
    data: { status: "exported" },
  })

  const fileName = `${project.name.replace(/[^a-z0-9]/gi, "_")}-revised.xliff`

  return new NextResponse(revisedXml, {
    headers: {
      "Content-Type": "application/xliff+xml",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  })
}
