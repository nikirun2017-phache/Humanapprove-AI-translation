import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  const { token, password } = await req.json() as { token?: string; password?: string }

  if (!token?.trim() || !password?.trim()) {
    return NextResponse.json({ error: "Token and password are required" }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }

  const record = await db.passwordResetToken.findUnique({ where: { token } })

  if (!record) {
    return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 })
  }
  if (record.expires < new Date()) {
    await db.passwordResetToken.delete({ where: { token } })
    return NextResponse.json({ error: "This reset link has expired. Please request a new one." }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { email: record.email } })
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  await Promise.all([
    db.user.update({ where: { id: user.id }, data: { hashedPassword } }),
    db.passwordResetToken.delete({ where: { token } }),
  ])

  return NextResponse.json({ ok: true })
}
