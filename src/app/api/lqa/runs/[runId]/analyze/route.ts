import { after } from "next/server"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { parseBilingualFile } from "@/lib/lqa-bilingual-parser"
import { analyzeLqa } from "@/lib/lqa-analyzer"

// POST /api/lqa/runs/[runId]/analyze — trigger AI quality analysis
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { runId } = await params

  // Load run
  const run = await db.lqaRun.findUnique({ where: { id: runId } })
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 })

  const { id: userId, role } = session.user
  if (role !== "admin" && run.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (run.status === "running") {
    return NextResponse.json({ error: "Analysis already in progress" }, { status: 409 })
  }
  if (run.status === "completed") {
    return NextResponse.json({ error: "Analysis already completed" }, { status: 409 })
  }

  // Always use Anthropic Claude — resolve key from DB settings or platform env
  const provider = "anthropic"
  const model = "claude-sonnet-4-6"

  let apiKey = ""
  const systemKey = await db.systemSetting.findUnique({ where: { key: "ai_provider_key_anthropic" } })
  apiKey = systemKey?.value ?? ""
  if (!apiKey) {
    const fallbackKey = await db.systemSetting.findUnique({ where: { key: "ai_anthropic_key" } })
    apiKey = fallbackKey?.value ?? ""
  }
  if (!apiKey) {
    apiKey = process.env.ANTHROPIC_API_KEY ?? ""
  }
  if (!apiKey) {
    return NextResponse.json(
      { error: "Anthropic API key not configured. Set ANTHROPIC_API_KEY in the environment." },
      { status: 400 }
    )
  }

  // Mark as running and respond immediately so the client can start polling.
  await db.lqaRun.update({ where: { id: runId }, data: { status: "running" } })

  // after() is Next.js 15+'s guaranteed post-response hook — the framework keeps
  // the process alive until the callback resolves, unlike a bare void IIFE which
  // can be cancelled when the request context is torn down.
  const fileContent = run.originalFile
  const fileFormat = run.fileFormat
  const sourceLang = run.sourceLanguage
  const targetLang = run.targetLanguage

  after(async () => {
    try {
      const { units } = parseBilingualFile(fileContent, fileFormat)
      if (units.length === 0) {
        await db.lqaRun.update({
          where: { id: runId },
          data: { status: "failed", errorMessage: "File parsed successfully but contained no bilingual units." },
        })
        return
      }
      const result = await analyzeLqa(units, sourceLang, targetLang, apiKey, provider, model)
      await db.lqaRun.update({
        where: { id: runId },
        data: {
          status: "completed",
          qualityScore: result.qualityScore,
          qualityBand: result.qualityBand,
          accuracyErrors: result.accuracyErrors,
          languageErrors: result.languageErrors,
          styleErrors: result.styleErrors,
          findings: JSON.stringify(result.findings),
          errorMessage: null,
        },
      })
    } catch (err) {
      const message = (err as Error).message
      console.error("[lqa/analyze] after() error:", message)
      await db.lqaRun.update({
        where: { id: runId },
        data: { status: "failed", errorMessage: message },
      })
    }
  })

  return NextResponse.json({ status: "running" }, { status: 202 })
}
