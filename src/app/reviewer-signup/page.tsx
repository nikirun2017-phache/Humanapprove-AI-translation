"use client"

import Link from "next/link"
import { useState } from "react"
import { STUDIO_LANGUAGES, STUDIO_LANGUAGE_REGIONS } from "@/lib/languages"

const CAT_TOOL_OPTIONS = ["Trados", "memoQ", "Phrase", "Memsource", "Wordfast", "OmegaT", "Other"]

export default function ReviewerSignupPage() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set())
  const [langSearch, setLangSearch] = useState("")
  const [yearsExperience, setYearsExperience] = useState("")
  const [catTools, setCatTools] = useState<Set<string>>(new Set())
  const [mtExperience, setMtExperience] = useState<boolean | null>(null)
  const [bio, setBio] = useState("")
  const [profileUrl, setProfileUrl] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const regions = STUDIO_LANGUAGE_REGIONS
  const filteredLangs = STUDIO_LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.code.toLowerCase().includes(langSearch.toLowerCase())
  )

  function toggleLang(code: string) {
    setSelectedLangs((prev) => {
      const next = new Set(prev)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })
  }

  function toggleTool(tool: string) {
    setCatTools((prev) => {
      const next = new Set(prev)
      next.has(tool) ? next.delete(tool) : next.add(tool)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (selectedLangs.size === 0) { setError("Please select at least one language pair."); return }
    if (mtExperience === null) { setError("Please answer the MT post-editing question."); return }

    setSubmitting(true)
    try {
      const res = await fetch("/api/reviewer-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          languagePairs: Array.from(selectedLangs),
          yearsExperience: parseInt(yearsExperience, 10),
          catTools: Array.from(catTools),
          mtExperience,
          bio: bio.trim(),
          profileUrl: profileUrl.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Something went wrong. Please try again."); return }
      setSuccess(true)
    } catch {
      setError("Network error — please check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto w-full">
          <Link href="/" className="font-bold text-indigo-600 text-xl tracking-tight">Summon Translator</Link>
        </header>
        <main className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="text-center max-w-md">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5 text-2xl">✓</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Application submitted</h1>
            <p className="text-gray-500 leading-relaxed mb-6">
              Thank you for applying! We have sent a confirmation to <strong>{email}</strong>.
              We typically respond within 5 business days.
            </p>
            <Link href="/" className="text-sm text-indigo-600 hover:underline">← Back to home</Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-bold text-indigo-600 text-xl tracking-tight">Summon Translator</Link>
        <Link href="/careers" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">← Careers</Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Now recruiting
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">Apply as a reviewer</h1>
          <p className="text-gray-500">MT Post-Editor &amp; LQA Reviewer · Freelance · Remote</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-7">
          {/* Name + Email */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name <span className="text-red-500">*</span></label>
              <input
                type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address <span className="text-red-500">*</span></label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Language pairs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Language pairs <span className="text-red-500">*</span>
              {selectedLangs.size > 0 && (
                <span className="ml-2 text-xs font-normal text-indigo-600">{selectedLangs.size} selected</span>
              )}
            </label>
            <input
              type="text" placeholder="Search languages…" value={langSearch}
              onChange={(e) => setLangSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
                {(langSearch ? [{ region: "Results", langs: filteredLangs }] : regions.map((r) => ({
                  region: r,
                  langs: STUDIO_LANGUAGES.filter((l) => l.region === r),
                }))).map(({ region, langs }) => (
                  <div key={region}>
                    <div className="px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wide">{region}</div>
                    {langs.map((l) => {
                      const checked = selectedLangs.has(l.code)
                      return (
                        <label
                          key={l.code}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${checked ? "bg-indigo-50" : ""}`}
                        >
                          <input
                            type="checkbox" checked={checked} onChange={() => toggleLang(l.code)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-800">{l.name}</span>
                          <span className="ml-auto text-xs text-gray-400 font-mono">{l.code}</span>
                        </label>
                      )
                    })}
                  </div>
                ))}
                {langSearch && filteredLangs.length === 0 && (
                  <div className="px-3 py-4 text-sm text-gray-400 text-center">No languages match "{langSearch}"</div>
                )}
              </div>
            </div>
            {selectedLangs.size > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Array.from(selectedLangs).map((code) => (
                  <span
                    key={code}
                    onClick={() => toggleLang(code)}
                    className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full cursor-pointer hover:bg-indigo-200"
                  >
                    {code} <span className="text-indigo-400">×</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Years of experience */}
          <div className="sm:w-1/2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Years of professional translation experience <span className="text-red-500">*</span></label>
            <input
              type="number" required min={0} max={60} value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              placeholder="e.g. 5"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* CAT tools */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">CAT tools you use <span className="text-gray-400 font-normal">(select all that apply)</span></label>
            <div className="flex flex-wrap gap-2">
              {CAT_TOOL_OPTIONS.map((tool) => {
                const checked = catTools.has(tool)
                return (
                  <button
                    key={tool} type="button" onClick={() => toggleTool(tool)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      checked
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white border-gray-300 text-gray-700 hover:border-indigo-400"
                    }`}
                  >
                    {tool}
                  </button>
                )
              })}
            </div>
          </div>

          {/* MT post-editing experience */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Do you have MT post-editing experience? <span className="text-red-500">*</span></label>
            <div className="flex gap-3">
              {[{ label: "Yes", value: true }, { label: "No", value: false }].map(({ label, value }) => (
                <button
                  key={label} type="button" onClick={() => setMtExperience(value)}
                  className={`px-5 py-2 text-sm rounded-lg border transition-colors ${
                    mtExperience === value
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "bg-white border-gray-300 text-gray-700 hover:border-indigo-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Brief introduction <span className="text-red-500">*</span>
              <span className="ml-1 font-normal text-gray-400">(min 20 chars)</span>
            </label>
            <textarea
              required value={bio} onChange={(e) => setBio(e.target.value)}
              rows={4} maxLength={2000}
              placeholder="Tell us about your translation background, specialisations, and interest in AI post-editing…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{bio.length}/2000</p>
          </div>

          {/* Profile URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Profile link <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="url" value={profileUrl} onChange={(e) => setProfileUrl(e.target.value)}
              placeholder="https://www.proz.com/profile/… or LinkedIn URL"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-400 mt-1">TranslatorsCafe, ProZ, or LinkedIn</p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          {/* Submit */}
          <button
            type="submit" disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm py-3 rounded-lg transition-colors"
          >
            {submitting ? "Submitting…" : "Submit application →"}
          </button>

          <p className="text-xs text-gray-400 text-center">
            We review applications on a rolling basis and typically respond within 5 business days.
          </p>
        </form>
      </main>
    </div>
  )
}
