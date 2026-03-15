// SERVER-ONLY — never import from "use client" modules
import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2026-02-25.clover",
})

export const PLANS = {
  free: {
    id: "free",
    label: "Free",
    price: 0,
    priceLabel: "Free forever",
    description: "Get started with basic translation review",
    features: [
      "Up to 3 active projects",
      "1 reviewer",
      "Basic XLIFF review",
      "Community support",
    ],
    stripePriceId: null,
  },
  basic: {
    id: "basic",
    label: "Basic",
    price: 5,
    priceLabel: "$5 / month",
    description: "For individuals and small teams getting started",
    features: [
      "Up to 10 active projects",
      "Up to 3 reviewers",
      "XLIFF review & export",
      "Translation Studio (AI translation)",
      "Email support",
    ],
    stripePriceId: process.env.STRIPE_BASIC_PRICE_ID ?? null,
  },
  pro: {
    id: "pro",
    label: "Pro",
    price: 29,
    priceLabel: "$29 / month",
    description: "For growing teams with active translation workflows",
    features: [
      "Unlimited projects",
      "Up to 10 reviewers",
      "Translation Studio (AI translation)",
      "Priority email support",
      "Advanced analytics",
      "Reviewer assignment & tracking",
    ],
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? null,
  },
  enterprise: {
    id: "enterprise",
    label: "Enterprise",
    price: 99,
    priceLabel: "$99 / month",
    description: "For large teams needing full control and SLAs",
    features: [
      "Everything in Pro",
      "Unlimited reviewers",
      "PDF translation with Vision AI",
      "Dedicated success manager",
      "SLA — 99.9% uptime guarantee",
      "SSO & advanced permissions",
      "Custom integrations",
    ],
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? null,
  },
} as const

export type PlanId = keyof typeof PLANS
