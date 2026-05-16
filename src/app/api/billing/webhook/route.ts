import { NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { db } from "@/lib/db"
import { PLANS } from "@/lib/plans"
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

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Determine planId from subscription metadata or fall back to price ID lookup
        const metaPlanId = subscription.metadata?.planId as string | undefined
        let resolvedPlanId: string
        if (metaPlanId && metaPlanId in PLANS) {
          resolvedPlanId = metaPlanId
        } else {
          const priceId = subscription.items.data[0]?.price?.id
          const planEntry = priceId
            ? Object.values(PLANS).find((p) => p.stripePriceId && p.stripePriceId === priceId)
            : undefined
          resolvedPlanId = planEntry?.id ?? "payg"
        }

        const quotaPlan = PLANS[resolvedPlanId as keyof typeof PLANS]
        const wordsQuota =
          quotaPlan && isFinite(quotaPlan.wordsPerMonth) ? quotaPlan.wordsPerMonth : 0

        await db.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            stripeSubscriptionId: subscription.id,
            plan: resolvedPlanId,
            subscriptionStatus: subscription.status,
            wordsQuota,
            wordsUsed: 0,
            billingPeriodStart: new Date(),
          },
        })
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        await db.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            subscriptionStatus: "canceled",
            plan: "free",
            wordsQuota: 0,
          },
        })
        break
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.customer) {
          // Reset usage window on subscription invoices (new billing period)
          const hasSubscription = !!(invoice as unknown as Record<string, unknown>).subscription
          await db.user.updateMany({
            where: { stripeCustomerId: invoice.customer as string },
            data: {
              subscriptionStatus: "active",
              ...(hasSubscription ? { wordsUsed: 0, billingPeriodStart: new Date() } : {}),
            },
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

      case "payment_intent.payment_failed": {
        // Fired when the monthly charge cron's off_session PaymentIntent fails
        const pi = event.data.object as Stripe.PaymentIntent
        if (pi.customer) {
          await db.user.updateMany({
            where: { stripeCustomerId: pi.customer as string },
            data: { subscriptionStatus: "past_due" },
          })
        }
        // Update the MonthlyCharge record if we can match by metadata
        const billingMonth = pi.metadata?.billingMonth
        const userId = pi.metadata?.userId
        if (userId && billingMonth) {
          await db.monthlyCharge.updateMany({
            where: { userId, billingMonth, status: "pending" },
            data: { status: "failed" },
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
