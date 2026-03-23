import { NextRequest, NextResponse } from "next/server"

// ---------------------------------------------------------------------------
// Simple in-process rate limiter using a Map.
// On Cloud Run each instance is single-process, so this works well.
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

// ---------------------------------------------------------------------------
// Rate limit rules per path prefix
// ---------------------------------------------------------------------------

const RULES: Array<{ prefix: string; limit: number; windowMs: number; label: string }> = [
  // Auth endpoints — tightest limits to block brute force & credential stuffing
  { prefix: "/api/auth/signin",     limit: 10,  windowMs: 60_000,  label: "auth" },
  { prefix: "/api/auth/register",   limit: 5,   windowMs: 300_000, label: "register" },
  { prefix: "/api/auth/callback",   limit: 20,  windowMs: 60_000,  label: "auth-cb" },
  // Promo code validation — prevent enumeration
  { prefix: "/api/billing/promo",   limit: 10,  windowMs: 60_000,  label: "promo" },
  // Billing portal — prevent session flooding
  { prefix: "/api/billing/portal",  limit: 10,  windowMs: 60_000,  label: "portal" },
  // File upload / job creation — most expensive routes
  { prefix: "/api/translation-studio/jobs", limit: 20, windowMs: 60_000, label: "jobs" },
  { prefix: "/api/projects",        limit: 30,  windowMs: 60_000,  label: "projects" },
  // General API — broad fallback limit
  { prefix: "/api/",               limit: 120, windowMs: 60_000,  label: "api" },
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const ip = getIp(req)

  // Find the most specific matching rule
  const rule = RULES.find(r => pathname.startsWith(r.prefix))
  if (!rule) return NextResponse.next()

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

  return NextResponse.next()
}

export const config = {
  // Only run on API routes — skip static files, _next internals, etc.
  matcher: ["/api/:path*"],
}
