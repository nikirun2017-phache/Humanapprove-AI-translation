"use client"

import Link from "next/link"
import { useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { STUDIO_LANGUAGES, STUDIO_LANGUAGE_REGIONS } from "@/lib/languages"

const CAT_TOOL_OPTIONS = ["Trados", "memoQ", "Phrase", "Memsource", "Wordfast", "OmegaT", "Other"]
const ALLOWED_CV_EXTS = [".pdf", ".doc", ".docx", ".txt"]

export default function ReviewerSignupPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set())
  const [langSearch, setLangSearch] = useState("")
  const [yearsExperience, setYearsExperience] = useState("")
  const [catTools, setCatTools] = useState<Set<string>>(new Set())
  const [mtExperience, setMtExperience] = useState<boolean | null>(null)
  const [bio, setBio] = useState("")
  const [profileUrl, setProfileUrl] = useState("")
  const [ratePerWord, setRatePerWord] = useState("")
  const [ratePerHour, setRatePerHour] = useState("")
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const cvInputRef = useRef<HTMLInputElement>(null)

  const regions = STUDIO_LANGUAGE_REGIONS
  const filteredLangs = STUDIO_LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.code.toLowerCase().includes(langSearch.toLowerCase())
  )

  // Pre-fill email from session
  const sessionEmail = session?.user?.email ?? ""

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

  function handleCvChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (file) {
      const ext = "." + file.name.split(".").pop()?.toLowerCase()
      if (!ALLOWED_CV_EXTS.includes(ext)) {
        setError("CV must be a PDF, Word (.doc/.docx), or TXT file.")
        setCvFile(null)
        e.target.value = ""
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("CV file must be under 5 MB.")
        setCvFile(null)
        e.target.value = ""
        return
      }
      setError("")
      setCvFile(file)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (selectedLangs.size === 0) { setError("Please select at least one language pair."); return }
    if (mtExperience === null) { setError("Please answer the MT post-editing question."); return }
    if (!cvFile) { setError("Please attach your CV."); return }
    if (!ratePerWord || isNaN(parseFloat(ratePerWord))) { setError("Please enter your rate per word (USD)."); return }
    if (!ratePerHour || isNaN(parseFloat(ratePerHour))) { setError("Please enter your rate per hour (USD)."); return }

    const fd = new FormData()
    fd.append("fullName", fullName.trim())
    fd.append("email", (email.trim() || sessionEmail).toLowerCase())
    fd.append("languagePairs", JSON.stringify(Array.from(selectedLangs)))
    fd.append("yearsExperience", yearsExperience)
    fd.append("catTools", JSON.stringify(Array.from(catTools)))
    fd.append("mtExperience", String(mtExperience))
    fd.append("bio", bio.trim())
    if (profileUrl.trim()) fd.append("profileUrl", profileUrl.trim())
    fd.append("ratePerWord", ratePerWord)
    fd.append("ratePerHour", ratePerHour)
    fd.append("cv", cvFile)

    setSubmitting(true)
    try {
      const res = await fetch("/api/reviewer-applications", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Something went wrong. Please try again."); return }
      setSuccess(true)
    } catch {
      setError("Network error — please check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // Auth gate — redirect to login if not authenticated
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading…</div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto w-full">
          <Link href="/" className="font-bold text-indigo-600 text-xl tracking-tight">Summon Translator</Link>
          <Link href="/careers" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">← Careers</Link>
        </header>
        <main className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="text-center max-w-sm">
            <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-5 text-2xl">🔐</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">Sign in to apply</h1>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              You need a Summon Translator account to submit a reviewer application. It only takes a moment to create one.
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href="/login?callbackUrl=/reviewer-signup"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-6 py-3 rounded-lg transition-colors"
              >
                Sign in →
              </Link>
              <Link
                href="/login?mode=signup&callbackUrl=/reviewer-signup"
                className="border border-gray-300 hover:border-gray-400 text-gray-700 text-sm px-6 py-3 rounded-lg transition-colors"
              >
                Create a free account
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
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
              Thank you for applying! We have sent a confirmation to <strong>{email || sessionEmail}</strong>.
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
                type="email" required value={email || sessionEmail} onChange={(e) => setEmail(e.target.value)}
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
                  <div className="px-3 py-4 text-sm text-gray-400 text-center">No languages match &quot;{langSearch}&quot;</div>
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

          {/* Rates — USD */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <label className="block text-sm font-semibold text-gray-700">Rates <span className="text-red-500">*</span></label>
              <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">USD</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Rate per word <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium select-none">$</span>
                  <input
                    type="number" required min={0} max={100} step={0.001}
                    value={ratePerWord} onChange={(e) => setRatePerWord(e.target.value)}
                    placeholder="0.080"
                    className="w-full border border-gray-300 rounded-lg pl-7 pr-14 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs select-none">/ word</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">e.g. $0.080 per source word</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Rate per hour <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium select-none">$</span>
                  <input
                    type="number" required min={0} max={10000} step={0.01}
                    value={ratePerHour} onChange={(e) => setRatePerHour(e.target.value)}
                    placeholder="35.00"
                    className="w-full border border-gray-300 rounded-lg pl-7 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs select-none">/ hr</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">e.g. $35.00 per hour</p>
              </div>
            </div>
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

          {/* CV Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              CV / Résumé <span className="text-red-500">*</span>
              <span className="ml-1 font-normal text-gray-400">PDF, Word (.doc/.docx), or TXT · max 5 MB</span>
            </label>
            <div
              className={`border-2 border-dashed rounded-lg px-5 py-5 text-center cursor-pointer transition-colors ${
                cvFile ? "border-indigo-400 bg-indigo-50" : "border-gray-300 hover:border-indigo-400"
              }`}
              onClick={() => cvInputRef.current?.click()}
            >
              <input
                ref={cvInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={handleCvChange}
              />
              {cvFile ? (
                <div className="flex items-center justify-center gap-2 text-sm text-indigo-700">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium truncate max-w-xs">{cvFile.name}</span>
                  <span className="text-indigo-400 text-xs">({(cvFile.size / 1024).toFixed(0)} KB)</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCvFile(null); if (cvInputRef.current) cvInputRef.current.value = "" }}
                    className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <svg className="w-7 h-7 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm text-gray-500">Click to upload your CV</p>
                  <p className="text-xs text-gray-400 mt-1">PDF · Word · TXT</p>
                </>
              )}
            </div>
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
