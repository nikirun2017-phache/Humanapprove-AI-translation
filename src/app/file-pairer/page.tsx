"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { STUDIO_LANGUAGES } from "@/lib/languages"

interface Reviewer {
  id: string
  name: string
  email: string
  languages: string
  isPlatformReviewer: boolean
}

interface AlignmentPreview {
  id: string
  sourceText: string
  targetText: string
  matched: boolean
}

const PLATFORM_REVIEW_RATE = 0.03

export default function FilePairerPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [targetFile, setTargetFile] = useState<File | null>(null)
  const [sourceLanguage, setSourceLanguage] = useState("en-US")
  const [targetLanguage, setTargetLanguage] = useState("")
  const [reviewers, setReviewers] = useState<Reviewer[]>([])
  const [assignedReviewerId, setAssignedReviewerId] = useState("")
  const [reviewerType, setReviewerType] = useState<"own" | "platform">("own")
  const [preview, setPreview] = useState<AlignmentPreview[] | null>(null)
  const [previewStats, setPreviewStats] = useState<{ matched: number; total: number } | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch("/api/users?role=reviewer")
      .then((r) => r.json())
      .then(setReviewers)
      .catch(() => {})
  }, [])

  // Re-compute preview whenever both files change
  useEffect(() => {
    if (!sourceFile || !targetFile) {
      setPreview(null)
      setPreviewStats(null)
      return
    }
    buildPreview(sourceFile, targetFile)
  }, [sourceFile, targetFile])

  async function buildPreview(src: File, tgt: File) {
    try {
      const [srcText, tgtText] = await Promise.all([src.text(), tgt.text()])
      const srcUnits = parseFileClient(srcText, fileExt(src.name))
      const tgtUnits = parseFileClient(tgtText, fileExt(tgt.name))
      const tgtMap = new Map(tgtUnits.map((u: (typeof tgtUnits)[number]) => [u.id, u.text]))

      const rows: AlignmentPreview[] = srcUnits.map((u: (typeof srcUnits)[number]) => ({
        id: u.id,
        sourceText: u.text,
        targetText: tgtMap.get(u.id) ?? "",
        matched: tgtMap.has(u.id),
      }))

      const matchedCount = rows.filter((r: (typeof rows)[number]) => r.matched).length
      setPreview(rows.slice(0, 50)) // show first 50 for performance
      setPreviewStats({ matched: matchedCount, total: srcUnits.length })
    } catch {
      setPreview(null)
      setPreviewStats(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (!sourceFile || !targetFile) {
      setError("Please select both a source file and a target file.")
      return
    }
    if (!targetLanguage) {
      setError("Please select a target language.")
      return
    }
    if (!name.trim()) {
      setError("Please enter a project name.")
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("sourceFile", sourceFile)
      formData.append("targetFile", targetFile)
      formData.append("sourceLanguage", sourceLanguage)
      formData.append("targetLanguage", targetLanguage)
      formData.append("name", name.trim())
      if (assignedReviewerId) {
        formData.append("assignedReviewerId", assignedReviewerId)
        formData.append("reviewerType", reviewerType)
      }

      const res = await fetch("/api/file-pairer", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to create project")
        return
      }
      router.push(`/projects/${data.projectId}`)
    } catch {
      setError("Network error — please try again.")
    } finally {
      setLoading(false)
    }
  }

  const ownReviewers = reviewers.filter((r: (typeof reviewers)[number]) => !r.isPlatformReviewer)
  const platformReviewers = reviewers.filter((r: (typeof reviewers)[number]) => r.isPlatformReviewer)

  const selectedReviewer = reviewers.find((r: (typeof reviewers)[number]) => r.id === assignedReviewerId)
  const wordEstimate = previewStats
    ? Math.round((previewStats.matched / Math.max(1, previewStats.total)) * previewStats.total * 15)
    : 0
  const platformCost =
    reviewerType === "platform" && selectedReviewer?.isPlatformReviewer
      ? (wordEstimate * PLATFORM_REVIEW_RATE).toFixed(2)
      : null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">File Pairer</h1>
        <p className="text-sm text-gray-500 mb-8">
          Upload a source and target file (JSON, CSV, or Markdown) to generate a bilingual XLIFF for
          side-by-side review. Once approved, download the bilingual XLIFF or a clean target file.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. App strings – v2.1 Japanese review"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Language selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source language</label>
              <select
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {STUDIO_LANGUAGES.map((l: (typeof STUDIO_LANGUAGES)[number]) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target language</label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a language…</option>
                {STUDIO_LANGUAGES.map((l: (typeof STUDIO_LANGUAGES)[number]) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* File uploads */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source file <span className="text-gray-400 font-normal">(JSON / CSV / MD)</span>
              </label>
              <input
                type="file"
                accept=".json,.csv,.md,.markdown"
                onChange={(e) => setSourceFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {sourceFile && (
                <p className="mt-1 text-xs text-gray-500">{sourceFile.name}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target file <span className="text-gray-400 font-normal">(same format)</span>
              </label>
              <input
                type="file"
                accept=".json,.csv,.md,.markdown"
                onChange={(e) => setTargetFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {targetFile && (
                <p className="mt-1 text-xs text-gray-500">{targetFile.name}</p>
              )}
            </div>
          </div>

          {/* Alignment preview */}
          {previewStats && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 flex items-center justify-between border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">Alignment preview</span>
                <span className="text-xs text-gray-500">
                  {previewStats.matched} / {previewStats.total} units matched
                  {previewStats.matched < previewStats.total && (
                    <span className="ml-2 text-amber-600">
                      — {previewStats.total - previewStats.matched} unmatched (will be empty)
                    </span>
                  )}
                </span>
              </div>
              <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {preview?.map((row: (typeof preview)[number]) => (
                  <div
                    key={row.id}
                    className={`grid grid-cols-2 text-xs px-4 py-2 gap-4 ${!row.matched ? "bg-amber-50" : ""}`}
                  >
                    <div className="text-gray-700 truncate">
                      <span className="text-gray-400 font-mono mr-1">[{row.id}]</span>
                      {row.sourceText}
                    </div>
                    <div className={row.matched ? "text-gray-700 truncate" : "text-amber-500 italic"}>
                      {row.matched ? row.targetText : "— no match —"}
                    </div>
                  </div>
                ))}
              </div>
              {preview && previewStats.total > 50 && (
                <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 bg-gray-50">
                  Showing first 50 of {previewStats.total} units
                </div>
              )}
            </div>
          )}

          {/* Reviewer assignment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Assign reviewer</label>
            <div className="space-y-3">
              {/* Own reviewers */}
              {ownReviewers.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Your reviewers</p>
                  <div className="space-y-1">
                    {ownReviewers.map((r: (typeof reviewers)[number]) => (
                      <label key={r.id} className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="radio"
                          name="reviewer"
                          value={r.id}
                          checked={assignedReviewerId === r.id}
                          onChange={() => {
                            setAssignedReviewerId(r.id)
                            setReviewerType("own")
                          }}
                          className="text-indigo-600"
                        />
                        <span className="text-sm text-gray-800">{r.name}</span>
                        <span className="text-xs text-gray-400">{r.email}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Platform reviewers */}
              {platformReviewers.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">
                    Platform reviewers{" "}
                    <span className="text-amber-600 font-medium">+150% fee (${PLATFORM_REVIEW_RATE}/word)</span>
                  </p>
                  <div className="space-y-1">
                    {platformReviewers.map((r: (typeof reviewers)[number]) => {
                      let langs: string[] = []
                      try {
                        langs = JSON.parse(r.languages)
                      } catch {}
                      return (
                        <label key={r.id} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="reviewer"
                            value={r.id}
                            checked={assignedReviewerId === r.id}
                            onChange={() => {
                              setAssignedReviewerId(r.id)
                              setReviewerType("platform")
                            }}
                            className="text-indigo-600"
                          />
                          <span className="text-sm text-gray-800">{r.name}</span>
                          <span className="text-xs text-gray-400">{langs.join(", ")}</span>
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                            +150% fee
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* No reviewer option */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="reviewer"
                  value=""
                  checked={assignedReviewerId === ""}
                  onChange={() => {
                    setAssignedReviewerId("")
                    setReviewerType("own")
                  }}
                  className="text-indigo-600"
                />
                <span className="text-sm text-gray-500">Assign later</span>
              </label>
            </div>

            {/* Platform cost estimate */}
            {platformCost && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
                <p className="text-amber-800">
                  Estimated review fee:{" "}
                  <strong>${platformCost}</strong>{" "}
                  <span className="text-amber-600">
                    (~{wordEstimate.toLocaleString()} words × ${PLATFORM_REVIEW_RATE}/word)
                  </span>
                </p>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !sourceFile || !targetFile || !targetLanguage || !name.trim()}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating project…" : "Generate XLIFF & start review"}
          </button>
        </form>
      </div>
    </div>
  )
}

function fileExt(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? ""
}

interface ParsedUnit {
  id: string
  text: string
}

/** Client-side lightweight parser for alignment preview only */
function parseFileClient(content: string, ext: string): ParsedUnit[] {
  if (ext === "json") {
    try {
      const obj = JSON.parse(content) as unknown
      return flattenJsonClient(obj)
    } catch {
      return []
    }
  }
  if (ext === "csv") {
    const lines = content.split(/\r?\n/).filter((l: string) => l.trim())
    if (lines.length === 0) return []
    const first = lines[0].split(",").map((c: string) => c.trim().toLowerCase().replace(/"/g, ""))
    const hasHeader = first[0] === "id" || first[0] === "key" || first[0] === "name"
    return (hasHeader ? lines.slice(1) : lines).flatMap((line: string) => {
      const cols = line.split(",")
      const id = cols[0]?.trim().replace(/^\"|\"$/g, "")
      const text = cols[1]?.trim().replace(/^\"|\"$/g, "")
      return id && text ? [{ id, text }] : []
    })
  }
  if (ext === "md" || ext === "markdown") {
    const units: ParsedUnit[] = []
    let idx = 0
    for (const line of content.split(/\r?\n/)) {
      const h = line.match(/^(#{1,6})\s+(.+)$/)
      if (h) { units.push({ id: `h${h[1].length}_${idx++}`, text: h[2].trim() }); continue }
      const li = line.match(/^(\s*(?:[-*+]|\d+\.)\s+)(.+)$/)
      if (li) { units.push({ id: `li_${idx++}`, text: li[2].trim() }); continue }
      const t = line.trim()
      if (t && t.split(/\s+/).length >= 3) units.push({ id: `p_${idx++}`, text: t })
    }
    return units
  }
  return []
}

function flattenJsonClient(obj: unknown, prefix = ""): ParsedUnit[] {
  const result: ParsedUnit[] = []
  if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      const fullKey = prefix ? `${prefix}.${key}` : key
      if (typeof val === "string") result.push({ id: fullKey, text: val })
      else if (typeof val === "object") result.push(...flattenJsonClient(val, fullKey))
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      if (typeof item === "object" && item !== null) {
        const e = item as Record<string, unknown>
        const id = String(e.id ?? e.key ?? e.name ?? "")
        const text = String(e.value ?? e.text ?? e.source ?? "")
        if (id && text) result.push({ id, text })
      }
    }
  }
  return result
}
