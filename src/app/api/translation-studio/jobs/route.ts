import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { parseJsonSource, parseCsvSource, parseMarkdownSource, parseTxtSource, parsePdfSource, parseXliffSource } from "@/lib/source-parser"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

// GET /api/translation-studio/jobs
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: userId, role } = session.user
  const jobs = await db.translationJob.findMany({
    where: role === "admin" ? {} : { createdById: userId },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      _count: { select: { tasks: true } },
    },
  })

  // Attach task status counts
  const withStats = await Promise.all(
    jobs.map(async (job: (typeof jobs)[number]) => {
      const tasks = await db.translationTask.findMany({
        where: { jobId: job.id },
        select: { status: true },
      })
      const completed = tasks.filter((t: (typeof tasks)[number]) => t.status === "completed" || t.status === "imported").length
      const failed = tasks.filter((t: (typeof tasks)[number]) => t.status === "failed").length
      return { ...job, completedTasks: completed, failedTasks: failed }
    })
  )

  return NextResponse.json(withStats)
}

// POST /api/translation-studio/jobs
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role === "reviewer") {
    return NextResponse.json({ error: "Reviewers cannot create translation jobs" }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const name = formData.get("name") as string
  const provider = formData.get("provider") as string
  const model = formData.get("model") as string
  const targetLanguagesRaw = formData.get("targetLanguages") as string
  const apiKey = formData.get("apiKey") as string | null
  const promoCodeInput = ((formData.get("promoCode") as string) || "").trim().toUpperCase()
  const glossaryRaw = (formData.get("glossaryData") as string | null) || null
  let sourceLanguage = (formData.get("sourceLanguage") as string) || "en-US"

  if (!file || !name || !provider || !model || !targetLanguagesRaw) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  // Enforce file size limit: 20 MB for PDF, 5 MB for all other types
  const MAX_PDF_BYTES = 20 * 1024 * 1024
  const MAX_TEXT_BYTES = 5 * 1024 * 1024
  const rawExtCheck = file.name.split(".").pop()?.toLowerCase()
  const maxBytes = rawExtCheck === "pdf" ? MAX_PDF_BYTES : MAX_TEXT_BYTES
  if (file.size > maxBytes) {
    const limitMb = maxBytes / 1024 / 1024
    return NextResponse.json({ error: `File exceeds the ${limitMb} MB size limit` }, { status: 413 })
  }

  // Sanitize job name to prevent stored XSS
  const safeName = name.replace(/[<>"'&]/g, "").trim().slice(0, 200)
  if (!safeName) {
    return NextResponse.json({ error: "Invalid job name" }, { status: 400 })
  }

  const rawExt = file.name.split(".").pop()?.toLowerCase()
  if (rawExt !== "json" && rawExt !== "csv" && rawExt !== "md" && rawExt !== "txt" && rawExt !== "pdf" && rawExt !== "xliff" && rawExt !== "xlf") {
    return NextResponse.json({ error: "Only .json, .csv, .md, .txt, .pdf, .xliff, or .xlf files are accepted" }, { status: 400 })
  }
  // Normalise .xlf → xliff so sourceFormat is consistent throughout
  const ext = rawExt === "xlf" ? "xliff" : rawExt

  let targetLanguages: string[]
  try {
    targetLanguages = JSON.parse(targetLanguagesRaw) as string[]
    if (!Array.isArray(targetLanguages) || targetLanguages.length === 0) throw new Error()
  } catch {
    return NextResponse.json({ error: "targetLanguages must be a non-empty JSON array" }, { status: 400 })
  }

  let units
  try {
    if (ext === "pdf") {
      // Resolve Anthropic API key — only needed as fallback for scanned PDFs.
      // Text-based PDFs are extracted directly (free, no API key required).
      let anthropicKey = apiKey?.trim() || ""
      if (!anthropicKey) {
        const systemKey = await db.systemSetting.findUnique({ where: { key: "ai_anthropic_key" } })
        anthropicKey = systemKey?.value ?? ""
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      // anthropicKey may be empty string — parsePdfSource will throw a clear error
      // only if the PDF is scanned and no key is available.
      units = await parsePdfSource(buffer, anthropicKey || undefined)
    } else if (ext === "xliff") {
      const content = await file.text()
      const result = parseXliffSource(content)
      units = result.units
      // Use the source language embedded in the XLIFF (overrides formData default)
      if (result.sourceLanguage) sourceLanguage = result.sourceLanguage
      if (units.length === 0) {
        return NextResponse.json({ error: "XLIFF file has no untranslated units — all <target> elements are already filled" }, { status: 400 })
      }
    } else {
      const content = await file.text()
      units = ext === "json" ? parseJsonSource(content)
            : ext === "md"   ? parseMarkdownSource(content)
            : ext === "txt"  ? parseTxtSource(content)
            : parseCsvSource(content)
    }
  } catch (err) {
    return NextResponse.json({ error: `Failed to parse file: ${(err as Error).message}` }, { status: 400 })
  }

  if (units.length === 0) {
    return NextResponse.json({ error: "File contains no translatable strings" }, { status: 400 })
  }

  // Save files
  const uploadDir = path.join(process.env.NODE_ENV === "production" ? "/tmp" : process.cwd(), "uploads", "studio")
  await mkdir(uploadDir, { recursive: true })

  const safeBase = `${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
  const sourceFileName = `${safeBase}-source.${ext}`
  const unitsFileName = `${safeBase}-units.json`

  const sourceFilePath = path.join(uploadDir, sourceFileName)
  const unitsFilePath = path.join(uploadDir, unitsFileName)

  const sourceFileContent = Buffer.from(await file.arrayBuffer())

  await Promise.all([
    writeFile(sourceFilePath, sourceFileContent),
    writeFile(unitsFilePath, JSON.stringify(units), "utf-8"),
  ])

  // Validate promo code if provided
  let appliedPromoCode: string | null = null
  let discountPct = 0
  if (promoCodeInput) {
    const promo = await db.promoCode.findUnique({ where: { code: promoCodeInput } })
    if (promo && promo.active &&
        (!promo.expiresAt || promo.expiresAt > new Date()) &&
        (promo.maxUses === null || promo.usedCount < promo.maxUses)) {
      appliedPromoCode = promo.code
      discountPct = promo.discountPct
    }
  }

  // Create job and tasks in a transaction
  const job = await db.$transaction(async (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => {
    const j = await tx.translationJob.create({
      data: {
        name: safeName,
        createdById: session.user.id,
        sourceFileUrl: sourceFilePath,
        unitsFileUrl: unitsFilePath,
        unitsData: JSON.stringify(units),
        // Store text-based source content in DB for serverless access (XLIFF, markdown, etc.)
        sourceData: ext !== "pdf" ? sourceFileContent.toString("utf-8") : null,
        sourceFormat: ext,
        sourceLanguage,
        provider,
        model,
        status: "pending",
        promoCode: appliedPromoCode,
        discountPct,
        glossaryData: glossaryRaw,
      },
    })

    // Increment usage counter on the promo code
    if (appliedPromoCode) {
      await tx.promoCode.update({
        where: { code: appliedPromoCode },
        data: { usedCount: { increment: 1 } },
      })
    }

    const wordCount = (units as Array<{ source?: string }>).reduce(
      (sum, u) => sum + (u.source?.split(/\s+/).filter(Boolean).length ?? 0), 0
    )

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

  // Store user-provided API key scoped to this job (never returned to client)
  if (apiKey?.trim()) {
    await db.systemSetting.upsert({
      where: { key: `ai_job_key_${job.id}` },
      create: { key: `ai_job_key_${job.id}`, value: apiKey.trim() },
      update: { value: apiKey.trim() },
    })
  }

  return NextResponse.json({ jobId: job.id }, { status: 201 })
}
