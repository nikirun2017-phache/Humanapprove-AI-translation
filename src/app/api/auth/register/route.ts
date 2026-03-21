import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json() as {
    name?: string
    email?: string
    password?: string
  }

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  await db.user.create({
    data: {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      hashedPassword,
      role: "requester",
    },
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
