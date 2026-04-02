// SERVER-ONLY — never import from "use client" modules
import { createHash, randomBytes } from "crypto"
import { db } from "./db"

const KEY_PREFIX = "st_live_"

/** Generate a new random API key. Returns the raw key (shown once) plus its hash and display prefix. */
export function generateUserApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const raw = KEY_PREFIX + randomBytes(32).toString("base64url")
  return {
    rawKey: raw,
    keyHash: hashKey(raw),
    keyPrefix: raw.slice(0, 16), // "st_live_" + 8 chars
  }
}

/** SHA-256 hex of the raw key — the only value stored in the database. */
export function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex")
}

/**
 * Validate an incoming Bearer token.
 * Returns the user + apiKey record on success, null if the key is unknown or revoked.
 * Also updates lastUsedAt on every successful lookup.
 */
export async function validateUserApiKey(
  rawKey: string
): Promise<{ user: { id: string; role: string; subscriptionId: string | null; subscriptionStatus: string; stripeCustomerId: string | null }; apiKeyId: string } | null> {
  if (!rawKey.startsWith(KEY_PREFIX)) return null

  const hash = hashKey(rawKey)

  const apiKey = await db.apiKey.findUnique({
    where: { keyHash: hash },
    include: {
      user: {
        select: {
          id: true,
          role: true,
          subscriptionId: true,
          subscriptionStatus: true,
          stripeCustomerId: true,
        },
      },
    },
  })

  if (!apiKey || apiKey.revokedAt !== null) return null

  // Update lastUsedAt without blocking the request
  void db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  })

  return { user: apiKey.user, apiKeyId: apiKey.id }
}
