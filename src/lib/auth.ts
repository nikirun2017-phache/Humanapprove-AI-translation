import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import Apple from "next-auth/providers/apple"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

const isProd = process.env.NODE_ENV === "production"

export const { handlers, signIn, signOut, auth } = NextAuth({
  cookies: {
    // OAuth flow cookies — must survive cross-site redirects (Google → our domain).
    // sameSite:"none" requires secure:true in production; in dev (HTTP localhost)
    // secure must be false or the browser silently drops the cookie.
    pkceCodeVerifier: {
      name: "authjs.pkce.code_verifier",
      options: { httpOnly: true, sameSite: isProd ? "none" : "lax", path: "/", secure: isProd },
    },
    state: {
      name: "authjs.state",
      options: { httpOnly: true, sameSite: isProd ? "none" : "lax", path: "/", secure: isProd },
    },
    // Session & CSRF
    sessionToken: {
      name: "authjs.session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: isProd },
    },
    csrfToken: {
      name: "authjs.csrf-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: isProd },
    },
    callbackUrl: {
      name: "authjs.callback-url",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: isProd },
    },
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      checks: ["state"], // PKCE not needed for server-side confidential clients
    }),
    Apple({
      clientId: process.env.AUTH_APPLE_ID ?? "",
      clientSecret: process.env.AUTH_APPLE_SECRET ?? "",
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.hashedPassword) return null

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.hashedPassword
        )

        if (!isValid) return null

        // Block login if the user has a pending email verification token.
        // Existing users (created before this feature) have no token → allowed through.
        const pendingVerification = await db.verificationToken.findFirst({
          where: { identifier: user.email },
        })
        if (pendingVerification) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          languages: user.languages,
          plan: user.plan,
          subscriptionStatus: user.subscriptionStatus,
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account }) {
      // For OAuth providers, auto-create the user in our DB if they don't exist
      if (account?.provider === "google" || account?.provider === "apple") {
        if (!user.email) return false
        const existing = await db.user.findUnique({ where: { email: user.email } })
        if (!existing) {
          await db.user.create({
            data: {
              email: user.email,
              name: user.name ?? user.email.split("@")[0],
              role: "requester",
            },
          })
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        // ── First sign-in: populate token from DB ─────────────────────────
        if (account?.provider === "google" || account?.provider === "apple") {
          const dbUser = await db.user.findUnique({ where: { email: token.email! } })
          if (dbUser) {
            token.id = dbUser.id
            token.role = dbUser.role
            token.languages = dbUser.languages
            token.plan = dbUser.plan
            token.subscriptionStatus = dbUser.subscriptionStatus
          }
        } else {
          token.id = user.id
          token.role = (user as { role?: string }).role
          token.languages = (user as { languages?: string }).languages
          token.plan = (user as { plan?: string }).plan
          token.subscriptionStatus = (user as { subscriptionStatus?: string }).subscriptionStatus
        }
      } else if (token.id) {
        // ── Subsequent requests: re-sync role/plan from DB ────────────────
        // Throttled to once every 5 minutes to avoid a DB round-trip on every
        // page load. Wrapped in try-catch so a transient DB error (e.g. Neon
        // waking from sleep, connection pool exhausted) never invalidates an
        // otherwise-valid session — NextAuth swallows JWT callback exceptions
        // silently and returns null for the session.
        const now = Math.floor(Date.now() / 1000)
        const lastSync = (token.dbSyncedAt as number | undefined) ?? 0
        if (now - lastSync > 300) {
          try {
            const dbUser = await db.user.findUnique({
              where: { id: token.id as string },
              select: { role: true, languages: true, plan: true, subscriptionStatus: true },
            })
            if (dbUser) {
              token.role = dbUser.role
              token.languages = dbUser.languages
              token.plan = dbUser.plan
              token.subscriptionStatus = dbUser.subscriptionStatus
              token.dbSyncedAt = now
            }
          } catch (err) {
            console.error("[jwt] DB re-sync failed — keeping cached token values:", err)
            // Do NOT rethrow: a DB error must not log users out
          }
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.languages = token.languages as string
        ;(session.user as { plan?: string }).plan = token.plan as string
        ;(session.user as { subscriptionStatus?: string }).subscriptionStatus = token.subscriptionStatus as string
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
})
