import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { db } from "@/lib/db"
import type Stripe from "stripe"

export const runtime = "nodejs"

// Disable body parsing — Stripe needs the raw body to verify signatures
export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature")
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing Stripe signature or webhook secret" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const rawBody = await req.text()
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature failed: ${(err as Error).message}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.userId
        const planId = session.metadata?.planId
        const subscriptionId = session.subscription as string | null
        if (userId && planId) {
          await db.user.update({
            where: { id: userId },
            data: {
              plan: planId,
              subscriptionStatus: "active",
              subscriptionId: subscriptionId ?? undefined,
              stripeCustomerId: session.customer as string,
            },
          })
        }
        break
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.userId
        if (userId) {
          const status = sub.status // active | past_due | canceled | trialing | etc.
          const planId = (sub.metadata?.planId ?? "free") as string
          await db.user.update({
            where: { id: userId },
            data: {
              subscriptionStatus: status,
              plan: status === "active" || status === "trialing" ? planId : "free",
              subscriptionId: sub.id,
            },
          })
        }
        break
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.userId
        if (userId) {
          await db.user.update({
            where: { id: userId },
            data: { plan: "free", subscriptionStatus: "canceled", subscriptionId: null },
          })
        }
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        // Find user by Stripe customer ID
        if (invoice.customer) {
          await db.user.updateMany({
            where: { stripeCustomerId: invoice.customer as string },
            data: { subscriptionStatus: "past_due" },
          })
        }
        break
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
