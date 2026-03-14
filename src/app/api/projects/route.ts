import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { parseXliff } from "@/lib/xliff-parser"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

// GET /api/projects - list projects visible to current user
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: userId, role } = session.user

  const where =
    role === "admin"
      ? {}
      : role === "reviewer"
        ? { assignedReviewerId: userId }
        : { createdById: userId }

  const projects = await db.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true, email: true } },
      assignedReviewer: { select: { name: true, email: true } },
      _count: { select: { units: true } },
    },
  })

  // Attach approved unit counts
  const withProgress = await Promise.all(
    projects.map(async (p) => {
      const approvedCount = await db.translationUnit.count({
        where: { projectId: p.id, status: "approved" },
      })
      return { ...p, approvedCount }
    })
  )

  return NextResponse.json(withProgress)
}

// POST /api/projects - upload XLIFF and create project
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (session.user.role === "reviewer") {
    return NextResponse.json({ error: "Reviewers cannot create projects" }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const name = formData.get("name") as string
  const assignedReviewerId = formData.get("assignedReviewerId") as string | null

  if (!file || !name) {
    return NextResponse.json({ error: "name and file are required" }, { status: 400 })
  }

  const ext = file.name.split(".").pop()?.toLowerCase()
  if (ext !== "xliff" && ext !== "xlf") {
    return NextResponse.json({ error: "Only .xliff or .xlf files are accepted" }, { status: 400 })
  }

  const xmlContent = await file.text()

  let parsed
  try {
    parsed = parseXliff(xmlContent)
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid XLIFF: ${(err as Error).message}` },
      { status: 400 }
    )
  }

  if (parsed.units.length === 0) {
    return NextResponse.json({ error: "XLIFF contains no translation units" }, { status: 400 })
  }

  // Save file to uploads/
  const uploadDir = path.join(process.cwd(), "uploads")
  await mkdir(uploadDir, { recursive: true })
  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
  const filePath = path.join(uploadDir, fileName)
  await writeFile(filePath, xmlContent, "utf-8")

  // Auto-assign reviewer if not specified: find first reviewer whose languages include targetLanguage
  let reviewerId = assignedReviewerId || null
  if (!reviewerId) {
    const candidates = await db.user.findMany({
      where: { role: "reviewer" },
    })
    const match = candidates.find((u) => {
      try {
        const langs: string[] = JSON.parse(u.languages)
        return langs.some(
          (l) =>
            l === parsed.targetLanguage ||
            l.startsWith(parsed.targetLanguage.split("-")[0])
        )
      } catch {
        return false
      }
    })
    if (match) reviewerId = match.id
  }

  // Create project and translation units in one transaction
  const project = await db.$transaction(async (tx) => {
    const proj = await tx.project.create({
      data: {
        name,
        sourceLanguage: parsed.sourceLanguage,
        targetLanguage: parsed.targetLanguage,
        xliffFileUrl: filePath,
        status: reviewerId ? "in_review" : "pending_assignment",
        createdById: session.user.id,
        assignedReviewerId: reviewerId,
      },
    })

    await tx.translationUnit.createMany({
      data: parsed.units.map((u) => ({
        projectId: proj.id,
        xliffUnitId: u.id,
        sourceText: u.sourceText,
        targetText: u.targetText,
        orderIndex: u.orderIndex,
        metadata: JSON.stringify(u.metadata),
      })),
    })

    if (reviewerId) {
      await tx.reviewSession.create({
        data: {
          projectId: proj.id,
          reviewerId,
        },
      })
    }

    return proj
  })

  return NextResponse.json(project, { status: 201 })
}
