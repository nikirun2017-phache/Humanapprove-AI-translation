// SERVER-ONLY
import { NextResponse } from "next/server"

interface UserBillingFields {
  subscriptionStatus: string
  subscriptionId: string | null
}

/**
 * Returns a 402 NextResponse if the user has no payment method on file.
 * Returns null if the check passes (user can proceed).
 */
export function requirePaymentMethod(user: UserBillingFields): NextResponse | null {
  if (user.subscriptionStatus === "active" && user.subscriptionId) return null
  return NextResponse.json(
    {
      error: "No payment method on file",
      message:
        "Add a payment method at https://summontranslator.com/billing before using the API.",
    },
    { status: 402 }
  )
}
