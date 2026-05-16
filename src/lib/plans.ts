export type PlanId = "free" | "starter" | "growth" | "business" | "payg"

export interface Plan {
  id: PlanId
  name: string
  price: number          // USD/month (0 = free)
  wordsPerMonth: number  // quota in words
  stripePriceId: string  // env var name (empty for free/payg)
  popular?: boolean
  features: string[]
  cta: string
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free Trial",
    price: 0,
    wordsPerMonth: 10_000,
    stripePriceId: "",
    features: [
      "10,000 words — one time",
      "All 20+ file formats",
      "15+ CMS integrations",
      "LQA Studio",
      "Media subtitle translation",
    ],
    cta: "Start free",
  },
  starter: {
    id: "starter",
    name: "Starter",
    price: 49,
    wordsPerMonth: 50_000,
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID ?? "",
    features: [
      "50,000 words / month",
      "Translation Memory",
      "Glossary management",
      "All file formats & integrations",
      "LQA Studio",
    ],
    cta: "Start Starter",
  },
  growth: {
    id: "growth",
    name: "Growth",
    price: 199,
    wordsPerMonth: 250_000,
    stripePriceId: process.env.STRIPE_GROWTH_PRICE_ID ?? "",
    popular: true,
    features: [
      "250,000 words / month",
      "Everything in Starter",
      "Priority AI model access",
      "Customer usage analytics",
      "Email support",
    ],
    cta: "Start Growth",
  },
  business: {
    id: "business",
    name: "Business",
    price: 599,
    wordsPerMonth: 1_000_000,
    stripePriceId: process.env.STRIPE_BUSINESS_PRICE_ID ?? "",
    features: [
      "1,000,000 words / month",
      "Everything in Growth",
      "REST API access",
      "Priority support",
      "Custom integrations",
    ],
    cta: "Start Business",
  },
  payg: {
    id: "payg",
    name: "Pay-as-you-go",
    price: 0,
    wordsPerMonth: Infinity,
    stripePriceId: "",
    features: [
      "No monthly commitment",
      "Pay per translated word",
      "All file formats & integrations",
      "LQA Studio",
    ],
    cta: "Add card",
  },
}

/** Words quota remaining for a user */
export function wordsRemaining(wordsQuota: number, wordsUsed: number): number {
  return Math.max(0, wordsQuota - wordsUsed)
}

/** Whether a plan has a fixed monthly word quota */
export function hasQuota(planId: PlanId): boolean {
  return planId === "free" || planId === "starter" || planId === "growth" || planId === "business"
}

/** Human-friendly word count display, e.g. "50,000" or "Unlimited" */
export function formatWords(n: number): string {
  if (!isFinite(n)) return "Unlimited"
  return n.toLocaleString("en-US")
}
