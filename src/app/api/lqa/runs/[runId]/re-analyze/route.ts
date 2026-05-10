import { after } from "next/server"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { parseBilingualFile } from "@/lib/lqa-bilingual-parser"
import { analyzeLqa } from "@/lib/lqa-analyzer"

/**
 * POST /api/lqa/runs/[runId]/re-analyze
 *
 * Re-analyze the REVISED file (or original if no revision exists) and update
 * the run's quality score + findings.  This is called automatically after
 * every auto-revise so the score reflects the improved translation without
 * the user having to upload a new file.
 *
 * Uses next/server `after()` — returns 202 immediately; the caller polls
 * GET /api/lqa/runs/[runId] until status returns to "completed".
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { runId } = await params
  const run = await db.lqaRun.findUnique({ where: { id: runId } })
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 })

  const { id: userId, role } = session.user
  if (role !== "admin" && run.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (run.status === "running") {
    return NextResponse.json({ error: "Analysis already in progress" }, { status: 409 })
  }

  // Always use Anthropic Claude for LQA
  let apiKey = ""
  const systemKey = await db.systemSetting.findUnique({ where: { key: "ai_provider_key_anthropic" } })
  apiKey = systemKey?.value ?? ""
  if (!apiKey) {
    const fallbackKey = await db.systemSetting.findUnique({ where: { key: "ai_anthropic_key" } })
    apiKey = fallbackKey?.value ?? ""
  }
  if (!apiKey) apiKey = process.env.ANTHROPIC_API_KEY ?? ""
  if (!apiKey) {
    return NextResponse.json(
      { error: "Anthropic API key not configured. Set ANTHROPIC_API_KEY in the environment." },
      { status: 400 }
    )
  }

  // Analyze the revised file if it exists, otherwise fall back to the original
  const fileContent = run.revisedFile ?? run.originalFile
  const fileFormat = run.fileFormat
  const sourceLang = run.sourceLanguage
  const targetLang = run.targetLanguage

  // Mark as running — revisionStatus stays "completed" so the revised file
  // download link remains available during re-analysis
  await db.lqaRun.update({
    where: { id: runId },
    data: { status: "running", errorMessage: null },
  })

  after(async () => {
    try {
      const { units } = parseBilingualFile(fileContent, fileFormat)
      if (units.length === 0) {
        await db.lqaRun.update({
          where: { id: runId },
          data: { status: "failed", errorMessage: "Re-analysis found no bilingual units in the revised file." },
        })
        return
      }
      const result = await analyzeLqa(units, sourceLang, targetLang, apiKey, "anthropic", "claude-sonnet-4-6")
      await db.lqaRun.update({
        where: { id: runId },
        data: {
          status: "completed",
          qualityScore: result.qualityScore,
          qualityBand: result.qualityBand,
          accuracyErrors: result.accuracyErrors,
          languageErrors: result.languageErrors,
          styleErrors: result.styleErrors,
          totalWordCount: result.totalWords,
          findings: JSON.stringify(result.findings),
          // Keep revisionStatus so the download link stays active
          errorMessage: null,
        },
      })
    } catch (err) {
      const message = (err as Error).message
      console.error("[lqa/re-analyze] error:", message)
      await db.lqaRun.update({
        where: { id: runId },
        data: { status: "failed", errorMessage: message },
      })
    }
  })

  return NextResponse.json({ status: "running" }, { status: 202 })
}
