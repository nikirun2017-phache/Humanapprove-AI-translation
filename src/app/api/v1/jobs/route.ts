import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { resolveAuth } from "@/lib/resolve-auth"
import { requirePaymentMethod } from "@/lib/require-payment-method"
import {
  parseJsonSource, parseCsvSource, parseMarkdownSource, parseTxtSource,
  parseXliffSource, parseStringsSource, parseStringsDictSource,
  parseXcstringsSource, parsePoSource, parseAndroidXmlSource,
  parseArbSource, parsePropertiesSource,
} from "@/lib/source-parser"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

const ALLOWED_EXTS = new Set([
  "json","csv","md","txt","xliff","xlf","strings","stringsdict",
  "xcstrings","po","xml","arb","properties",
])

// GET /api/v1/jobs — list jobs for the authenticated user
export async function GET(req: NextRequest) {
  const auth = await resolveAuth(req)
  if (auth.kind === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100)
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0"), 0)

  const jobs = await db.translationJob.findMany({
    where: { createdById: auth.user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    include: {
      tasks: {
        select: {
          id: true,
          targetLanguage: true,
          status: true,
          wordCount: true,
          completedUnits: true,
          totalUnits: true,
        },
        orderBy: { targetLanguage: "asc" },
      },
    },
  })

  const base = new URL(req.url).origin

  return NextResponse.json(
    jobs.map(job => ({
      jobId: job.id,
      name: job.name,
      status: job.status,
      sourceFormat: job.sourceFormat,
      sourceLanguage: job.sourceLanguage,
      createdAt: job.createdAt,
      tasks: job.tasks.map(t => ({
        taskId: t.id,
        targetLanguage: t.targetLanguage,
        status: t.status,
        wordCount: t.wordCount,
        completedUnits: t.completedUnits,
        totalUnits: t.totalUnits,
        downloadUrl:
          t.status === "completed" || t.status === "imported"
            ? `${base}/api/v1/jobs/${job.id}/tasks/${t.id}/download`
            : null,
      })),
    }))
  )
}

/**
 * POST /api/v1/jobs — create a translation job and auto-trigger all tasks.
 *
 * multipart/form-data fields:
 *   file            — the file to translate (required)
 *   name            — job name (optional, defaults to filename)
 *   provider        — "anthropic" | "openai" | "gemini" | "deepseek" (required)
 *   model           — model ID, e.g. "claude-haiku-4-5-20251001" (required)
 *   targetLanguages — comma-separated BCP-47 codes OR JSON array (required)
 *   sourceLanguage  — BCP-47 source language (optional, default "en-US")
 *   callbackUrl     — HTTPS URL for completion webhook (optional)
 *   apiKey          — AI provider key override (optional, uses system key if omitted)
 *
 * Returns: { jobId, tasks: [{ taskId, targetLanguage }] }
 */
export async function POST(req: NextRequest) {
  // Auth
  const auth = await resolveAuth(req)
  if (auth.kind === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (auth.user.role === "reviewer") {
    return NextResponse.json({ error: "Reviewers cannot create translation jobs" }, { status: 403 })
  }

  // Payment method required
  const paymentError = requirePaymentMethod(auth.user)
  if (paymentError) return paymentError

  // Parse form data
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  const nameRaw = formData.get("name") as string | null
  const provider = formData.get("provider") as string | null
  const model = formData.get("model") as string | null
  const targetLanguagesRaw = formData.get("targetLanguages") as string | null
  const callbackUrl = formData.get("callbackUrl") as string | null
  const aiApiKey = formData.get("apiKey") as string | null
  let sourceLanguage = (formData.get("sourceLanguage") as string) || "en-US"

  if (!file || !provider || !model || !targetLanguagesRaw) {
    return NextResponse.json(
      { error: "Missing required fields: file, provider, model, targetLanguages" },
      { status: 400 }
    )
  }

  // File size limits
  const rawExtCheck = file.name.split(".").pop()?.toLowerCase()
  const maxBytes = 5 * 1024 * 1024 // 5 MB (PDF not supported via v1 API — use web UI)
  if (file.size > maxBytes) {
    return NextResponse.json({ error: "File exceeds the 5 MB size limit" }, { status: 413 })
  }

  const safeName = (nameRaw ?? file.name).replace(/[<>"'&]/g, "").trim().slice(0, 200) || file.name
  const rawExt = rawExtCheck ?? ""
  if (!ALLOWED_EXTS.has(rawExt)) {
    return NextResponse.json(
      { error: `Unsupported file type: .${rawExt}. Accepted: ${[...ALLOWED_EXTS].join(", ")}` },
      { status: 400 }
    )
  }
  const ext = rawExt === "xlf" ? "xliff" : rawExt

  // Validate callbackUrl is HTTPS if provided
  if (callbackUrl) {
    try {
      const u = new URL(callbackUrl)
      if (u.protocol !== "https:") throw new Error("Must be HTTPS")
    } catch {
      return NextResponse.json({ error: "callbackUrl must be a valid HTTPS URL" }, { status: 400 })
    }
  }

  // Parse targetLanguages — accept both comma-separated and JSON array
  let targetLanguages: string[]
  try {
    const raw = targetLanguagesRaw.trim()
    if (raw.startsWith("[")) {
      targetLanguages = JSON.parse(raw) as string[]
    } else {
      targetLanguages = raw.split(",").map(s => s.trim()).filter(Boolean)
    }
    if (!Array.isArray(targetLanguages) || targetLanguages.length === 0) throw new Error()
  } catch {
    return NextResponse.json(
      { error: "targetLanguages must be a comma-separated list or JSON array of BCP-47 codes" },
      { status: 400 }
    )
  }

  // Parse file content into translation units
  let units: Awaited<ReturnType<typeof parseJsonSource>> = []
  try {
    const content = await file.text()
    switch (ext) {
      case "json":        units = parseJsonSource(content); break
      case "md":          units = parseMarkdownSource(content); break
      case "txt":         units = parseTxtSource(content); break
      case "csv":         units = parseCsvSource(content); break
      case "xliff": {
        const result = parseXliffSource(content)
        units = result.units
        if (result.sourceLanguage) sourceLanguage = result.sourceLanguage
        break
      }
      case "strings":     units = parseStringsSource(content); break
      case "stringsdict": units = parseStringsDictSource(content); break
      case "xcstrings":   units = parseXcstringsSource(content); break
      case "po":          units = parsePoSource(content); break
      case "xml":         units = parseAndroidXmlSource(content); break
      case "arb":         units = parseArbSource(content); break
      case "properties":  units = parsePropertiesSource(content); break
      default:            units = parseCsvSource(content)
    }
  } catch (err) {
    return NextResponse.json({ error: `Failed to parse file: ${(err as Error).message}` }, { status: 400 })
  }

  if (units.length === 0) {
    return NextResponse.json({ error: "File contains no translatable strings" }, { status: 400 })
  }

  // Save source file to disk (non-critical backup)
  const uploadDir = path.join(process.env.NODE_ENV === "production" ? "/tmp" : process.cwd(), "uploads", "studio")
  const safeBase = `${Date.now()}-${safeName.replace(/[^a-zA-Z0-9._-]/g, "_")}`
  const sourceFilePath = path.join(uploadDir, `${safeBase}-source.${ext}`)
  const unitsFilePath = path.join(uploadDir, `${safeBase}-units.json`)
  const sourceFileContent = Buffer.from(await file.arrayBuffer())
  try {
    await mkdir(uploadDir, { recursive: true })
    await Promise.all([
      writeFile(sourceFilePath, sourceFileContent),
      writeFile(unitsFilePath, JSON.stringify(units), "utf-8"),
    ])
  } catch {
    // Non-fatal — data is in the DB
  }

  const wordCount = units.reduce(
    (sum, u) => sum + ((u.sourceText ?? u.source ?? "").split(/\s+/).filter(Boolean).length), 0
  )

  // Create job + tasks in a single transaction
  const apiKeyId = auth.kind === "apikey" ? auth.apiKeyId : undefined

  const job = await db.$transaction(async (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => {
    const j = await tx.translationJob.create({
      data: {
        name: safeName,
        createdById: auth.user.id,
        sourceFileUrl: sourceFilePath,
        unitsFileUrl: unitsFilePath,
        unitsData: JSON.stringify(units),
        sourceData: sourceFileContent.toString("utf-8"),
        sourceFormat: ext,
        sourceLanguage,
        provider,
        model,
        status: "pending",
        callbackUrl: callbackUrl ?? null,
        apiKeyId: apiKeyId ?? null,
      },
    })

    await tx.translationTask.createMany({
      data: targetLanguages.map((lang: string) => ({
        jobId: j.id,
        targetLanguage: lang,
        totalUnits: units.length,
        wordCount,
        status: "pending",
      })),
    })

    return j
  })

  // Store AI provider key scoped to this job (optional override)
  if (aiApiKey?.trim()) {
    await db.systemSetting.upsert({
      where: { key: `ai_job_key_${job.id}` },
      create: { key: `ai_job_key_${job.id}`, value: aiApiKey.trim() },
      update: { value: aiApiKey.trim() },
    })
  }

  // Load the created tasks to get their IDs
  const tasks = await db.translationTask.findMany({
    where: { jobId: job.id },
    select: { id: true, targetLanguage: true },
    orderBy: { targetLanguage: "asc" },
  })

  // Auto-trigger translation for each task (fire-and-forget)
  const origin = new URL(req.url).origin
  const authHeader = req.headers.get("authorization") ?? ""
  for (const task of tasks) {
    void fetch(`${origin}/api/translation-studio/jobs/${job.id}/tasks/${task.id}/translate`, {
      method: "POST",
      headers: { authorization: authHeader },
    }).catch(err => {
      console.error(`[v1/jobs] Failed to trigger task ${task.id}:`, (err as Error).message)
    })
  }

  return NextResponse.json(
    {
      jobId: job.id,
      tasks: tasks.map(t => ({ taskId: t.id, targetLanguage: t.targetLanguage })),
    },
    { status: 201 }
  )
}
