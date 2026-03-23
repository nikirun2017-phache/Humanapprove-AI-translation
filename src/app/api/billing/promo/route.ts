import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// POST /api/billing/promo — validate a promo code
// Body: { code: string }
// Returns: { valid: true, discountPct: number, code: string } or { valid: false, error: string }
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { code } = await req.json() as { code?: string }
  if (!code?.trim()) {
    return NextResponse.json({ valid: false, error: "Please enter a promo code" })
  }

  const promo = await db.promoCode.findUnique({
    where: { code: code.trim().toUpperCase() },
  })

  if (!promo || !promo.active) {
    return NextResponse.json({ valid: false, error: "Invalid promo code" })
  }
  if (promo.expiresAt && promo.expiresAt < new Date()) {
    return NextResponse.json({ valid: false, error: "This promo code has expired" })
  }
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    return NextResponse.json({ valid: false, error: "This promo code has reached its usage limit" })
  }

  return NextResponse.json({ valid: true, discountPct: promo.discountPct, code: promo.code })
}
