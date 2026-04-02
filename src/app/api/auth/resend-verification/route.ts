import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sendVerificationEmail } from "@/lib/email"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  const { email, checkOnly } = await req.json() as { email?: string; checkOnly?: boolean }
  if (!email?.trim()) return NextResponse.json({ error: "Email required" }, { status: 400 })

  const normalised = email.toLowerCase().trim()
  const user = await db.user.findUnique({ where: { email: normalised } })

  // Check-only mode: just report whether a pending verification exists
  if (checkOnly) {
    if (!user) return NextResponse.json({ pending: false })
    const existing = await db.verificationToken.findFirst({ where: { identifier: normalised } })
    return NextResponse.json({ pending: !!existing })
  }

  // Always return ok — don't reveal whether account exists
  if (!user) return NextResponse.json({ ok: true })

  // Check there's still a pending verification token
  const existing = await db.verificationToken.findFirst({ where: { identifier: normalised } })
  if (!existing) return NextResponse.json({ ok: true }) // already verified

  // Replace with a fresh token
  await db.verificationToken.deleteMany({ where: { identifier: normalised } })
  const token = crypto.randomBytes(32).toString("hex")
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await db.verificationToken.create({ data: { identifier: normalised, token, expires } })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "https://app.summontranslator.com"
  await sendVerificationEmail(normalised, `${appUrl}/api/auth/verify-email?token=${token}`)

  return NextResponse.json({ ok: true })
}
