import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readFile, writeFile, mkdir } from "fs/promises"
import path from "path"
import { resolveApiKey } from "@/lib/api-key-resolver"
import { getProvider } from "@/lib/ai-providers/registry"
import { chunkUnits } from "@/lib/translation-batcher"
import { buildXliffFromTranslations } from "@/lib/xliff-builder"
import type { SourceUnit } from "@/lib/source-parser"

export const maxDuration = 300 // 5 min timeout for long translation jobs

const RETRYABLE_STATUSES = [429, 500, 503, 529]
const RETRY_DELAYS_MS = [3000, 8000, 20000] // 3 attempts after first failure

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: Error = new Error("Unknown error")
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err as Error
      const statusMatch = lastError.message.match(/error (\d{3})/)
      const status = statusMatch ? parseInt(statusMatch[1]) : 0
      const isRetryable = RETRYABLE_STATUSES.includes(status) ||
        lastError.message.toLowerCase().includes("overload") ||
        lastError.message.toLowerCase().includes("rate limit")
      if (!isRetryable || attempt === RETRY_DELAYS_MS.length) break
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]))
    }
  }
  throw lastError
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string; taskId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { jobId, taskId } = await params
  const { id: userId, role } = session.user

  const [job, task] = await Promise.all([
    db.translationJob.findUnique({ where: { id: jobId } }),
    db.translationTask.findUnique({ where: { id: taskId } }),
  ])

  if (!job || !task || task.jobId !== jobId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (role !== "admin" && job.createdById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (task.status === "completed" || task.status === "imported") {
    return NextResponse.json({ error: "Task already completed" }, { status: 409 })
  }
  // Allow retrying failed tasks — reset progress
  if (task.status === "failed") {
    await db.translationTask.update({
      where: { id: taskId },
      data: { completedUnits: 0, errorMessage: null },
    })
  }

  // Mark running
  await db.translationTask.update({
    where: { id: taskId },
    data: { status: "running", completedUnits: 0, errorMessage: null },
  })

  try {
    const apiKey = await resolveApiKey(job.provider, jobId)
    const provider = getProvider(job.provider as Parameters<typeof getProvider>[0])

    const unitsRaw = await readFile(job.unitsFileUrl, "utf-8")
    const units: SourceUnit[] = JSON.parse(unitsRaw)

    const batches = chunkUnits(units)
    const allTranslated: { id: string; translatedText: string }[] = []
    let completedCount = 0

    for (const batch of batches) {
      const result = await withRetry(() =>
        provider.translate(
          { units: batch, sourceLanguage: job.sourceLanguage, targetLanguage: task.targetLanguage },
          apiKey,
          job.model
        )
      )
      allTranslated.push(...result.units)
      completedCount += batch.length

      await db.translationTask.update({
        where: { id: taskId },
        data: { completedUnits: completedCount },
      })
    }

    // Build XLIFF
    const xliff = buildXliffFromTranslations(
      units,
      allTranslated,
      job.sourceLanguage,
      task.targetLanguage,
      job.name
    )

    // Save XLIFF file
    const xliffDir = path.join(process.cwd(), "uploads", "studio")
    await mkdir(xliffDir, { recursive: true })
    const xliffFileName = `${jobId}-${task.targetLanguage.replace(/[^a-zA-Z0-9-]/g, "_")}.xliff`
    const xliffPath = path.join(xliffDir, xliffFileName)
    await writeFile(xliffPath, xliff, "utf-8")

    await db.translationTask.update({
      where: { id: taskId },
      data: {
        status: "completed",
        completedUnits: units.length,
        xliffFileUrl: xliffPath,
      },
    })

    // Update job status
    const remaining = await db.translationTask.count({
      where: { jobId, status: { in: ["pending", "running"] } },
    })
    if (remaining === 0) {
      await db.translationJob.update({ where: { id: jobId }, data: { status: "completed" } })
      // Clean up job-scoped API key
      await db.systemSetting.deleteMany({ where: { key: `ai_job_key_${jobId}` } })
    }

    return NextResponse.json({ status: "completed", completedUnits: units.length, totalUnits: units.length })
  } catch (err) {
    const message = (err as Error).message
    await db.translationTask.update({
      where: { id: taskId },
      data: { status: "failed", errorMessage: message },
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
