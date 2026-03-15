import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { stripe, PLANS } from "@/lib/stripe"
import type { PlanId } from "@/lib/stripe"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { planId } = await req.json() as { planId: PlanId }
  const plan = PLANS[planId]
  if (!plan || plan.id === "free" || !plan.stripePriceId) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  // Create or reuse a Stripe customer
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

  const origin = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000"

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${origin}/billing?success=true&plan=${planId}`,
    cancel_url: `${origin}/billing?canceled=true`,
    metadata: { userId: user.id, planId },
    subscription_data: { metadata: { userId: user.id, planId } },
  })

  return NextResponse.json({ url: checkoutSession.url })
}
