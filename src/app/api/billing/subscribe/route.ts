import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { PLANS } from "@/lib/plans"
import type { PlanId } from "@/lib/plans"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json() as { planId?: string }
    const planId = body.planId as PlanId | undefined

    if (!planId || !["starter", "growth", "business"].includes(planId)) {
      return NextResponse.json(
        { error: "planId must be one of: starter, growth, business" },
        { status: 400 }
      )
    }

    const plan = PLANS[planId]
    if (!plan.stripePriceId) {
      return NextResponse.json(
        { error: `No Stripe price configured for plan: ${planId}` },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Create or reuse Stripe customer
    let customerId = user.stripeCustomerId ?? undefined
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name ?? undefined,
        metadata: { userId: user.id },
      })
      customerId = customer.id
      await db.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      })
    }

    const origin =
      req.headers.get("origin") ??
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXTAUTH_URL ??
      "https://app.summontranslator.com"

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${origin}/billing?subscribed=${planId}`,
      cancel_url: `${origin}/pricing?canceled=true`,
      metadata: { userId: user.id, planId },
      subscription_data: {
        metadata: { userId: user.id, planId },
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error"
    console.error("[billing/subscribe]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
