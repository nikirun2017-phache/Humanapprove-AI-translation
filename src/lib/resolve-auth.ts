// SERVER-ONLY — never import from "use client" modules
import { NextRequest } from "next/server"
import { auth } from "./auth"
import { validateUserApiKey } from "./user-api-keys"

export type AuthResult =
  | {
      kind: "session"
      user: { id: string; role: string; subscriptionId?: string | null; subscriptionStatus?: string; stripeCustomerId?: string | null }
    }
  | {
      kind: "apikey"
      user: { id: string; role: string; subscriptionId: string | null; subscriptionStatus: string; stripeCustomerId: string | null }
      apiKeyId: string
    }
  | { kind: "unauthenticated" }

/**
 * Resolves the caller's identity from either a Bearer API key or a session cookie.
 * API key takes precedence. Falls back to NextAuth session.
 */
export async function resolveAuth(req: NextRequest): Promise<AuthResult> {
  const authHeader = req.headers.get("authorization")
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim()
    const result = await validateUserApiKey(token)
    if (result) {
      return { kind: "apikey", user: result.user, apiKeyId: result.apiKeyId }
    }
    // Bearer header present but invalid — return unauthenticated immediately
    // (don't fall through to session; wrong key should not silently use a session)
    return { kind: "unauthenticated" }
  }

  const session = await auth()
  if (session?.user) {
    return { kind: "session", user: session.user }
  }

  return { kind: "unauthenticated" }
}

/** Convenience: returns userId if authenticated, otherwise null. */
export function getUserId(auth: AuthResult): string | null {
  return auth.kind === "unauthenticated" ? null : auth.user.id
}
