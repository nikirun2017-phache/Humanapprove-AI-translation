import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { currentPassword, newPassword } = await req.json() as { currentPassword?: string; newPassword?: string }

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Both fields are required" }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user?.hashedPassword) {
    return NextResponse.json({ error: "Password change is not available for accounts using Google or Apple sign-in" }, { status: 400 })
  }

  const valid = await bcrypt.compare(currentPassword, user.hashedPassword)
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
  }

  const hashed = await bcrypt.hash(newPassword, 12)
  await db.user.update({ where: { id: session.user.id }, data: { hashedPassword: hashed } })

  return NextResponse.json({ ok: true })
}
