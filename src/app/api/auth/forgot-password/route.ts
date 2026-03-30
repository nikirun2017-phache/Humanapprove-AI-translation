import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sendPasswordResetEmail } from "@/lib/email"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email?: string }

  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }

  const normalised = email.toLowerCase().trim()

  // Always return success — never reveal whether an account exists
  const user = await db.user.findUnique({ where: { email: normalised } })
  if (!user || !user.hashedPassword) {
    // No account, or OAuth-only account (no password to reset) — silently succeed
    return NextResponse.json({ ok: true })
  }

  // Invalidate any previous tokens for this email
  await db.passwordResetToken.deleteMany({ where: { email: normalised } })

  const token = crypto.randomBytes(32).toString("hex")
  const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await db.passwordResetToken.create({ data: { email: normalised, token, expires } })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.jendee.ai"
  const resetUrl = `${appUrl}/reset-password?token=${token}`
  await sendPasswordResetEmail(normalised, resetUrl)

  return NextResponse.json({ ok: true })
}
