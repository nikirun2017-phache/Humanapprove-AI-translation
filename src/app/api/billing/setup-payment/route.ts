import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { stripe } from "@/lib/stripe"

/**
 * POST /api/billing/setup-payment
 * Creates a Stripe Checkout session in "setup" mode so the user can attach a card.
 * On completion the webhook saves the PaymentMethod ID to user.subscriptionId.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await db.user.findUnique({ where: { id: session.user.id } })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    // Create or reuse Stripe customer
    let customerId = user.stripeCustomerId ?? undefined
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      })
      customerId = customer.id
      await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } })
    }

    const body = await req.json().catch(() => ({})) as { returnPath?: string }
    const returnPath = body.returnPath ?? "/billing"

    const origin = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000"

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "setup",
      payment_method_types: ["card"],
      success_url: `${origin}${returnPath}?card_added=true`,
      cancel_url: `${origin}${returnPath}?card_canceled=true`,
      metadata: { userId: user.id },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error"
    console.error("[setup-payment]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
