import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// Normalize sslmode to 'verify-full' to avoid the pg v8 deprecation warning
// ("prefer"/"require"/"verify-ca" will change semantics in pg v9).
function getConnectionString() {
  const url = process.env.DATABASE_URL!
  if (url?.includes("sslmode=")) {
    return url.replace(/sslmode=[^&?#]+/, "sslmode=verify-full")
  }
  return url
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: getConnectionString() })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
