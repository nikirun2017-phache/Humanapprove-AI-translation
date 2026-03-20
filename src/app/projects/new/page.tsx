"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/navbar"

interface Reviewer {
  id: string
  name: string
  email: string
  languages: string
  isPlatformReviewer: boolean
}

export default function NewProjectPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [reviewers, setReviewers] = useState<Reviewer[]>([])
  const [assignedReviewerId, setAssignedReviewerId] = useState("")
  const [reviewerType, setReviewerType] = useState<"own" | "platform">("own")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [detectedLang, setDetectedLang] = useState<{ src: string; tgt: string } | null>(null)
  const [fileStats, setFileStats] = useState<{
    unitCount: number
    wordCount: number
    isBilingual: boolean
  } | null>(null)

  useEffect(() => {
    fetch("/api/users?role=reviewer")
      .then((r) => r.json())
      .then(setReviewers)
      .catch(() => {})
  }, [])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    // Detect languages from XLIFF
    try {
      const text = await f.text()
      const srcMatch = text.match(/source-language="([^"]+)"/)
      const tgtMatch = text.match(/target-language="([^"]+)"/)
      if (srcMatch || tgtMatch) {
        setDetectedLang({
          src: srcMatch?.[1] || "?",
          tgt: tgtMatch?.[1] || "?",
        })
      }

      // Count segments and target words
      const unitCount = (text.match(/<trans-unit|<unit\b/g) || []).length
      const targetMatches = [...text.matchAll(/<target[^>]*>([\s\S]*?)<\/target>/g)]
      const targetWords = targetMatches
        .map((m) => m[1].replace(/<[^>]+>/g, " ").trim())
        .join(" ")
        .split(/\s+/)
        .filter(Boolean).length
      setFileStats({ unitCount, wordCount: targetWords, isBilingual: targetWords > 0 })
    } catch {
      // ignore
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !name.trim()) {
      setError("Project name and XLIFF file are required")
      return
    }

    setLoading(true)
    setError("")

    const formData = new FormData()
    formData.append("name", name.trim())
    formData.append("file", file)
    if (assignedReviewerId) {
      formData.append("assignedReviewerId", assignedReviewerId)
      formData.append("reviewerType", reviewerType)
    }

    const res = await fetch("/api/projects", {
      method: "POST",
      body: formData,
    })

    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || "Upload failed")
      return
    }

    const project = await res.json()
    router.push(`/projects/${project.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Upload XLIFF</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create a new review project from an XLIFF file
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-gray-200 p-6 space-y-5"
        >
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. product-docs-v2"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              XLIFF file
            </label>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-indigo-300 transition-colors">
              <input
                type="file"
                accept=".xliff,.xlf"
                onChange={handleFileChange}
                className="hidden"
                id="xliff-file"
              />
              <label htmlFor="xliff-file" className="cursor-pointer">
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                    {detectedLang && (
                      <p className="text-xs text-indigo-600 mt-1">
                        {detectedLang.src} → {detectedLang.tgt}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-500">
                      Click to select a <strong>.xliff</strong> or <strong>.xlf</strong> file
                    </p>
                    <p className="text-xs text-gray-400 mt-1">XLIFF 1.2 and 2.0 supported</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {file && fileStats && (() => {
            const LIGHT_RATE = 0.035
            const LQA_RATE = 0.090
            const PLATFORM_REVIEW_RATE = 0.055
            const LIGHT_WPH = 1200
            const LQA_WPH = 800
            const lightHours = fileStats.wordCount / LIGHT_WPH
            const lqaHours = fileStats.wordCount / LQA_WPH
            const lightCost = fileStats.wordCount * LIGHT_RATE
            const lqaCost = fileStats.wordCount * LQA_RATE
            const platformCost = fileStats.wordCount * PLATFORM_REVIEW_RATE

            function fmtHours(h: number) {
              return h < 1 ? `~${Math.round(h * 60)} min` : `~${h.toFixed(1)} hrs`
            }
            function fmtCost(n: number) {
              return `$${n.toFixed(2)}`
            }

            return (
              <div className="rounded-xl border border-gray-200 overflow-hidden text-sm">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <span className="font-medium text-gray-900">
                    {fileStats.isBilingual ? "Human Review Estimate" : "File Analysis"}
                  </span>
                  {fileStats.isBilingual ? (
                    <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      Bilingual ✓
                    </span>
                  ) : (
                    <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      Source-only
                    </span>
                  )}
                </div>

                <div className="px-4 py-3 space-y-1.5 border-b border-gray-100">
                  <div className="flex justify-between text-gray-600">
                    <span>Segments</span>
                    <span className="font-medium text-gray-900">{fileStats.unitCount.toLocaleString()} units</span>
                  </div>
                  {fileStats.isBilingual ? (
                    <div className="flex justify-between text-gray-600">
                      <span>Word count (target)</span>
                      <span className="font-medium text-gray-900">{fileStats.wordCount.toLocaleString()} words</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-gray-600">
                      <span>Target content</span>
                      <span className="text-gray-400 italic">None detected</span>
                    </div>
                  )}
                </div>

                {fileStats.isBilingual ? (
                  <>
                    <div className="grid grid-cols-4 px-4 py-2 bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                      <span></span>
                      <span className="text-center font-medium">Light review</span>
                      <span className="text-center font-medium">Full LQA</span>
                      <span className="text-center font-medium">Jendee AI</span>
                    </div>
                    <div className="grid grid-cols-4 px-4 py-2 text-gray-600 border-b border-gray-100 text-xs">
                      <span className="text-sm">Rate</span>
                      <span className="text-center">${LIGHT_RATE.toFixed(3)}/word</span>
                      <span className="text-center">${LQA_RATE.toFixed(3)}/word</span>
                      <span className="text-center">${PLATFORM_REVIEW_RATE.toFixed(3)}/word</span>
                    </div>
                    <div className="grid grid-cols-4 px-4 py-2 text-gray-600 border-b border-gray-100 text-xs">
                      <span className="text-sm">Est. time</span>
                      <span className="text-center">{fmtHours(lightHours)}</span>
                      <span className="text-center">{fmtHours(lqaHours)}</span>
                      <span className="text-center text-indigo-600">Managed</span>
                    </div>
                    <div className="grid grid-cols-4 px-4 py-2.5 text-gray-900 font-semibold border-b border-gray-100">
                      <span>Est. cost</span>
                      <span className="text-center text-indigo-700">{fmtCost(lightCost)}</span>
                      <span className="text-center text-indigo-700">{fmtCost(lqaCost)}</span>
                      <span className="text-center text-indigo-700">{fmtCost(platformCost)}</span>
                    </div>
                    <div className="px-4 py-2.5 bg-amber-50 text-xs text-amber-700">
                      ⚠ Estimate only. Actual cost varies by content complexity and reviewer speed.
                      Light review ~1,200 words/hr · Full LQA ~800 words/hr.
                    </div>
                  </>
                ) : (
                  <div className="px-4 py-3 bg-blue-50 text-xs text-blue-700">
                    Human review estimate not applicable — no existing translations found. Use{" "}
                    <a href="/translation-studio" className="underline font-medium">Translation Studio</a>{" "}
                    to generate AI translations first.
                  </div>
                )}
              </div>
            )
          })()}

          {/* ── Reviewer assignment ─────────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assign reviewer{" "}
              <span className="text-gray-400 font-normal">(optional — auto-matched by language)</span>
            </label>

            {/* Auto-assign option */}
            <label className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer mb-2 transition-colors ${assignedReviewerId === "" ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:bg-gray-50"}`}>
              <input
                type="radio"
                name="reviewer"
                value=""
                checked={assignedReviewerId === ""}
                onChange={() => { setAssignedReviewerId(""); setReviewerType("own") }}
                className="accent-indigo-600"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">Auto-assign by language</p>
                <p className="text-xs text-gray-400">Platform picks the best available reviewer for the target language</p>
              </div>
            </label>

            {/* Your reviewers */}
            {reviewers.filter((r) => !r.isPlatformReviewer).length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 mb-1">Your reviewers</p>
                {reviewers.filter((r) => !r.isPlatformReviewer).map((r) => {
                  let langs = "no languages"
                  try { const l: string[] = JSON.parse(r.languages); if (l.length) langs = l.join(", ") } catch {}
                  return (
                    <label key={r.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer mb-1 transition-colors ${assignedReviewerId === r.id && reviewerType === "own" ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:bg-gray-50"}`}>
                      <input
                        type="radio"
                        name="reviewer"
                        value={r.id}
                        checked={assignedReviewerId === r.id && reviewerType === "own"}
                        onChange={() => { setAssignedReviewerId(r.id); setReviewerType("own") }}
                        className="accent-indigo-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{r.name}</p>
                        <p className="text-xs text-gray-400 truncate">{langs}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}

            {/* Platform reviewers */}
            {reviewers.filter((r) => r.isPlatformReviewer).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 mb-1">Platform reviewers</p>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 mb-2 text-xs text-amber-700">
                  Platform reviewers are certified linguists managed by Jendee AI. A reviewer fee of <strong>$0.055/word</strong> is added to your invoice.
                </div>
                {reviewers.filter((r) => r.isPlatformReviewer).map((r) => {
                  let langs = "no languages"
                  try { const l: string[] = JSON.parse(r.languages); if (l.length) langs = l.join(", ") } catch {}
                  return (
                    <label key={r.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer mb-1 transition-colors ${assignedReviewerId === r.id && reviewerType === "platform" ? "border-amber-400 bg-amber-50" : "border-gray-200 hover:bg-gray-50"}`}>
                      <input
                        type="radio"
                        name="reviewer"
                        value={r.id}
                        checked={assignedReviewerId === r.id && reviewerType === "platform"}
                        onChange={() => { setAssignedReviewerId(r.id); setReviewerType("platform") }}
                        className="accent-amber-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{r.name}</p>
                        <p className="text-xs text-gray-400 truncate">{langs}</p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">$0.055/word</span>
                    </label>
                  )
                })}
              </div>
            )}

            {/* Platform reviewer fee note when selected */}
            {reviewerType === "platform" && assignedReviewerId && fileStats?.isBilingual && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Platform reviewer fee estimate:{" "}
                <strong>${(fileStats.wordCount * 0.055).toFixed(2)}</strong>{" "}
                ({fileStats.wordCount.toLocaleString()} words × $0.055/word)
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
            >
              {loading ? "Uploading…" : "Create project"}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
