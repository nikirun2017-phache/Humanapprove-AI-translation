import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { parseJsonSource, parseCsvSource, parseMarkdownSource } from "@/lib/source-parser"
import { buildXliffFromTranslations } from "@/lib/xliff-builder"
import type { SourceUnit } from "@/lib/source-parser"

/**
 * POST /api/file-pairer
 *
 * Accepts a source file and a target file (JSON, CSV, or Markdown) and:
 * 1. Parses both files into SourceUnit arrays
 * 2. Aligns units by matching ID
 * 3. Generates a bilingual XLIFF
 * 4. Creates a Project + TranslationUnit records for review
 *
 * Body (multipart/form-data):
 *   sourceFile         File   — source language file (json | csv | md)
 *   targetFile         File   — target language file (same format)
 *   sourceLanguage     string — BCP-47 code, e.g. "en-US"
 *   targetLanguage     string — BCP-47 code, e.g. "ja-JP"
 *   name               string — project name
 *   assignedReviewerId string? — optional reviewer user id
 *   reviewerType       string? — "own" | "platform" (default "own")
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role === "reviewer") {
    return NextResponse.json({ error: "Reviewers cannot create projects" }, { status: 403 })
  }

  const formData = await req.formData()
  const sourceFile = formData.get("sourceFile") as File | null
  const targetFile = formData.get("targetFile") as File | null
  const sourceLanguage = (formData.get("sourceLanguage") as string | null)?.trim()
  const targetLanguage = (formData.get("targetLanguage") as string | null)?.trim()
  const name = (formData.get("name") as string | null)?.trim()
  const assignedReviewerId = formData.get("assignedReviewerId") as string | null
  const reviewerType = (formData.get("reviewerType") as string | null) ?? "own"

  if (!sourceFile || !targetFile || !sourceLanguage || !targetLanguage || !name) {
    return NextResponse.json(
      { error: "sourceFile, targetFile, sourceLanguage, targetLanguage, and name are required" },
      { status: 400 }
    )
  }

  // Determine file format from extension (both files must be the same format)
  const srcExt = sourceFile.name.split(".").pop()?.toLowerCase()
  const tgtExt = targetFile.name.split(".").pop()?.toLowerCase()
  const supported = ["json", "csv", "md"]

  if (!srcExt || !supported.includes(srcExt)) {
    return NextResponse.json(
      { error: "Source file must be .json, .csv, or .md" },
      { status: 400 }
    )
  }
  if (!tgtExt || !supported.includes(tgtExt)) {
    return NextResponse.json(
      { error: "Target file must be .json, .csv, or .md" },
      { status: 400 }
    )
  }

  const sourceText = await sourceFile.text()
  const targetText = await targetFile.text()

  // Parse both files
  let sourceUnits: SourceUnit[]
  let targetUnits: SourceUnit[]
  try {
    sourceUnits = parseFile(sourceText, srcExt)
    targetUnits = parseFile(targetText, tgtExt)
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to parse files: ${(err as Error).message}` },
      { status: 400 }
    )
  }

  if (sourceUnits.length === 0) {
    return NextResponse.json({ error: "Source file contains no translatable units" }, { status: 400 })
  }

  // Build target map: id → translated text
  const targetMap = new Map(targetUnits.map((u) => [u.id, u.sourceText]))

  // Align: only units present in source; mark missing target as empty string
  const translatedUnits = sourceUnits.map((u) => ({
    id: u.id,
    translatedText: targetMap.get(u.id) ?? "",
  }))

  const matchedCount = translatedUnits.filter((u) => u.translatedText !== "").length

  // Build bilingual XLIFF
  const xliffContent = buildXliffFromTranslations(
    sourceUnits,
    translatedUnits,
    sourceLanguage,
    targetLanguage,
    sourceFile.name
  )

  // Save XLIFF to uploads/
  const uploadDir = path.join(process.cwd(), "uploads")
  await mkdir(uploadDir, { recursive: true })
  const safeBase = name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const xliffFileName = `${Date.now()}-${safeBase}.xliff`
  const xliffFilePath = path.join(uploadDir, xliffFileName)
  await writeFile(xliffFilePath, xliffContent, "utf-8")

  // Auto-assign reviewer if not provided
  let reviewerId = assignedReviewerId || null
  let resolvedReviewerType = reviewerType
  if (!reviewerId) {
    const candidates = await db.user.findMany({ where: { role: "reviewer" } })
    const matches = candidates.filter((u) => {
      try {
        const langs: string[] = JSON.parse(u.languages)
        return langs.some(
          (l) =>
            l === targetLanguage ||
            l.startsWith(targetLanguage.split("-")[0])
        )
      } catch {
        return false
      }
    })
    const ownMatch = matches.find((u) => !u.isPlatformReviewer)
    const platformMatch = matches.find((u) => u.isPlatformReviewer)
    if (ownMatch) {
      reviewerId = ownMatch.id
      resolvedReviewerType = "own"
    } else if (platformMatch) {
      reviewerId = platformMatch.id
      resolvedReviewerType = "platform"
    }
  }

  // Create project and translation units in one transaction
  const project = await db.$transaction(async (tx) => {
    const proj = await tx.project.create({
      data: {
        name,
        sourceLanguage,
        targetLanguage,
        originalFormat: srcExt,
        xliffFileUrl: xliffFilePath,
        status: reviewerId ? "in_review" : "pending_assignment",
        createdById: session.user.id,
        assignedReviewerId: reviewerId,
        reviewerType: resolvedReviewerType,
      },
    })

    await tx.translationUnit.createMany({
      data: sourceUnits.map((u, i) => ({
        projectId: proj.id,
        xliffUnitId: u.id,
        sourceText: u.sourceText,
        targetText: targetMap.get(u.id) ?? "",
        orderIndex: i,
        metadata: "{}",
      })),
    })

    if (reviewerId) {
      await tx.reviewSession.create({
        data: { projectId: proj.id, reviewerId },
      })
    }

    return proj
  })

  return NextResponse.json({
    projectId: project.id,
    matchedCount,
    totalSource: sourceUnits.length,
    totalTarget: targetUnits.length,
  })
}

function parseFile(content: string, ext: string): SourceUnit[] {
  switch (ext) {
    case "json":
      return parseJsonSource(content)
    case "csv":
      return parseCsvSource(content)
    case "md":
      return parseMarkdownSource(content)
    default:
      throw new Error(`Unsupported format: ${ext}`)
  }
}
