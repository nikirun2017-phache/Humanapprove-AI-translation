import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { parseBilingualFile } from "@/lib/lqa-bilingual-parser"
import { countWords } from "@/lib/lqa-analyzer"

const MAX_FILE_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_EXTS = new Set(["xliff", "xlf", "tmx", "mxliff"])

// GET /api/lqa/runs — list all runs for the current user
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: userId, role } = session.user
  const runs = await db.lqaRun.findMany({
    where: role === "admin" ? {} : { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileFormat: true,
      sourceLanguage: true,
      targetLanguage: true,
      status: true,
      totalUnits: true,
      totalWordCount: true,
      qualityScore: true,
      qualityBand: true,
      accuracyErrors: true,
      languageErrors: true,
      styleErrors: true,
      revisionStatus: true,
      errorMessage: true,
      createdAt: true,
    },
  })

  return NextResponse.json(runs)
}

// POST /api/lqa/runs — upload a bilingual file and create a new LQA run
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role === "reviewer") {
    return NextResponse.json({ error: "Reviewers cannot create LQA runs" }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File exceeds the 5 MB size limit" }, { status: 413 })
  }

  const rawExt = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (!ALLOWED_EXTS.has(rawExt)) {
    return NextResponse.json(
      { error: "Unsupported file type. Accepted: .xliff, .xlf, .mxliff, .tmx" },
      { status: 400 }
    )
  }

  const content = await file.text()

  let parsedResult
  try {
    parsedResult = parseBilingualFile(content, rawExt)
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to parse file: ${(err as Error).message}` },
      { status: 400 }
    )
  }

  if (parsedResult.units.length === 0) {
    return NextResponse.json({ error: "File contains no bilingual translation units" }, { status: 400 })
  }

  const { sourceLanguage, targetLanguage, units } = parsedResult

  // Require a detected target language
  if (!targetLanguage) {
    return NextResponse.json(
      { error: "Could not detect target language from file. Ensure target language is specified in the file header." },
      { status: 400 }
    )
  }

  const totalWordCount = units.reduce((sum, u) => sum + countWords(u.source), 0)

  const run = await db.lqaRun.create({
    data: {
      userId: session.user.id,
      fileName: file.name,
      fileFormat: rawExt,
      sourceLanguage,
      targetLanguage,
      status: "pending",
      totalUnits: units.length,
      totalWordCount,
      originalFile: content,
    },
  })

  return NextResponse.json(
    { runId: run.id, totalUnits: units.length, totalWordCount, sourceLanguage, targetLanguage },
    { status: 201 }
  )
}
