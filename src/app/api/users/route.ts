import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"

// GET /api/users - list users (admin only, or reviewers for assignment)
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const role = searchParams.get("role")
  const language = searchParams.get("language")

  const users = await db.user.findMany({
    where: {
      ...(role ? { role } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      languages: true,
      isPlatformReviewer: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  })

  // Filter by language capability if requested
  const filtered = language
    ? users.filter((u) => {
        try {
          const langs: string[] = JSON.parse(u.languages)
          return langs.some(
            (l) => l === language || l.startsWith(language.split("-")[0])
          )
        } catch {
          return false
        }
      })
    : users

  return NextResponse.json(filtered)
}

// POST /api/users - create user (admin only)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { email, name, password, role, languages } = body

  if (!email || !name || !password) {
    return NextResponse.json(
      { error: "email, name, and password are required" },
      { status: 400 }
    )
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  const user = await db.user.create({
    data: {
      email,
      name,
      hashedPassword,
      role: role || "reviewer",
      languages: JSON.stringify(languages || []),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      languages: true,
    },
  })

  return NextResponse.json(user, { status: 201 })
}
