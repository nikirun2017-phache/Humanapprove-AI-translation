import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { parseJsonSource, parseCsvSource, parseMarkdownSource, parseXliffSource, parseStringsSource, parseStringsDictSource, parseXcstringsSource, parsePoSource, parseAndroidXmlSource, parseArbSource, parsePropertiesSource } from "@/lib/source-parser"

const SUPPORTED_EXTS = new Set(["json","csv","md","xliff","xlf","strings","stringsdict","xcstrings","po","xml","arb","properties"])

/** Parse a GitHub PR URL and return owner, repo, prNumber */
function parsePrUrl(url: string): { owner: string; repo: string; prNumber: number } | null {
  try {
    const u = new URL(url)
    if (u.hostname !== "github.com") return null
    const parts = u.pathname.replace(/^\//, "").split("/")
    // Expected: owner / repo / pull / number
    if (parts.length < 4 || parts[2] !== "pull") return null
    const prNumber = parseInt(parts[3], 10)
    if (isNaN(prNumber)) return null
    return { owner: parts[0], repo: parts[1], prNumber }
  } catch {
    return null
  }
}

function fileExt(path: string): string {
  return path.split(".").pop()?.toLowerCase() ?? ""
}

function countWords(units: { sourceText: string }[]): number {
  return units.reduce((acc: number, u: { sourceText: string }) => acc + u.sourceText.split(/\s+/).filter(Boolean).length, 0)
}

/**
 * POST /api/translation-studio/probe-github-pr
 *
 * Body JSON: { url: string, token?: string }
 *
 * Returns preflight summary:
 *   { owner, repo, prNumber, branch, sourceLanguage?,
 *     files: [{ path, ext, content, unitCount, wordCount }],
 *     skippedFiles: [{ path, reason }],
 *     totalUnits, totalWordCount }
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as { url?: string; token?: string }
  const { url, token } = body

  if (!url?.trim()) {
    return NextResponse.json({ error: "url is required" }, { status: 400 })
  }

  const parsed = parsePrUrl(url.trim())
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid GitHub PR URL. Expected format: https://github.com/owner/repo/pull/123" },
      { status: 400 }
    )
  }

  const { owner, repo, prNumber } = parsed
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
  if (token?.trim()) headers["Authorization"] = `Bearer ${token.trim()}`

  // Fetch PR metadata to get the head branch
  const prRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, { headers })
  if (prRes.status === 404) {
    return NextResponse.json(
      { error: "PR not found. Check the URL or provide a GitHub token for private repositories." },
      { status: 404 }
    )
  }
  if (prRes.status === 401 || prRes.status === 403) {
    return NextResponse.json(
      { error: "GitHub returned 403 — this repository may be private. Provide a GitHub token with repo read access." },
      { status: 403 }
    )
  }
  if (!prRes.ok) {
    const text = await prRes.text()
    return NextResponse.json({ error: `GitHub API error: ${prRes.status} — ${text.slice(0, 200)}` }, { status: 502 })
  }

  const prData = await prRes.json() as { head: { ref: string }; state: string }
  const branch = prData.head.ref

  // Fetch changed files (max 300 files per GitHub API)
  const filesRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`,
    { headers }
  )
  if (!filesRes.ok) {
    return NextResponse.json({ error: "Failed to fetch PR file list from GitHub" }, { status: 502 })
  }

  const prFiles = await filesRes.json() as Array<{
    filename: string
    status: string
    raw_url: string
    patch?: string
  }>

  const eligibleFiles = prFiles.filter(
    (f: (typeof prFiles)[number]) => f.status !== "removed" && SUPPORTED_EXTS.has(fileExt(f.filename))
  )

  const skippedFiles: { path: string; reason: string }[] = prFiles
    .filter((f: (typeof prFiles)[number]) => f.status === "removed" || !SUPPORTED_EXTS.has(fileExt(f.filename)))
    .map((f: (typeof prFiles)[number]) => ({
      path: f.filename,
      reason: f.status === "removed"
        ? "File was deleted in this PR"
        : `Unsupported type (.${fileExt(f.filename)}) — only JSON, CSV, MD, XLIFF supported`,
    }))

  if (eligibleFiles.length === 0) {
    return NextResponse.json({
      owner, repo, prNumber, branch,
      files: [],
      skippedFiles,
      totalUnits: 0,
      totalWordCount: 0,
      message: "No translatable files found in this PR.",
    })
  }

  // Fetch and parse each eligible file
  const files: {
    path: string
    ext: string
    content: string
    unitCount: number
    wordCount: number
    sourceLanguage?: string
  }[] = []

  await Promise.all(
    eligibleFiles.map(async (f: (typeof eligibleFiles)[number]) => {
      try {
        const rawRes = await fetch(f.raw_url, { headers })
        if (!rawRes.ok) {
          skippedFiles.push({ path: f.filename, reason: `Could not fetch file content (${rawRes.status})` })
          return
        }
        const content = await rawRes.text()
        const ext = fileExt(f.filename)

        let unitCount = 0
        let wordCount = 0
        let sourceLanguage: string | undefined

        if (ext === "json") {
          const units = parseJsonSource(content)
          unitCount = units.length; wordCount = countWords(units)
        } else if (ext === "csv") {
          const units = parseCsvSource(content)
          unitCount = units.length; wordCount = countWords(units)
        } else if (ext === "md") {
          const units = parseMarkdownSource(content)
          unitCount = units.length; wordCount = countWords(units)
        } else if (ext === "strings") {
          const units = parseStringsSource(content)
          unitCount = units.length; wordCount = countWords(units)
        } else if (ext === "stringsdict") {
          const units = parseStringsDictSource(content)
          unitCount = units.length; wordCount = countWords(units)
        } else if (ext === "xcstrings") {
          const units = parseXcstringsSource(content)
          unitCount = units.length; wordCount = countWords(units)
        } else if (ext === "po") {
          const units = parsePoSource(content)
          unitCount = units.length; wordCount = countWords(units)
        } else if (ext === "xml") {
          const units = parseAndroidXmlSource(content)
          unitCount = units.length; wordCount = countWords(units)
        } else if (ext === "arb") {
          const units = parseArbSource(content)
          unitCount = units.length; wordCount = countWords(units)
        } else if (ext === "properties") {
          const units = parsePropertiesSource(content)
          unitCount = units.length; wordCount = countWords(units)
        } else if (ext === "xliff" || ext === "xlf") {
          const result = parseXliffSource(content)
          unitCount = result.units.length
          wordCount = countWords(result.units)
          sourceLanguage = result.sourceLanguage
          if (unitCount === 0) {
            skippedFiles.push({ path: f.filename, reason: "XLIFF has no untranslated units (all <target> elements are filled)" })
            return
          }
        }

        if (unitCount === 0) {
          skippedFiles.push({ path: f.filename, reason: "No translatable strings found in this file" })
          return
        }

        files.push({ path: f.filename, ext, content, unitCount, wordCount, sourceLanguage })
      } catch {
        skippedFiles.push({ path: f.filename, reason: "Failed to parse file content" })
      }
    })
  )

  const totalUnits = files.reduce((s: number, f: (typeof files)[number]) => s + f.unitCount, 0)
  const totalWordCount = files.reduce((s: number, f: (typeof files)[number]) => s + f.wordCount, 0)

  return NextResponse.json({ owner, repo, prNumber, branch, files, skippedFiles, totalUnits, totalWordCount })
}
