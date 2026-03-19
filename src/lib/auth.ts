import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import Apple from "next-auth/providers/apple"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
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
        if (account?.provider === "google" || account?.provider === "apple") {
          // OAuth: look up our DB user to get id, role, etc.
          const dbUser = await db.user.findUnique({ where: { email: token.email! } })
          if (dbUser) {
            token.id = dbUser.id
            token.role = dbUser.role
            token.languages = dbUser.languages
            token.plan = dbUser.plan
            token.subscriptionStatus = dbUser.subscriptionStatus
          }
        } else {
          // Credentials: user object already has everything
          token.id = user.id
          token.role = (user as { role?: string }).role
          token.languages = (user as { languages?: string }).languages
          token.plan = (user as { plan?: string }).plan
          token.subscriptionStatus = (user as { subscriptionStatus?: string }).subscriptionStatus
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
