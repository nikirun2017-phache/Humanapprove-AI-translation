import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateUserApiKey } from "@/lib/user-api-keys"

// GET /api/account/api-keys — list caller's API keys (session auth only)
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const keys = await db.apiKey.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(keys)
}

// POST /api/account/api-keys — create a new API key (session auth only)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Reviewers cannot create API keys
  if (session.user.role === "reviewer") {
    return NextResponse.json({ error: "Reviewers cannot create API keys" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as { name?: string }
  const name = typeof body.name === "string" ? body.name.trim() : ""
  if (!name) return NextResponse.json({ error: "Key name is required" }, { status: 400 })
  if (name.length > 64) return NextResponse.json({ error: "Key name must be 64 characters or fewer" }, { status: 400 })

  // Limit to 10 active keys per user
  const activeCount = await db.apiKey.count({
    where: { userId: session.user.id, revokedAt: null },
  })
  if (activeCount >= 10) {
    return NextResponse.json({ error: "Maximum of 10 active API keys allowed" }, { status: 400 })
  }

  const { rawKey, keyHash, keyPrefix } = generateUserApiKey()

  const apiKey = await db.apiKey.create({
    data: {
      userId: session.user.id,
      name,
      keyHash,
      keyPrefix,
    },
    select: { id: true, name: true, keyPrefix: true, createdAt: true },
  })

  // rawKey is returned ONCE here and never again — the DB only stores the hash
  return NextResponse.json({ ...apiKey, rawKey }, { status: 201 })
}
