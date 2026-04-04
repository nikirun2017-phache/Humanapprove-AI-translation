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
  const { action } = (await req.json()) as { action: string }

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 })
  }

  const application = await db.reviewerApplication.findUnique({ where: { id } })
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (application.status !== "pending") {
    return NextResponse.json({ error: "Application has already been processed" }, { status: 409 })
  }

  // ── REJECT ──────────────────────────────────────────────────────────────
  if (action === "reject") {
    await db.reviewerApplication.update({
      where: { id },
      data: { status: "rejected" },
    })
    void sendReviewerRejectionEmail(application.fullName, application.email)
    return NextResponse.json({ ok: true, status: "rejected" })
  }

  // ── APPROVE ─────────────────────────────────────────────────────────────
  const existingUser = await db.user.findUnique({ where: { email: application.email } })

  let resolvedUserId: string
  let setPasswordUrl: string | null = null

  if (existingUser) {
    // Already a reviewer — nothing to do role-wise
    if (existingUser.role === "reviewer") {
      await db.reviewerApplication.update({
        where: { id },
        data: { status: "approved", resolvedUserId: existingUser.id },
      })
      // Still send approval email (they may be waiting to hear back)
      void sendReviewerApprovalEmail(application.fullName, application.email, null)
      return NextResponse.json({ ok: true, status: "approved", note: "User was already a reviewer" })
    }

    // Promote existing user to reviewer; also set their language pairs
    const existingLangs: string[] = JSON.parse(existingUser.languages ?? "[]")
    const newLangs: string[] = JSON.parse(application.languagePairs)
    const mergedLangs = Array.from(new Set([...existingLangs, ...newLangs]))

    await db.user.update({
      where: { id: existingUser.id },
      data: {
        role: "reviewer",
        isPlatformReviewer: true,
        languages: JSON.stringify(mergedLangs),
      },
    })
    resolvedUserId = existingUser.id

    // If they have no password and no OAuth account, create a reset token
    const hasOAuth = await db.account.findFirst({ where: { userId: existingUser.id } })
    if (!existingUser.hashedPassword && !hasOAuth) {
      const token = crypto.randomBytes(32).toString("hex")
      await db.passwordResetToken.create({
        data: { email: application.email, token, expires: new Date(Date.now() + 60 * 60 * 1000) },
      })
      setPasswordUrl = `${APP_URL}/reset-password?token=${token}`
    }
  } else {
    // Create new user with reviewer role
    const tempPassword = crypto.randomBytes(16).toString("hex")
    const hashedPassword = await bcrypt.hash(tempPassword, 12)

    const newUser = await db.user.create({
      data: {
        name: application.fullName,
        email: application.email,
        hashedPassword,
        role: "reviewer",
        isPlatformReviewer: true,
        languages: application.languagePairs, // already JSON string
      },
    })
    resolvedUserId = newUser.id

    // Create set-password token (expires 1 hour)
    const token = crypto.randomBytes(32).toString("hex")
    await db.passwordResetToken.create({
      data: { email: application.email, token, expires: new Date(Date.now() + 60 * 60 * 1000) },
    })
    setPasswordUrl = `${APP_URL}/reset-password?token=${token}`
  }

  await db.reviewerApplication.update({
    where: { id },
    data: { status: "approved", resolvedUserId },
  })

  // Await the approval email so we can report failure
  try {
    await sendReviewerApprovalEmail(application.fullName, application.email, setPasswordUrl)
  } catch (err) {
    console.error("[reviewer-approve] Failed to send approval email:", err)
    return NextResponse.json({ ok: true, status: "approved", emailFailed: true })
  }

  return NextResponse.json({ ok: true, status: "approved" })
}
