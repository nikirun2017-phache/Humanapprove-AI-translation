import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { parseBilingualFile } from "@/lib/lqa-bilingual-parser"
import { generateLqaExcel } from "@/lib/lqa-excel"
import type { LqaAnalysisResult } from "@/lib/lqa-analyzer"

// GET /api/lqa/runs/[runId]/report — download Excel report
export async function GET(
  _req: NextRequest,
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
    return NextResponse.json({ error: "Analysis not yet completed" }, { status: 409 })
  }

  const findings = run.findings ? JSON.parse(run.findings) : []
  const { units } = parseBilingualFile(run.originalFile, run.fileFormat)

  const modelName = "AI Model"

  const result: LqaAnalysisResult = {
    qualityScore: run.qualityScore ?? 0,
    qualityBand: (run.qualityBand as LqaAnalysisResult["qualityBand"]) ?? "Low",
    accuracyErrors: run.accuracyErrors,
    languageErrors: run.languageErrors,
    styleErrors: run.styleErrors,
    findings,
    totalWords: run.totalWordCount,
  }

  const buffer = await generateLqaExcel(
    {
      fileName: run.fileName,
      sourceLanguage: run.sourceLanguage,
      targetLanguage: run.targetLanguage,
      model: modelName,
      createdAt: run.createdAt,
    },
    result,
    units
  )

  // Sanitize filename for Content-Disposition
  const safeName = run.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
  const baseName = safeName.replace(/\.(xliff|xlf|tmx)$/i, "")
  const reportName = `LQA_${baseName}_${run.targetLanguage}.xlsx`

  return new NextResponse(buffer.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${reportName}"`,
      "Cache-Control": "no-store",
    },
  })
}
