/**
 * Shared pricing constants — safe to import from both server and client code.
 * The Stripe SDK and secret key live in stripe.ts (server-only).
 */

/** AI API cost multiplier — charged on top of the platform fee */
export const PAYG_MARKUP = 5

/** Per-word platform service fee charged on every translated word */
export const PLATFORM_FEE_PER_WORD = 0.007

/** Minimum charge per translation job */
export const MIN_JOB_FEE = 5.00

/** Platform reviewer rate charged to the customer (per word of target text) */
export const PLATFORM_REVIEW_RATE = 0.055

/** Platform fee charged when the customer brings their own reviewer */
export const OWN_REVIEWER_PLATFORM_FEE = 0.01

/** Average words per translation unit — used for review fee estimation */
export const AVG_WORDS_PER_UNIT = 15
