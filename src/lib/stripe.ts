// SERVER-ONLY — never import from "use client" modules
import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2026-02-25.clover",
})

/** Platform markup: user is billed this many × the raw AI API cost */
export const PAYG_MARKUP = 30
