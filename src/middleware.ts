import { NextRequest, NextResponse } from "next/server"
import createMiddleware from "next-intl/middleware"
import { routing } from "./i18n/routing"

// ---------------------------------------------------------------------------
// Locale routing (next-intl)
// ---------------------------------------------------------------------------

const intlMiddleware = createMiddleware(routing)

// ---------------------------------------------------------------------------
// Simple in-process rate limiter.
// Cloud Run instances are single-process, so a Map works well.
// For multi-instance setups, replace with Redis (e.g. Upstash).
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Periodically clean up expired entries to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 60_000)

function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfter: 0 }
  }

  entry.count++
  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return { allowed: false, retryAfter }
  }

  return { allowed: true, retryAfter: 0 }
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  )
}

// Rate limit rules per path prefix (most specific first)
const RULES: Array<{ prefix: string; limit: number; windowMs: number; label: string }> = [
  { prefix: "/api/auth/signin",             limit: 10,  windowMs: 60_000,  label: "auth" },
  { prefix: "/api/auth/register",           limit: 5,   windowMs: 300_000, label: "register" },
  { prefix: "/api/auth/forgot-password",    limit: 5,   windowMs: 300_000, label: "forgot-pw" },
  { prefix: "/api/auth/reset-password",     limit: 10,  windowMs: 300_000, label: "reset-pw" },
  { prefix: "/api/auth/callback",           limit: 20,  windowMs: 60_000,  label: "auth-cb" },
  { prefix: "/api/billing/promo",           limit: 10,  windowMs: 60_000,  label: "promo" },
  { prefix: "/api/billing/portal",          limit: 10,  windowMs: 60_000,  label: "portal" },
  { prefix: "/api/translation-studio/jobs", limit: 20,  windowMs: 60_000,  label: "jobs" },
  { prefix: "/api/projects",               limit: 30,  windowMs: 60_000,  label: "projects" },
  { prefix: "/api/",                        limit: 120, windowMs: 60_000,  label: "api" },
]

// ---------------------------------------------------------------------------
// Combined middleware
// ---------------------------------------------------------------------------

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Apply rate limiting to all API routes
  if (pathname.startsWith("/api/")) {
    const ip = getIp(req)
    const rule = RULES.find(r => pathname.startsWith(r.prefix))

    if (rule) {
      const key = `${rule.label}:${ip}`
      const { allowed, retryAfter } = rateLimit(key, rule.limit, rule.windowMs)

      if (!allowed) {
        return new NextResponse(
          JSON.stringify({ error: "Too many requests. Please wait before trying again." }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(retryAfter),
              "X-RateLimit-Limit": String(rule.limit),
            },
          }
        )
      }
    }

    return NextResponse.next()
  }

  // Apply locale routing for non-API routes
  return intlMiddleware(req)
}

export const config = {
  matcher: [
    // API routes — rate limiting
    "/api/:path*",
    // Locale routes (from proxy.ts)
    "/",
    "/login",
    "/vision",
    "/privacy",
    "/terms",
    "/forgot-password",
    "/reset-password",
    "/(en-US|en-CA|en-GB|en-AU|en-IN|es-ES|es-419|pt-BR|fr-FR|fr-CA|de-DE|it-IT|nl-NL|sv-SE|ja-JP|zh-CN|zh-TW|ko-KR|th-TH)/:path*",
  ],
}
