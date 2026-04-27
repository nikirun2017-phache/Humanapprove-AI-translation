import { after } from "next/server"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { translateSubtitleFile } from "@/lib/subtitle-translator"

export const maxDuration = 300 // seconds — long subtitle files can take a while

// POST /api/media/runs/[runId]/translate — trigger AI subtitle translation
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { runId } = await params
  const run = await db.mediaRun.findUnique({ where: { id: runId } })
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 })

  const { id: userId, role } = session.user
  if (role !== "admin" && run.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (run.status === "running") {
    return NextResponse.json({ error: "Translation already in progress" }, { status: 409 })
  }
  if (run.status === "completed") {
    return NextResponse.json({ error: "Translation already completed" }, { status: 409 })
  }

  // Resolve Anthropic API key
  let apiKey = ""
  const systemKey = await db.systemSetting.findUnique({ where: { key: "ai_provider_key_anthropic" } })
  apiKey = systemKey?.value ?? ""
  if (!apiKey) {
    const fallback = await db.systemSetting.findUnique({ where: { key: "ai_anthropic_key" } })
    apiKey = fallback?.value ?? ""
  }
  if (!apiKey) apiKey = process.env.ANTHROPIC_API_KEY ?? ""
  if (!apiKey) {
    return NextResponse.json(
      { error: "Anthropic API key not configured. Set ANTHROPIC_API_KEY in the environment." },
      { status: 400 }
    )
  }

  // Mark as running and return immediately — translation runs in after()
  await db.mediaRun.update({ where: { id: runId }, data: { status: "running" } })

  const { originalFile, fileFormat, targetLanguage } = run

  after(async () => {
    try {
      const result = await translateSubtitleFile(
        originalFile,
        fileFormat as "srt" | "vtt",
        targetLanguage,
        apiKey
      )

      await db.mediaRun.update({
        where: { id: runId },
        data: {
          status: "completed",
          totalEntries: result.totalEntries,
          translatedFile: result.translatedFile,
          previewData: JSON.stringify(result.previewEntries),
          errorMessage: null,
        },
      })
    } catch (err) {
      const message = (err as Error).message
      console.error("[media/translate] after() error:", message)
      await db.mediaRun.update({
        where: { id: runId },
        data: { status: "failed", errorMessage: message },
      })
    }
  })

  return NextResponse.json({ status: "running" }, { status: 202 })
}
