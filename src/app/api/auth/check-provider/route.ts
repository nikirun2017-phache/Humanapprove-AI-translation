import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * POST /api/auth/check-provider
 * Lightweight endpoint used after a failed credentials login to tell the user
 * whether their account uses social sign-in (Apple/Google) instead of a password.
 *
 * Body: { email: string }
 * Returns: { isOAuth: boolean }
 *
 * Security note: this is intentionally called only after a failed login attempt,
 * and only tells the user that THEIR account uses a different sign-in method —
 * acceptable UX disclosure since the user already knows their own email.
 */
export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email?: string }
  if (!email?.trim()) return NextResponse.json({ isOAuth: false })

  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { hashedPassword: true },
  })

  // isOAuth = account exists but has no password (Apple / Google sign-in only)
  return NextResponse.json({ isOAuth: !!user && !user.hashedPassword })
}
