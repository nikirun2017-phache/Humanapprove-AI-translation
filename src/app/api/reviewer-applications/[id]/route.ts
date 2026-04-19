import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import {
  sendReviewerApprovalEmail,
  sendReviewerRejectionEmail,
} from "@/lib/email"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://summontranslator.com"

// GET /api/reviewer-applications/[id] — admin only
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const { id } = await params
  const application = await db.reviewerApplication.findUnique({ where: { id } })
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(application)
}

// PATCH /api/reviewer-applications/[id] — admin only
// Body: { action: "approve" | "reject" }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = (await req.json()) as { action: string; adminNote?: string }
  const { action, adminNote } = body

  if (!["approve", "reject", "revoke"].includes(action)) {
    return NextResponse.json({ error: "action must be 'approve', 'reject', or 'revoke'" }, { status: 400 })
  }

  const application = await db.reviewerApplication.findUnique({ where: { id } })
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // ── REVOKE ───────────────────────────────────────────────────────────────
  // Demotes an approved reviewer back to requester. Does not require pending status.
  if (action === "revoke") {
    if (application.status !== "approved") {
      return NextResponse.json({ error: "Can only revoke approved applications" }, { status: 409 })
    }
    const targetUserId = application.resolvedUserId ?? application.userId
    if (targetUserId) {
      await db.user.update({
        where: { id: targetUserId },
        data: { role: "requester", isPlatformReviewer: false },
      })
    }
    await db.reviewerApplication.update({
      where: { id },
      data: { status: "revoked", revokedAt: new Date(), adminNote: adminNote ?? null },
    })
    return NextResponse.json({ ok: true, status: "revoked" })
  }

  if (application.status !== "pending") {
    return NextResponse.json({ error: "Application has already been processed" }, { status: 409 })
  }

  // ── REJECT ───────────────────────────────────────────────────────────────
  if (action === "reject") {
    await db.reviewerApplication.update({
      where: { id },
      data: { status: "rejected", adminNote: adminNote ?? null },
    })
    void sendReviewerRejectionEmail(application.fullName, application.email)
    return NextResponse.json({ ok: true, status: "rejected" })
  }

  // ── APPROVE ──────────────────────────────────────────────────────────────
  // Prefer looking up by userId (direct FK) then fall back to email
  const existingUser = application.userId
    ? await db.user.findUnique({ where: { id: application.userId } })
    : await db.user.findUnique({ where: { email: application.email } })

  let resolvedUserId: string
  let setPasswordUrl: string | null = null

  // Token TTL: 48 hours — gives new reviewers enough time to check email and set password
  const TOKEN_TTL_MS = 48 * 60 * 60 * 1000

  if (existingUser) {
    if (existingUser.role === "reviewer") {
      // Already a reviewer — update languages and re-send approval email
      const existingLangs: string[] = JSON.parse(existingUser.languages ?? "[]")
      const newLangs: string[] = JSON.parse(application.languagePairs)
      const mergedLangs = Array.from(new Set([...existingLangs, ...newLangs]))
      await db.user.update({
        where: { id: existingUser.id },
        data: { languages: JSON.stringify(mergedLangs) },
      })
      await db.reviewerApplication.update({
        where: { id },
        data: { status: "approved", resolvedUserId: existingUser.id, adminNote: adminNote ?? null },
      })
      void sendReviewerApprovalEmail(application.fullName, application.email, null)
      return NextResponse.json({ ok: true, status: "approved", note: "User was already a reviewer" })
    }

    // Promote existing requester → reviewer
    const existingLangs: string[] = JSON.parse(existingUser.languages ?? "[]")
    const newLangs: string[] = JSON.parse(application.languagePairs)
    const mergedLangs = Array.from(new Set([...existingLangs, ...newLangs]))

    await db.user.update({
      where: { id: existingUser.id },
      data: { role: "reviewer", isPlatformReviewer: true, languages: JSON.stringify(mergedLangs) },
    })
    resolvedUserId = existingUser.id

    // Only create a password-set token if they have no login method
    const hasOAuth = await db.account.findFirst({ where: { userId: existingUser.id } })
    if (!existingUser.hashedPassword && !hasOAuth) {
      const token = crypto.randomBytes(32).toString("hex")
      await db.passwordResetToken.create({
        data: { email: application.email, token, expires: new Date(Date.now() + TOKEN_TTL_MS) },
      })
      setPasswordUrl = `${APP_URL}/reset-password?token=${token}`
    }
  } else {
    // No existing account — create new user with reviewer role
    const tempPassword = crypto.randomBytes(16).toString("hex")
    const hashedPassword = await bcrypt.hash(tempPassword, 12)
    const newUser = await db.user.create({
      data: {
        name: application.fullName,
        email: application.email,
        hashedPassword,
        role: "reviewer",
        isPlatformReviewer: true,
        languages: application.languagePairs,
      },
    })
    resolvedUserId = newUser.id

    // Create set-password token (48 hours)
    const token = crypto.randomBytes(32).toString("hex")
    await db.passwordResetToken.create({
      data: { email: application.email, token, expires: new Date(Date.now() + TOKEN_TTL_MS) },
    })
    setPasswordUrl = `${APP_URL}/reset-password?token=${token}`
  }

  await db.reviewerApplication.update({
    where: { id },
    data: { status: "approved", resolvedUserId, adminNote: adminNote ?? null },
  })

  try {
    await sendReviewerApprovalEmail(application.fullName, application.email, setPasswordUrl)
  } catch (err) {
    console.error("[reviewer-approve] Failed to send approval email:", err)
    return NextResponse.json({ ok: true, status: "approved", emailFailed: true })
  }

  return NextResponse.json({ ok: true, status: "approved" })
}
