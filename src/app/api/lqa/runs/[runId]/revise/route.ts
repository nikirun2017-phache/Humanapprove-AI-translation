import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { reviseBilingualFile } from "@/lib/lqa-reviser"
import type { LqaFinding } from "@/lib/lqa-analyzer"

export const maxDuration = 60 // seconds — increase Vercel function timeout

// POST /api/lqa/runs/[runId]/revise — trigger AI auto-fix of findings
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

  if (run.status !== "completed") {
    return NextResponse.json({ error: "Run analysis must be completed before revision" }, { status: 409 })
  }
  if (run.revisionStatus === "running") {
    return NextResponse.json({ error: "Revision already in progress" }, { status: 409 })
  }

  const findings: LqaFinding[] = run.findings ? JSON.parse(run.findings) : []
  if (findings.length === 0) {
    return NextResponse.json({ error: "No findings to revise — translation quality is excellent" }, { status: 400 })
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
    return NextResponse.json({ error: "Anthropic API key not configured. Set ANTHROPIC_API_KEY in the environment." }, { status: 400 })
  }

  // Mark revision as running
  await db.lqaRun.update({ where: { id: runId }, data: { revisionStatus: "running" } })

  const ROUTE_TIMEOUT_MS = 55_000

  try {
    const revisedContent = await Promise.race([
      reviseBilingualFile(run.originalFile, run.fileFormat, run.targetLanguage, findings, apiKey, provider, model),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Revision timed out. Please try again.")),
          ROUTE_TIMEOUT_MS
        )
      ),
    ])

    const unchanged = revisedContent === run.originalFile
    if (unchanged) {
      console.warn(`[lqa/revise] run ${runId}: AI returned no changes — revised content is identical to original. Findings count: ${findings.length}`)
    }

    await db.lqaRun.update({
      where: { id: runId },
      data: { revisedFile: revisedContent, revisionStatus: "completed" },
    })

    return NextResponse.json({
      success: true,
      revisedUnits: unchanged ? 0 : findings.length,
      warning: unchanged ? "AI returned no revisions — the translated content may already be correct, or the fix suggestions were unclear." : undefined,
    })
  } catch (err) {
    const message = (err as Error).message
    await db.lqaRun.update({
      where: { id: runId },
      data: { revisionStatus: "failed" },
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
