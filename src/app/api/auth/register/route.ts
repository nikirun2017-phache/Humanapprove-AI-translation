import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { sendVerificationEmail } from "@/lib/email"

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

  const cleanName = name.trim()
  const cleanEmail = email.toLowerCase().trim()

  const existing = await db.user.findUnique({ where: { email: cleanEmail } })
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  await db.user.create({
    data: {
      name: cleanName,
      email: cleanEmail,
      hashedPassword,
      role: "requester",
    },
  })

  // Create a 24-hour email verification token
  const token = crypto.randomBytes(32).toString("hex")
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await db.verificationToken.create({ data: { identifier: cleanEmail, token, expires } })

  // Send verification email (fire-and-forget — failure must not block registration)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "https://app.summontranslator.com"
  void sendVerificationEmail(cleanEmail, `${appUrl}/api/auth/verify-email?token=${token}`)

  return NextResponse.json({ ok: true, requiresVerification: true }, { status: 201 })
}
