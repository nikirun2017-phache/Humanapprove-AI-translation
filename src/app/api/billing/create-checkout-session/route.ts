import { NextResponse } from "next/server"

// Subscription-based checkout has been replaced by pay-as-you-go.
// Use POST /api/billing/setup-payment to attach a card instead.
export async function POST() {
  return NextResponse.json({ error: "Subscription plans are no longer available. Use /api/billing/setup-payment to attach a card." }, { status: 410 })
}
