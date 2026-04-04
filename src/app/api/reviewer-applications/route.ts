import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { STUDIO_LANGUAGES } from "@/lib/languages"
import {
  sendApplicationConfirmationEmail,
  sendAdminApplicationNotificationEmail,
} from "@/lib/email"

const KNOWN_CODES = new Set(STUDIO_LANGUAGES.map((l) => l.code))
const CAT_TOOLS = new Set(["Trados", "memoQ", "Phrase", "Memsource", "Wordfast", "OmegaT", "Other"])

// POST /api/reviewer-applications — public, no auth required
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const {
    fullName,
    email,
    languagePairs,
    yearsExperience,
    catTools,
    mtExperience,
    bio,
    profileUrl,
  } = body as Record<string, unknown>

  // Validate required fields
  if (typeof fullName !== "string" || fullName.trim().length < 2)
    return NextResponse.json({ error: "Full name is required (min 2 characters)" }, { status: 400 })
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
  if (!Array.isArray(languagePairs) || languagePairs.length === 0)
    return NextResponse.json({ error: "Select at least one language pair" }, { status: 400 })
  if (!languagePairs.every((c) => KNOWN_CODES.has(c)))
    return NextResponse.json({ error: "Unknown language code in languagePairs" }, { status: 400 })
  if (!Number.isInteger(yearsExperience) || (yearsExperience as number) < 0 || (yearsExperience as number) > 60)
    return NextResponse.json({ error: "Years of experience must be a number between 0 and 60" }, { status: 400 })
  if (!Array.isArray(catTools) || !catTools.every((t) => CAT_TOOLS.has(t)))
    return NextResponse.json({ error: "Invalid CAT tool selection" }, { status: 400 })
  if (typeof mtExperience !== "boolean")
    return NextResponse.json({ error: "mtExperience must be true or false" }, { status: 400 })
  if (typeof bio !== "string" || bio.trim().length < 20)
    return NextResponse.json({ error: "Bio is required (min 20 characters)" }, { status: 400 })
  if (typeof bio === "string" && bio.trim().length > 2000)
    return NextResponse.json({ error: "Bio must be under 2000 characters" }, { status: 400 })
  if (profileUrl !== undefined && profileUrl !== null && profileUrl !== "" && typeof profileUrl !== "string")
    return NextResponse.json({ error: "profileUrl must be a string" }, { status: 400 })

  const cleanEmail = email.trim().toLowerCase()

  // Reject duplicate pending applications
  const existing = await db.reviewerApplication.findFirst({
    where: { email: cleanEmail, status: "pending" },
  })
  if (existing) {
    return NextResponse.json(
      { error: "You already have a pending application. We will be in touch soon." },
      { status: 409 }
    )
  }

  const application = await db.reviewerApplication.create({
    data: {
      fullName: fullName.trim(),
      email: cleanEmail,
      languagePairs: JSON.stringify(languagePairs),
      yearsExperience: yearsExperience as number,
      catTools: JSON.stringify(catTools),
      mtExperience,
      bio: bio.trim(),
      profileUrl: profileUrl ? String(profileUrl).trim() : null,
    },
  })

  // Fire-and-forget emails
  void sendApplicationConfirmationEmail(application.fullName, application.email)
  void sendAdminApplicationNotificationEmail({
    id: application.id,
    fullName: application.fullName,
    email: application.email,
    languagePairs: application.languagePairs,
    yearsExperience: application.yearsExperience,
    catTools: application.catTools,
    mtExperience: application.mtExperience,
    bio: application.bio,
    profileUrl: application.profileUrl,
  })

  return NextResponse.json({ ok: true, id: application.id }, { status: 201 })
}

// GET /api/reviewer-applications — admin only
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") // optional filter

  const applications = await db.reviewerApplication.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(applications)
}
