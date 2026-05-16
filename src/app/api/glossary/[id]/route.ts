import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// PATCH /api/glossary/[id] — update targetTerm and/or notes for a glossary entry
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const userId = session.user.id

  const entry = await db.glossaryEntry.findUnique({ where: { id } })
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (entry.userId !== userId && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as {
    targetTerm?: string
    notes?: string
  } | null

  if (!body || (body.targetTerm === undefined && body.notes === undefined)) {
    return NextResponse.json({ error: "At least one of targetTerm or notes must be provided" }, { status: 400 })
  }

  const updateData: { targetTerm?: string; notes?: string | null } = {}
  if (body.targetTerm !== undefined) {
    if (!body.targetTerm.trim()) {
      return NextResponse.json({ error: "targetTerm cannot be empty" }, { status: 400 })
    }
    updateData.targetTerm = body.targetTerm.trim()
  }
  if (body.notes !== undefined) {
    updateData.notes = body.notes?.trim() || null
  }

  const updated = await db.glossaryEntry.update({
    where: { id },
    data: updateData,
  })

  return NextResponse.json({ entry: updated })
}
