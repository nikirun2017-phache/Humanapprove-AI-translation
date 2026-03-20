// SERVER-ONLY — never import from "use client" modules
import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2026-02-25.clover",
})

/**
 * Pricing model — targeting 50% gross margin (revenue = 1.5× all costs).
 *
 * Cost structure (monthly, ~50 jobs × 2 K words):
 *   Infrastructure (Cloudflare CDN + R2 + DB + hosting): ~$75 fixed
 *   AI API pass-through:                                   variable
 *   Platform reviewer payouts ($0.022/word):               variable
 *   Stripe fees (2.9 % + $0.30/charge):                    variable
 *
 * Revenue levers:
 *   1. AI markup (PAYG_MARKUP × raw API cost)
 *   2. Per-word platform service fee (covers infra regardless of AI cost)
 *   3. Platform reviewer margin ($0.055 charged − $0.022 payout = $0.033/word)
 *
 * Verified at 50 jobs / 2 K words:
 *   Revenue: $4.50 AI markup + $700 platform fee + $1,650 review = $2,354
 *   Costs:   $0.90 API + $75 infra + $660 reviewer + $68 Stripe = $804
 *   Margin:  66 %  ✓
 */

/** AI API cost multiplier — charged on top of the platform fee */
export const PAYG_MARKUP = 5

/**
 * Per-word platform service fee charged on every translated word.
 * Covers hosting, database, Cloudflare, and support overhead.
 * Applied regardless of which AI model is used.
 */
export const PLATFORM_FEE_PER_WORD = 0.007

/**
 * Minimum charge per translation job.
 * Prevents very small jobs from under-contributing to fixed costs.
 */
export const MIN_JOB_FEE = 5.00

/**
 * Platform reviewer rate charged to the customer (per word of target text).
 * Jendee AI sources and pays the reviewer at ~$0.022/word — earning ~60 % margin.
 */
export const PLATFORM_REVIEW_RATE = 0.055

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

/** Average words per translation unit — used for review fee estimation */
export const AVG_WORDS_PER_UNIT = 15

/**
 * Platform fee charged when the customer brings their own reviewer.
 * Covers review editor infrastructure (sessions, audit trail, export).
 */
export const OWN_REVIEWER_PLATFORM_FEE = 0.01
