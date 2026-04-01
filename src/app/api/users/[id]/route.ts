import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// PATCH /api/users/:id — update role or name (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json() as { role?: string; name?: string }

  const validRoles = ["admin", "reviewer", "requester"]
  if (body.role && !validRoles.includes(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  const user = await db.user.update({
    where: { id },
    data: {
      ...(body.role ? { role: body.role } : {}),
      ...(body.name ? { name: body.name } : {}),
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  })

  return NextResponse.json(user)
}

// DELETE /api/users/:id — admin only, cannot delete yourself
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  if (id === session.user.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { id } })
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await db.user.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
