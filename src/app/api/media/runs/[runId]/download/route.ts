import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/media/runs/[runId]/download — download the translated subtitle file
export async function GET(
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

  if (run.status !== "completed" || !run.translatedFile) {
    return NextResponse.json({ error: "Translation not yet completed" }, { status: 409 })
  }

  const contentType =
    run.fileFormat === "vtt" ? "text/vtt;charset=utf-8" : "text/plain;charset=utf-8"

  // Build download filename: original_name_lang.ext
  const safeName = run.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
  const baseName = safeName.replace(/\.(srt|vtt)$/i, "")
  // Strip anything in parentheses for a cleaner filename, e.g. "Simplified Chinese (简体中文)" → "Simplified_Chinese"
  const safeLang = run.targetLanguage
    .replace(/\s*\(.*?\)/g, "")
    .trim()
    .replace(/\s+/g, "_")
  const downloadName = `${baseName}_${safeLang}.${run.fileFormat}`

  return new NextResponse(run.translatedFile, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${downloadName}"`,
      "Cache-Control": "no-store",
    },
  })
}
