// SERVER-ONLY — never import from "use client" modules
import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2026-02-25.clover",
})

// Re-export shared pricing constants (also available client-side via @/lib/pricing)
export {
  PAYG_MARKUP,
  PLATFORM_FEE_PER_WORD,
  MIN_JOB_FEE,
  PLATFORM_REVIEW_RATE,
  OWN_REVIEWER_PLATFORM_FEE,
  AVG_WORDS_PER_UNIT,
} from "@/lib/pricing"

/**
 * Light review rate — informational estimate for users budgeting
 * their own reviewer costs. Not invoiced by Jendee AI.
 */
export const LIGHT_REVIEW_RATE = 0.035

/**
 * Full LQA rate — informational estimate for full linguistic QA
 * with error categorisation. Not invoiced by Jendee AI.
 */
export const FULL_LQA_RATE = 0.090
