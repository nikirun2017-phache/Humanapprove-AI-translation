import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      languages: string
    }
  }

  interface User {
    id: string
    role?: string
    languages?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    languages: string
  }
}
