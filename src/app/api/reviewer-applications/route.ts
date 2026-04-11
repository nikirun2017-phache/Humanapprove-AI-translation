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
const ALLOWED_CV_TYPES = new Set(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"])
const MAX_CV_BYTES = 5 * 1024 * 1024 // 5 MB

// POST /api/reviewer-applications — requires auth
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in to submit an application." }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const fullName = (formData.get("fullName") as string | null)?.trim() ?? ""
  const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? ""
  const languagePairsRaw = formData.get("languagePairs") as string | null
  const yearsExperienceRaw = formData.get("yearsExperience") as string | null
  const catToolsRaw = formData.get("catTools") as string | null
  const mtExperienceRaw = formData.get("mtExperience") as string | null
  const bio = (formData.get("bio") as string | null)?.trim() ?? ""
  const profileUrl = (formData.get("profileUrl") as string | null)?.trim() || null
  const ratePerWordRaw = formData.get("ratePerWord") as string | null
  const ratePerHourRaw = formData.get("ratePerHour") as string | null
  const cvFile = formData.get("cv") as File | null

  // Validate required fields
  if (fullName.length < 2)
    return NextResponse.json({ error: "Full name is required (min 2 characters)" }, { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 })

  let languagePairs: string[]
  try { languagePairs = JSON.parse(languagePairsRaw ?? "[]") } catch { languagePairs = [] }
  if (!Array.isArray(languagePairs) || languagePairs.length === 0)
    return NextResponse.json({ error: "Select at least one language pair" }, { status: 400 })
  if (!languagePairs.every((c) => KNOWN_CODES.has(c)))
    return NextResponse.json({ error: "Unknown language code in languagePairs" }, { status: 400 })

  const yearsExperience = parseInt(yearsExperienceRaw ?? "", 10)
  if (!Number.isInteger(yearsExperience) || yearsExperience < 0 || yearsExperience > 60)
    return NextResponse.json({ error: "Years of experience must be a number between 0 and 60" }, { status: 400 })

  let catTools: string[]
  try { catTools = JSON.parse(catToolsRaw ?? "[]") } catch { catTools = [] }
  if (!Array.isArray(catTools) || !catTools.every((t) => CAT_TOOLS.has(t)))
    return NextResponse.json({ error: "Invalid CAT tool selection" }, { status: 400 })

  const mtExperience = mtExperienceRaw === "true"
  if (mtExperienceRaw === null)
    return NextResponse.json({ error: "mtExperience is required" }, { status: 400 })

  if (bio.length < 20)
    return NextResponse.json({ error: "Bio is required (min 20 characters)" }, { status: 400 })
  if (bio.length > 2000)
    return NextResponse.json({ error: "Bio must be under 2000 characters" }, { status: 400 })

  // Rate validation
  const ratePerWord = ratePerWordRaw ? parseFloat(ratePerWordRaw) : NaN
  if (isNaN(ratePerWord) || ratePerWord < 0 || ratePerWord > 100)
    return NextResponse.json({ error: "Rate per word (USD) is required and must be a valid amount" }, { status: 400 })

  const ratePerHour = ratePerHourRaw ? parseFloat(ratePerHourRaw) : NaN
  if (isNaN(ratePerHour) || ratePerHour < 0 || ratePerHour > 10000)
    return NextResponse.json({ error: "Rate per hour (USD) is required and must be a valid amount" }, { status: 400 })

  // CV validation
  if (!cvFile || cvFile.size === 0)
    return NextResponse.json({ error: "Please attach your CV (PDF, Word, or TXT)" }, { status: 400 })
  if (!ALLOWED_CV_TYPES.has(cvFile.type) && !cvFile.name.match(/\.(pdf|doc|docx|txt)$/i))
    return NextResponse.json({ error: "CV must be a PDF, Word (.doc/.docx), or TXT file" }, { status: 400 })
  if (cvFile.size > MAX_CV_BYTES)
    return NextResponse.json({ error: "CV file must be under 5 MB" }, { status: 400 })

  const cvBuffer = Buffer.from(await cvFile.arrayBuffer())
  const cvData = cvBuffer.toString("base64")

  // Reject duplicate pending applications
  const existing = await db.reviewerApplication.findFirst({
    where: { email, status: "pending" },
  })
  if (existing) {
    return NextResponse.json(
      { error: "You already have a pending application. We will be in touch soon." },
      { status: 409 }
    )
  }

  const application = await db.reviewerApplication.create({
    data: {
      fullName,
      email,
      languagePairs: JSON.stringify(languagePairs),
      yearsExperience,
      catTools: JSON.stringify(catTools),
      mtExperience,
      bio,
      profileUrl,
      ratePerWord,
      ratePerHour,
      cvFileName: cvFile.name,
      cvMimeType: cvFile.type || "application/octet-stream",
      cvData,
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
