import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readFile } from "fs/promises"

// MIME type per source format.
// For PDF jobs, sourceData contains the extracted markdown — not the original binary.
const MIME_MAP: Record<string, string> = {
  json:        "application/json",
  csv:         "text/csv",
  md:          "text/markdown",
  txt:         "text/plain",
  pdf:         "text/markdown",           // stored as extracted markdown
  xliff:       "application/xliff+xml",
  xlf:         "application/xliff+xml",
  strings:     "text/plain",
  stringsdict: "application/xml",
  xcstrings:   "application/json",
  po:          "text/plain",
  xml:         "application/xml",
  arb:         "application/json",
  properties:  "text/plain",
  html:        "text/html",
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { jobId } = await params
  const { id: userId, role } = session.user

  const job = await db.translationJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      name: true,
      sourceFormat: true,
      sourceData: true,
      sourceFileUrl: true,
      createdById: true,
    },
  })

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (role !== "admin" && job.createdById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let content: string | null = null

  if (job.sourceData) {
    content = job.sourceData
  } else if (job.sourceFileUrl) {
    try {
      content = await readFile(job.sourceFileUrl, "utf-8")
    } catch {
      // File cleaned up from /tmp (production) or deleted on disk
    }
  }

  if (!content) {
    return NextResponse.json({ error: "Original file not available for this job" }, { status: 404 })
  }

  const fmt = job.sourceFormat
  const mime = MIME_MAP[fmt] ?? "application/octet-stream"
  // PDF source is stored as extracted markdown — use .md so it opens correctly
  const ext = fmt === "pdf" ? "md" : fmt
  const safeName = job.name.replace(/[^a-zA-Z0-9-_]/g, "_")

  return new NextResponse(content, {
    headers: {
      "Content-Type": `${mime}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${safeName}-original.${ext}"`,
    },
  })
}
