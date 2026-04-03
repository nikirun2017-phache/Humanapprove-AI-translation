import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { Navbar } from "@/components/navbar"
import { TranslationWizard } from "@/components/translation-wizard"
import { PROVIDER_INFO } from "@/lib/ai-providers/registry"
export const dynamic = "force-dynamic"

export default async function TranslationStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ card_added?: string; card_canceled?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.role === "reviewer") redirect("/dashboard")

  const { card_added, card_canceled } = await searchParams

  // Admins can always run translations; requesters need a card on file
  const role = session.user.role
  let hasCard = role === "admin"
  if (!hasCard) {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { subscriptionStatus: true, stripeCustomerId: true },
    })

    // If the webhook hasn't fired yet (common in dev), check Stripe directly
    // when the user returns from card setup and update the DB immediately.
    if (card_added === "true" && user?.stripeCustomerId && user.subscriptionStatus !== "active") {
      try {
        const pms = await stripe.customers.listPaymentMethods(user.stripeCustomerId, { limit: 1 })
        if (pms.data.length > 0) {
          await db.user.update({
            where: { id: session.user.id },
            data: { subscriptionStatus: "active", plan: "payg", subscriptionId: pms.data[0].id },
          })
          hasCard = true
        }
      } catch { /* fall through — webhook will catch it later */ }
    } else {
      hasCard = user?.subscriptionStatus === "active"
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Translation Studio</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Upload a file, pick your languages, and get AI-translated files ready to download.
          </p>
        </div>

{card_added === "true" && (
          <div className="mb-4 flex gap-2 bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm">
            <span>✓</span>
            <span>Payment method saved. You can now start translations.</span>
          </div>
        )}
        {card_canceled === "true" && (
          <div className="mb-4 flex gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
            <span>ℹ</span>
            <span>Card setup was canceled. A payment method is required to run AI translations.</span>
          </div>
        )}

        <TranslationWizard providers={PROVIDER_INFO} hasCard={hasCard} restoringFromCardSetup={card_added === "true"} />
      </main>
    </div>
  )
}
