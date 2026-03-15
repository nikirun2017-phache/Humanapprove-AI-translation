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

        if (!userId) break

        if (session.mode === "setup" && session.setup_intent) {
          // User attached a card — save the PaymentMethod ID
          const setupIntent = await stripe.setupIntents.retrieve(session.setup_intent as string)
          const paymentMethodId = setupIntent.payment_method as string | null
          if (paymentMethodId) {
            await db.user.update({
              where: { id: userId },
              data: {
                subscriptionId: paymentMethodId,   // reuse field to store PM ID
                subscriptionStatus: "active",
                plan: "payg",
                stripeCustomerId: session.customer as string,
              },
            })
          }
        }
        break
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.customer) {
          await db.user.updateMany({
            where: { stripeCustomerId: invoice.customer as string },
            data: { subscriptionStatus: "active" },
          })
        }
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
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
