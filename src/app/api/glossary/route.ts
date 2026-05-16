import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/glossary?sourceLang=en-US&targetLang=fr-FR
// Returns all glossary entries for the current user, optionally filtered by language pair
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const sourceLang = searchParams.get("sourceLang") || undefined
  const targetLang = searchParams.get("targetLang") || undefined

  const userId = session.user.id

  const entries = await db.glossaryEntry.findMany({
    where: {
      userId,
      ...(sourceLang ? { sourceLang } : {}),
      ...(targetLang ? { targetLang } : {}),
    },
    orderBy: [{ sourceLang: "asc" }, { targetLang: "asc" }, { sourceTerm: "asc" }],
  })

  return NextResponse.json({ entries })
}

// POST /api/glossary — create a new glossary entry
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null) as {
    sourceTerm?: string
    targetTerm?: string
    sourceLang?: string
    targetLang?: string
    notes?: string
  } | null

  if (!body || !body.sourceTerm?.trim() || !body.targetTerm?.trim() || !body.sourceLang?.trim() || !body.targetLang?.trim()) {
    return NextResponse.json({ error: "sourceTerm, targetTerm, sourceLang, and targetLang are required" }, { status: 400 })
  }

  const userId = session.user.id

  try {
    const entry = await db.glossaryEntry.create({
      data: {
        userId,
        sourceTerm: body.sourceTerm.trim(),
        targetTerm: body.targetTerm.trim(),
        sourceLang: body.sourceLang.trim(),
        targetLang: body.targetLang.trim(),
        notes: body.notes?.trim() || null,
      },
    })
    return NextResponse.json({ entry }, { status: 201 })
  } catch (err: unknown) {
    const prismaErr = err as { code?: string }
    if (prismaErr?.code === "P2002") {
      return NextResponse.json({ error: "A glossary entry for this term and language pair already exists" }, { status: 409 })
    }
    return NextResponse.json({ error: "Failed to create glossary entry" }, { status: 500 })
  }
}

// DELETE /api/glossary?id=xxx — delete a glossary entry by id (owner check)
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const userId = session.user.id

  const entry = await db.glossaryEntry.findUnique({ where: { id } })
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (entry.userId !== userId && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await db.glossaryEntry.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
