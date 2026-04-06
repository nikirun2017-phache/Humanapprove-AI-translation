import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const securityHeaders = [
  // Prevent browsers from MIME-sniffing the content type
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Block the page from loading in an iframe (clickjacking protection)
  { key: "X-Frame-Options", value: "DENY" },
  // Enforce HTTPS for 1 year (including subdomains)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  // Enable XSS filter in legacy browsers
  { key: "X-XSS-Protection", value: "1; mode=block" },
  // Control cross-origin information leakage in Referer header
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Restrict browser features (camera, mic, geolocation, etc.)
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  // Content Security Policy — restricts where scripts/styles/etc. can load from
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js inline scripts + Google Sign-In
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com",
      // Tailwind inline styles + Radix UI
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      // Images: self, data URIs, and Stripe hosted images
      "img-src 'self' data: https://*.stripe.com",
      // API calls: self only (all external API calls go through our server routes)
      "connect-src 'self'",
      // Google OAuth frames + same-origin iframes (portfolio page)
      "frame-src 'self' https://accounts.google.com https://js.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
]

const nextConfig: NextConfig = {
  output: "standalone",
  headers: async () => [
    {
      // Apply to all routes
      source: "/(.*)",
      headers: securityHeaders,
    },
    {
      // Allow portfolio files to be embedded in iframes (same origin)
      source: "/(high-voltage-safety-course|rio-tinto-yarwun)(.+)?",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data:",
            "connect-src 'self'",
            "frame-src 'none'",
            "object-src 'none'",
            "base-uri 'self'",
          ].join("; "),
        },
      ],
    },
  ],
}

export default withNextIntl(nextConfig)
