import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readFile, writeFile, mkdir } from "fs/promises"
import path from "path"
import { resolveApiKey } from "@/lib/api-key-resolver"
import { getProvider } from "@/lib/ai-providers/registry"
import { translateMarkdownBatch } from "@/lib/ai-providers/markdown-translate"
import { buildMarkdownBatches, parseMarkdownTranslation } from "@/lib/xliff-markdown"
import { chunkUnits } from "@/lib/translation-batcher"
import { buildXliffFromTranslations, mergeTranslationsIntoXliff } from "@/lib/xliff-builder"
import type { SourceUnit } from "@/lib/source-parser"
import type { ProviderName, GlossaryTerm } from "@/lib/ai-providers/types"
import { sendJobCompleteEmail } from "@/lib/email"

export const maxDuration = 600 // 10 min timeout — large jobs + rate-limit retries

const RETRYABLE_STATUSES = [429, 500, 503, 529]
// Rate-limit delays: 429 / "rate limit" / "overload" get a 65s pause (Claude
// quota windows are typically 60 s). Other transient errors (500/503) get a
// shorter exponential back-off. Total max wait: ~3 attempts × 65 s = ~3 min.
const RATE_LIMIT_DELAYS_MS = [15000, 40000, 65000]
const TRANSIENT_DELAYS_MS  = [3000,  8000,  20000]

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: Error = new Error("Unknown error")
  for (let attempt = 0; attempt <= RATE_LIMIT_DELAYS_MS.length; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err as Error
      const statusMatch = lastError.message.match(/error (\d{3})/)
      const status = statusMatch ? parseInt(statusMatch[1]) : 0
      const isRateLimit = status === 429 ||
        lastError.message.toLowerCase().includes("rate limit") ||
        lastError.message.toLowerCase().includes("overload")
      const isTransient = RETRYABLE_STATUSES.includes(status) || isRateLimit
      if (!isTransient || attempt === RATE_LIMIT_DELAYS_MS.length) break
      const delay = isRateLimit
        ? RATE_LIMIT_DELAYS_MS[attempt]
        : TRANSIENT_DELAYS_MS[attempt]
      console.warn(`[translate] retry ${attempt + 1} after ${delay}ms — ${lastError.message.slice(0, 120)}`)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastError
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string; taskId: string }> }
) {
  const taskStartTime = Date.now()

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
  if (task.status === "failed") {
    await db.translationTask.update({
      where: { id: taskId },
      data: { completedUnits: 0, errorMessage: null },
    })
  }

  await db.translationTask.update({
    where: { id: taskId },
    data: { status: "running", completedUnits: 0, errorMessage: null },
  })

  try {
    const apiKey = await resolveApiKey(job.provider, jobId)

    // Prefer DB-stored units (works in serverless); fall back to file (local dev)
    const unitsRaw = job.unitsData ?? await readFile(job.unitsFileUrl, "utf-8")
    const units: SourceUnit[] = JSON.parse(unitsRaw)

    // Resolve glossary terms for this specific target language
    let glossaryTerms: GlossaryTerm[] | undefined
    if (job.glossaryData) {
      try {
        const allGlossary = JSON.parse(job.glossaryData) as Record<string, GlossaryTerm[]>
        const terms = allGlossary[task.targetLanguage]
        if (Array.isArray(terms) && terms.length > 0) {
          glossaryTerms = terms.filter((t: GlossaryTerm) => t.source?.trim() && t.target?.trim())
        }
      } catch { /* malformed glossaryData — ignore */ }
    }

    let xliff: string

    if (job.sourceFormat === "xliff") {
      // ── XLIFF path: markdown-based translation ──────────────────────────────
      // Source units contain plain text (XML tags stripped during job creation).
      // We batch them into markdown documents with §ID§ markers, translate each
      // batch as a plain text document, then parse the markers back to a Map and
      // merge into the original XLIFF structure.
      //
      // This eliminates every JSON/XML escaping conflict that plagued the previous
      // JSON-array approach (XML attribute quotes breaking JSON string delimiters).

      // Count how many source units are covered by the translationMap.
      // Tagged units expand into __t0/__t1/… sub-entries, so we count by source unit.
      const countTranslated = () => units.filter((u: (typeof units)[number]) =>
        translationMap.has(u.id) ||
        (u.textNodes && u.textNodes.length > 0 && translationMap.has(`${u.id}__t0`))
      ).length

      const markdownBatches = buildMarkdownBatches(units)
      const translationMap = new Map<string, string>()

      for (const { markdown, indexToId } of markdownBatches) {
        const translated = await withRetry(() =>
          translateMarkdownBatch(
            markdown,
            job.sourceLanguage,
            task.targetLanguage,
            job.provider as ProviderName,
            apiKey,
            job.model,
            glossaryTerms
          )
        )
        const indexedMap = parseMarkdownTranslation(translated)
        for (const [idx, text] of indexedMap) {
          const unitId = indexToId.get(idx)
          if (unitId) translationMap.set(unitId, text)
        }

        await db.translationTask.update({
          where: { id: taskId },
          data: { completedUnits: countTranslated() },
        })
      }

      // ── Gap-fill pass ────────────────────────────────────────────────────────
      // The AI occasionally skips units it deems "untranslatable" (dates, codes,
      // captions, etc.). Detect any missed units and send them in a second pass.
      // Tagged units (with textNodes) are considered "translated" when __t0 exists.
      const missingUnits = units.filter((u: (typeof units)[number]) => {
        if (translationMap.has(u.id)) return false
        // Tagged unit: at least the first sub-unit was translated → fully covered
        if (u.textNodes && u.textNodes.length > 0 && translationMap.has(`${u.id}__t0`)) return false
        return true
      })
      if (missingUnits.length > 0) {
        const gapBatches = buildMarkdownBatches(missingUnits)
        for (const { markdown: gapMarkdown, indexToId: gapIndexToId } of gapBatches) {
          try {
            const translated = await withRetry(() =>
              translateMarkdownBatch(
                gapMarkdown,
                job.sourceLanguage,
                task.targetLanguage,
                job.provider as ProviderName,
                apiKey,
                job.model,
                glossaryTerms
              )
            )
            const indexedMap = parseMarkdownTranslation(translated)
            for (const [idx, text] of indexedMap) {
              const unitId = gapIndexToId.get(idx)
              if (unitId) translationMap.set(unitId, text)
            }
          } catch {
            // Gap-fill is best-effort — a failure here doesn't abort the job
          }
        }
        await db.translationTask.update({
          where: { id: taskId },
          data: { completedUnits: countTranslated() },
        })
      }

      const sourceXliff = job.sourceData ?? await readFile(job.sourceFileUrl, "utf-8")

      // ── Structural gap-fill pass ─────────────────────────────────────────────
      // fast-xml-parser may have silently dropped units with deeply-nested or
      // namespace-prefixed <source> elements (e.g. xmlns:xhtml on <g> tags)
      // at job-creation time. Those units are absent from units.json and were
      // never sent to the AI. Re-parse the source XLIFF now to find any IDs
      // that still have no translation and send them in best-effort batches.
      {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { extractRawSourceUnits } = require("@/lib/xliff-parser") as typeof import("@/lib/xliff-parser")
        const allRawUnits = extractRawSourceUnits(sourceXliff)
        const structuralMissing: SourceUnit[] = []
        for (const [id, rawXml] of allRawUnits) {
          if (translationMap.has(id)) continue
          // Tagged unit already covered by sub-translations (__t0, __t1, …)
          if (translationMap.has(`${id}__t0`)) continue
          const plainText = rawXml.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim()
          if (plainText) structuralMissing.push({ id, sourceText: plainText })
        }
        if (structuralMissing.length > 0) {
          const structBatches = buildMarkdownBatches(structuralMissing)
          for (const { markdown: sm, indexToId: sIdx } of structBatches) {
            try {
              const translated = await withRetry(() =>
                translateMarkdownBatch(sm, job.sourceLanguage, task.targetLanguage, job.provider as ProviderName, apiKey, job.model, glossaryTerms)
              )
              const indexedMap = parseMarkdownTranslation(translated)
              for (const [idx, text] of indexedMap) {
                const unitId = sIdx.get(idx)
                if (unitId) translationMap.set(unitId, text)
              }
            } catch { /* structural gap-fill is best-effort */ }
          }
          await db.translationTask.update({
            where: { id: taskId },
            data: { completedUnits: countTranslated() },
          })
        }
      }

      xliff = mergeTranslationsIntoXliff(sourceXliff, task.targetLanguage, translationMap)

    } else if (job.sourceFormat === "pdf") {
      // ── PDF path: markdown-based translation ─────────────────────────────────
      // PDF units contain long paragraphs that may include newlines, bullet chars,
      // dollar signs and other characters that break JSON string escaping.
      // Markdown batches handle these safely — same approach as XLIFF, but the
      // output is built fresh via buildXliffFromTranslations (no source XLIFF to merge into).
      // Skip image placeholder units — they are never sent to the AI
      const translatableUnits = units.filter((u: (typeof units)[number]) => !u.isImagePlaceholder)
      const pdfMarkdownBatches = buildMarkdownBatches(translatableUnits)
      const pdfTranslationMap = new Map<string, string>()

      for (const { markdown, indexToId } of pdfMarkdownBatches) {
        const translated = await withRetry(() =>
          translateMarkdownBatch(
            markdown,
            job.sourceLanguage,
            task.targetLanguage,
            job.provider as ProviderName,
            apiKey,
            job.model,
            glossaryTerms
          )
        )
        const indexedMap = parseMarkdownTranslation(translated)
        for (const [idx, text] of indexedMap) {
          const unitId = indexToId.get(idx)
          if (unitId) pdfTranslationMap.set(unitId, text)
        }
        await db.translationTask.update({
          where: { id: taskId },
          data: { completedUnits: pdfTranslationMap.size },
        })
      }

      // Gap-fill: re-send any translatable units the AI skipped (never placeholders)
      const pdfMissingUnits = units.filter((u: (typeof units)[number]) => !u.isImagePlaceholder && !pdfTranslationMap.has(u.id))
      if (pdfMissingUnits.length > 0) {
        const gapBatches = buildMarkdownBatches(pdfMissingUnits)
        for (const { markdown: gapMd, indexToId: gapIdx } of gapBatches) {
          try {
            const translated = await withRetry(() =>
              translateMarkdownBatch(gapMd, job.sourceLanguage, task.targetLanguage, job.provider as ProviderName, apiKey, job.model, glossaryTerms)
            )
            const indexedMap = parseMarkdownTranslation(translated)
            for (const [idx, text] of indexedMap) {
              const unitId = gapIdx.get(idx)
              if (unitId) pdfTranslationMap.set(unitId, text)
            }
          } catch { /* gap-fill is best-effort */ }
        }
        await db.translationTask.update({
          where: { id: taskId },
          data: { completedUnits: pdfTranslationMap.size },
        })
      }

      const allTranslatedPdf = units.map((u: (typeof units)[number]) => ({
        id: u.id,
        // Placeholder units carry their marker through as targetText so the
        // download route can render them as image boxes in the translated PDF.
        translatedText: u.isImagePlaceholder ? "__IMAGE_PLACEHOLDER__" : pdfTranslationMap.get(u.id) ?? "",
      }))
      xliff = buildXliffFromTranslations(units, allTranslatedPdf, job.sourceLanguage, task.targetLanguage, job.name)

    } else {
      // ── Non-XLIFF path: JSON-array batching (JSON, CSV, Markdown) ────────────
      const provider = getProvider(job.provider as Parameters<typeof getProvider>[0])
      const batches = chunkUnits(units)
      const allTranslated: { id: string; translatedText: string }[] = []
      let completedCount = 0

      for (const batch of batches) {
        const result = await withRetry(() =>
          provider.translate(
            { units: batch, sourceLanguage: job.sourceLanguage, targetLanguage: task.targetLanguage, glossaryTerms },
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

      xliff = buildXliffFromTranslations(
        units,
        allTranslated,
        job.sourceLanguage,
        task.targetLanguage,
        job.name
      )
    }

    // Save XLIFF file (local dev only; on Vercel /tmp is ephemeral so we store content in DB)
    const xliffDir = path.join(process.env.NODE_ENV === "production" ? "/tmp" : process.cwd(), "uploads", "studio")
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
        xliffData: xliff, // stored in DB for serverless environments where /tmp is ephemeral
      },
    })

    // Update job status
    const remaining = await db.translationTask.count({
      where: { jobId, status: { in: ["pending", "running"] } },
    })
    if (remaining === 0) {
      await db.translationJob.update({ where: { id: jobId }, data: { status: "completed" } })
      await db.systemSetting.deleteMany({ where: { key: `ai_job_key_${jobId}` } })

      // Notify job creator — fire-and-forget, email failure must not break the response
      try {
        const allTasks = await db.translationTask.findMany({
          where: { jobId },
          select: { targetLanguage: true },
        })
        const creator = await db.user.findUnique({
          where: { id: job.createdById },
          select: { email: true, name: true },
        })
        if (creator) {
          const durationSecs = Math.round((Date.now() - taskStartTime) / 1000)
          void sendJobCompleteEmail(
            creator.name,
            creator.email,
            job.name,
            allTasks.map((t: { targetLanguage: string }) => t.targetLanguage),
            jobId,
            durationSecs >= 60 ? durationSecs : undefined
          )
        }
      } catch {
        // Email errors are non-fatal
      }
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
