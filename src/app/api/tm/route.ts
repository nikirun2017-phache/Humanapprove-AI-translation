import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/tm?sourceLang=en-US&targetLang=fr-FR&q=Hello+world
// Returns top-5 fuzzy-matched TM entries for the user
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const sourceLang = searchParams.get("sourceLang")
  const targetLang = searchParams.get("targetLang")
  const q = (searchParams.get("q") ?? "").trim()

  if (!sourceLang || !targetLang || !q) {
    return NextResponse.json({ error: "sourceLang, targetLang, and q are required" }, { status: 400 })
  }

  const userId = session.user.id

  // Fetch all TM entries for this user + language pair (dataset is small per user)
  const entries = await db.translationMemory.findMany({
    where: { userId, sourceLang, targetLang },
    select: { id: true, sourceText: true, targetText: true, usageCount: true },
  })

  // Score each entry against the query
  const qLower = q.toLowerCase()

  type ScoredEntry = {
    id: string
    sourceText: string
    targetText: string
    similarity: number
    usageCount: number
  }

  const scored: ScoredEntry[] = []
  for (const entry of entries) {
    const srcLower = entry.sourceText.toLowerCase()
    let similarity = 0
    if (srcLower === qLower) {
      similarity = 100
    } else if (srcLower.includes(qLower) || qLower.includes(srcLower)) {
      similarity = 80
    } else if (srcLower.startsWith(qLower) || qLower.startsWith(srcLower)) {
      similarity = 80
    }
    if (similarity > 0) {
      scored.push({
        id: entry.id,
        sourceText: entry.sourceText,
        targetText: entry.targetText,
        similarity,
        usageCount: entry.usageCount,
      })
    }
  }

  // Sort by similarity desc, then usageCount desc, then take top 5
  scored.sort((a, b) => {
    if (b.similarity !== a.similarity) return b.similarity - a.similarity
    return b.usageCount - a.usageCount
  })

  return NextResponse.json({ matches: scored.slice(0, 5) })
}
