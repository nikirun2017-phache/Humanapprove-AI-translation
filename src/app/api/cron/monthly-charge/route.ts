import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { computeJobCharge } from "@/lib/billing-calculator"

export const maxDuration = 300 // 5 min — may need to process many users

const MIN_CHARGE_CENTS = 50 // Stripe minimum is $0.50

/**
 * POST /api/cron/monthly-charge
 * Called by Vercel Cron (or Cloud Scheduler) on the 1st of each month at 00:05 UTC.
 * Charges each active user for their prior month's translation usage.
 *
 * Secured by CRON_SECRET env var — set Authorization: Bearer <CRON_SECRET> in the cron config.
 * Idempotent: re-running for the same month is safe due to @@unique([userId, billingMonth]).
 */
export async function POST(req: NextRequest) {
  // Authenticate the cron caller
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[monthly-charge] CRON_SECRET not set")
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
  }
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Compute the billing period: previous calendar month
  const now = new Date()
  const billingYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const billingMonthNum = now.getMonth() === 0 ? 12 : now.getMonth()
  const billingMonth = `${billingYear}-${String(billingMonthNum).padStart(2, "0")}`
  const periodStart = new Date(billingYear, billingMonthNum - 1, 1)
  const periodEnd = new Date(billingYear, billingMonthNum, 1)

  console.log(`[monthly-charge] Processing billing month: ${billingMonth}`)

  // Load all active paying users
  const users = await db.user.findMany({
    where: {
      subscriptionStatus: "active",
      stripeCustomerId: { not: null },
      subscriptionId: { not: null },
    },
    select: {
      id: true,
      email: true,
      stripeCustomerId: true,
      subscriptionId: true, // stores PaymentMethod ID
    },
  })

  const results = { charged: 0, skipped: 0, failed: 0, alreadyCharged: 0 }

  for (const user of users) {
    try {
      // Skip if already charged this month (idempotency)
      const existing = await db.monthlyCharge.findUnique({
        where: { userId_billingMonth: { userId: user.id, billingMonth } },
      })
      if (existing?.status === "charged") {
        results.alreadyCharged++
        continue
      }

      // Load completed jobs for this user in the billing period
      const jobs = await db.translationJob.findMany({
        where: {
          createdById: user.id,
          createdAt: { gte: periodStart, lt: periodEnd },
        },
        include: {
          tasks: {
            where: { status: { in: ["completed", "imported"] } },
            select: { totalUnits: true, wordCount: true },
          },
        },
      })

      // Compute total charge across all jobs
      let totalCents = 0
      for (const job of jobs) {
        if (job.tasks.length === 0) continue
        const tasks = job.tasks.map(t => ({ ...t, model: job.model }))
        const { netCents } = computeJobCharge(tasks, job.discountPct)
        totalCents += netCents
      }

      if (totalCents < MIN_CHARGE_CENTS) {
        results.skipped++
        // Record as waived so we don't attempt again
        await db.monthlyCharge.upsert({
          where: { userId_billingMonth: { userId: user.id, billingMonth } },
          create: { userId: user.id, billingMonth, amountCents: totalCents, status: "waived" },
          update: {},
        })
        continue
      }

      // Upsert MonthlyCharge row as pending before charging (crash-safety)
      await db.monthlyCharge.upsert({
        where: { userId_billingMonth: { userId: user.id, billingMonth } },
        create: { userId: user.id, billingMonth, amountCents: totalCents, status: "pending" },
        update: { amountCents: totalCents, status: "pending" },
      })

      // Fire Stripe charge against the saved PaymentMethod
      const paymentMethodId = user.subscriptionId! // stored in the legacy subscriptionId field
      const intent = await stripe.paymentIntents.create({
        amount: totalCents,
        currency: "usd",
        customer: user.stripeCustomerId!,
        payment_method: paymentMethodId,
        confirm: true,
        off_session: true, // charge without the user present
        description: `Summon Translator — ${billingMonth} translation usage`,
        metadata: { userId: user.id, billingMonth },
      })

      await db.monthlyCharge.update({
        where: { userId_billingMonth: { userId: user.id, billingMonth } },
        data: {
          status: "charged",
          stripeIntentId: intent.id,
          chargedAt: new Date(),
        },
      })

      results.charged++
      console.log(`[monthly-charge] Charged ${user.email}: $${(totalCents / 100).toFixed(2)} (${intent.id})`)
    } catch (err) {
      results.failed++
      console.error(`[monthly-charge] Failed for user ${user.id}:`, err)

      // Mark as failed and set user to past_due
      await db.monthlyCharge.upsert({
        where: { userId_billingMonth: { userId: user.id, billingMonth } },
        create: { userId: user.id, billingMonth, amountCents: 0, status: "failed" },
        update: { status: "failed" },
      }).catch(() => {})

      await db.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: "past_due" },
      }).catch(() => {})
    }
  }

  console.log(`[monthly-charge] Done: ${JSON.stringify(results)}`)
  return NextResponse.json({ billingMonth, ...results })
}
