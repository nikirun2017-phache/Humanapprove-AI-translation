import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { parseSubtitle } from "@/lib/subtitle-parser"

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_EXTS = new Set(["srt", "vtt"])

// GET /api/media/runs — list runs for the current user
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: userId, role } = session.user
  const runs = await db.mediaRun.findMany({
    where: role === "admin" ? {} : { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileFormat: true,
      targetLanguage: true,
      status: true,
      totalEntries: true,
      errorMessage: true,
      createdAt: true,
    },
  })

  return NextResponse.json(runs)
}

// POST /api/media/runs — upload an SRT/VTT file and create a new media run
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role === "reviewer") {
    return NextResponse.json({ error: "Reviewers cannot create media runs" }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const targetLanguage = (formData.get("targetLanguage") as string | null)?.trim()

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
  if (!targetLanguage) return NextResponse.json({ error: "targetLanguage is required" }, { status: 400 })

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File exceeds the 5 MB size limit" }, { status: 413 })
  }

  const rawExt = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (!ALLOWED_EXTS.has(rawExt)) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a .srt or .vtt file." },
      { status: 415 }
    )
  }

  const format = rawExt as "srt" | "vtt"
  const content = await file.text()

  // Quick parse to count entries and validate format
  let totalEntries = 0
  try {
    const parsed = parseSubtitle(content, format)
    totalEntries = parsed.entries.length
    if (totalEntries === 0) {
      return NextResponse.json(
        { error: "No subtitle entries found in the file — check the file format." },
        { status: 422 }
      )
    }
  } catch {
    return NextResponse.json({ error: "Failed to parse subtitle file." }, { status: 422 })
  }

  const run = await db.mediaRun.create({
    data: {
      userId: session.user.id,
      fileName: file.name,
      fileFormat: format,
      targetLanguage,
      totalEntries,
      originalFile: content,
      status: "pending",
    },
  })

  return NextResponse.json({ runId: run.id, totalEntries }, { status: 201 })
}
