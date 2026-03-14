"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/navbar"

interface Reviewer {
  id: string
  name: string
  email: string
  languages: string
}

export default function NewProjectPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [reviewers, setReviewers] = useState<Reviewer[]>([])
  const [assignedReviewerId, setAssignedReviewerId] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [detectedLang, setDetectedLang] = useState<{ src: string; tgt: string } | null>(null)

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
    if (assignedReviewerId) formData.append("assignedReviewerId", assignedReviewerId)

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assign reviewer{" "}
              <span className="text-gray-400 font-normal">(optional — auto-matched by language)</span>
            </label>
            <select
              value={assignedReviewerId}
              onChange={(e) => setAssignedReviewerId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">Auto-assign by language</option>
              {reviewers.map((r) => {
                let langs = "no languages set"
                try {
                  const l: string[] = JSON.parse(r.languages)
                  if (l.length) langs = l.join(", ")
                } catch {}
                return (
                  <option key={r.id} value={r.id}>
                    {r.name} ({langs})
                  </option>
                )
              })}
            </select>
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
