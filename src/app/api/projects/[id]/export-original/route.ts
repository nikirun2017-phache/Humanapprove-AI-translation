import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readFile } from "fs/promises"
import {
  exportAsJson,
  exportAsCsv,
  exportAsMd,
  exportAsTxt,
  formatExtension,
  formatMimeType,
  type ExportUnit,
} from "@/lib/original-format-exporter"
import type { SourceUnit } from "@/lib/source-parser"

/**
 * GET /api/projects/:id/export-original
 *
 * Returns the reviewed translations in the original source file format.
 * Only available for projects created via Translation Studio (which have a
 * linked TranslationTask → TranslationJob with sourceFormat + unitsFileUrl).
 *
 * For each unit the best available translation is used:
 *   revisedTarget (reviewer edit) → targetText (AI) → sourceText (fallback)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: projectId } = await params
  const { id: userId, role } = session.user

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      units: { orderBy: { orderIndex: "asc" } },
      translationTask: { include: { job: true } },
    },
  })

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (role !== "admin" && project.createdById !== userId && project.assignedReviewerId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const job = project.translationTask?.job
  if (!job) {
    return NextResponse.json(
      { error: "This project was uploaded directly as XLIFF — no original source file is available. Use 'Download XLIFF' instead." },
      { status: 400 }
    )
  }

  const sourceFormat = job.sourceFormat // "json" | "csv" | "md" | "pdf"

  // Load the original parsed units (preserves original key order and IDs)
  let originalUnits: SourceUnit[]
  try {
    const raw = await readFile(job.unitsFileUrl, "utf-8")
    originalUnits = JSON.parse(raw) as SourceUnit[]
  } catch {
    return NextResponse.json({ error: "Original source units file not found on disk." }, { status: 500 })
  }

  // Map xliffUnitId → best translation from the reviewed project
  const translationMap = new Map<string, string>()
  for (const unit of project.units) {
    translationMap.set(unit.xliffUnitId, unit.revisedTarget ?? unit.targetText)
  }

  // Build export units in original file order
  const exportUnits: ExportUnit[] = originalUnits.map((u) => ({
    id: u.id,
    sourceText: u.sourceText,
    translatedText: translationMap.get(u.id) ?? u.sourceText, // fallback: keep source if no translation
  }))

  // Build file content
  let content: string
  switch (sourceFormat) {
    case "json":
      content = exportAsJson(exportUnits)
      break
    case "csv":
      content = exportAsCsv(exportUnits, project.targetLanguage)
      break
    case "md":
      content = exportAsMd(exportUnits)
      break
    case "pdf":
    default:
      content = exportAsTxt(exportUnits)
      break
  }

  const ext = formatExtension(sourceFormat)
  const mime = formatMimeType(sourceFormat)
  const safeName = project.name.replace(/[^a-z0-9]/gi, "_")
  const safeLang = project.targetLanguage.replace(/[^a-z0-9]/gi, "_")
  const fileName = `${safeName}-${safeLang}.${ext}`

  return new NextResponse(content, {
    headers: {
      "Content-Type": `${mime}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  })
}
