"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { STUDIO_LANGUAGES, STUDIO_LANGUAGE_REGIONS, LANGUAGE_PRESETS } from "@/lib/languages"
import type { ProviderInfo } from "@/lib/ai-providers/types"

interface Props {
  providers: ProviderInfo[]
  hasCard: boolean
  restoringFromCardSetup?: boolean
}

type Step = 1 | 2 | 3

interface SourceUnit {
  id: string
  sourceText: string
}

interface PdfProbe {
  numPages: number
  isScanned: boolean
  wordCount: number
  estimatedUnits: number
  cacheKey: string | null
}

interface XliffMeta {
  sourceLanguage: string
  targetLanguage: string   // suggested (from file header)
  emptyUnitCount: number   // units with empty <target>
  sourceCharCount: number  // total chars in <source> elements (for cost estimation)
}

interface FileEntry {
  key: string          // stable React key
  file: File
  preview: SourceUnit[]
  parseError: string
  pdfProbe?: PdfProbe  // set after server-side probe for PDF files
  probePending?: boolean
  xliffMeta?: XliffMeta
  sizeWarning?: string  // shown for large .txt files
}

function fileKey(f: File) {
  return `${f.name}-${f.size}-${f.lastModified}`
}

function fileTypeLabel(name: string) {
  if (name.endsWith(".pdf")) return "PDF"
  if (name.endsWith(".json")) return "JSON"
  if (name.endsWith(".csv")) return "CSV"
  if (name.endsWith(".md")) return "MD"
  if (name.endsWith(".txt")) return "TXT"
  if (name.endsWith(".xliff") || name.endsWith(".xlf")) return "XLIFF"
  if (name.endsWith(".strings")) return ".strings"
  if (name.endsWith(".stringsdict")) return ".stringsdict"
  if (name.endsWith(".xcstrings")) return ".xcstrings"
  if (name.endsWith(".po")) return ".po"
  if (name.endsWith(".xml")) return "Android XML"
  if (name.endsWith(".arb")) return ".arb"
  if (name.endsWith(".properties")) return ".properties"
  if (name.endsWith(".html") || name.endsWith(".htm")) return "HTML"
  return "file"
}

/** Returns true for file types that are localisation resource formats (key=value pairs) */
function isResourceFormat(name: string): boolean {
  return /\.(strings|stringsdict|xcstrings|po|xml|arb|properties)$/i.test(name)
}

/** Quick client-side preview parser for resource formats — extracts first 10 translatable strings */
function parseResourcePreview(content: string, filename: string): SourceUnit[] {
  const units: SourceUnit[] = []
  try {
    if (filename.endsWith(".strings")) {
      const re = /"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*;/g
      let m: RegExpExecArray | null
      while ((m = re.exec(content)) !== null && units.length < 10) {
        const text = m[2].replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"')
        if (text.trim()) units.push({ id: m[1], sourceText: text })
      }
    } else if (filename.endsWith(".stringsdict") || filename.endsWith(".xml")) {
      // Show value content between tags as preview
      const re = /<string[^>]*>([^<]{3,})<\/string>|<item[^>]*>([^<]{3,})<\/item>/g
      let m: RegExpExecArray | null
      while ((m = re.exec(content)) !== null && units.length < 10) {
        const text = (m[1] ?? m[2]).trim()
        if (text) units.push({ id: `preview_${units.length}`, sourceText: text })
      }
    } else if (filename.endsWith(".xcstrings") || filename.endsWith(".arb")) {
      const parsed = JSON.parse(content) as Record<string, unknown>
      for (const [key, val] of Object.entries(parsed)) {
        if (key.startsWith("@")) continue
        if (typeof val === "string" && val.trim()) {
          units.push({ id: key, sourceText: val })
          if (units.length >= 10) break
        }
      }
    } else if (filename.endsWith(".po")) {
      const re = /msgid\s+"((?:[^"\\]|\\.)*)"/g
      let m: RegExpExecArray | null
      while ((m = re.exec(content)) !== null && units.length < 10) {
        const text = m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
        if (text.trim()) units.push({ id: `po_${units.length}`, sourceText: text })
      }
    } else if (filename.endsWith(".properties")) {
      for (const line of content.split(/\r?\n/)) {
        if (!line.trim() || /^\s*[#!]/.test(line)) continue
        const match = line.match(/^\s*([\w.\-/\\]+)\s*[=:]\s*(.+)$/)
        if (match && match[2].trim()) {
          units.push({ id: match[1], sourceText: match[2].replace(/\\n/g, "\n") })
          if (units.length >= 10) break
        }
      }
    }
  } catch { /* ignore parse errors in preview */ }
  return units
}

/** Client-side HTML preview — returns ALL translatable text nodes so the count is accurate.
 *  The preview table slices to 10 rows itself. */
function parseHtmlPreview(html: string): SourceUnit[] {
  const units: SourceUnit[] = []
  const SPLIT_RE = /(<!--[\s\S]*?-->|<!\w[^>]*>|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>|<[^>]*>)/gi
  const parts = html.split(SPLIT_RE)
  let idx = 0
  for (let i = 0; i < parts.length; i += 2) {
    const text = parts[i].trim()
    if (text && /\p{L}/u.test(text)) {
      units.push({ id: `t_${idx++}`, sourceText: text })
    }
  }
  return units
}

/** Client-side XLIFF metadata extraction — regex-based, no full parse needed */
function parseXliffMeta(content: string): XliffMeta {
  const sourceLang = content.match(/source-language="([^"]+)"/)?.[1] ?? "en-US"
  const targetLang = content.match(/target-language="([^"]+)"/)?.[1] ?? ""

  // Count trans-units (XLIFF 1.x) or units (XLIFF 2.0) where target is empty/missing
  let emptyUnitCount = 0
  const unitRegex = /<trans-unit[\s\S]*?<\/trans-unit>/g
  const unitMatches = content.match(unitRegex) ?? []
  for (const unit of unitMatches) {
    const targetMatch = unit.match(/<target[^>]*>([\s\S]*?)<\/target>/)
    const targetText = targetMatch?.[1]?.replace(/<[^>]+>/g, "").trim() ?? ""
    if (!targetText) emptyUnitCount++
  }
  // XLIFF 2.0 <unit> elements
  if (emptyUnitCount === 0) {
    const unit2Regex = /<unit[\s\S]*?<\/unit>/g
    const unit2Matches = content.match(unit2Regex) ?? []
    for (const unit of unit2Matches) {
      const seg = unit.match(/<segment[\s\S]*?<\/segment>/)?.[0] ?? unit
      const targetText = seg.match(/<target[^>]*>([\s\S]*?)<\/target>/)?.[1]?.replace(/<[^>]+>/g, "").trim() ?? ""
      if (!targetText) emptyUnitCount++
    }
  }

  // Sum up char length of all <source> text (strip inline XML tags)
  const sourceCharCount = (content.match(/<source[^>]*>([\s\S]*?)<\/source>/g) ?? [])
    .reduce((sum: number, s: string) => {
      const inner = s.replace(/^<source[^>]*>/, "").replace(/<\/source>$/, "")
      return sum + inner.replace(/<[^>]+>/g, " ").trim().length
    }, 0)

  return { sourceLanguage: sourceLang, targetLanguage: targetLang, emptyUnitCount, sourceCharCount }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface GithubPrFile {
  path: string
  ext: string
  content: string
  unitCount: number
  wordCount: number
  sourceLanguage?: string
}

interface GithubPrAnalysis {
  owner: string
  repo: string
  prNumber: number
  branch: string
  files: GithubPrFile[]
  skippedFiles: { path: string; reason: string }[]
  totalUnits: number
  totalWordCount: number
}

const WIZARD_STORAGE_KEY = "translationWizardState"

export function TranslationWizard({ providers, hasCard, restoringFromCardSetup }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [addingCard, setAddingCard] = useState(false)

  // Step 1 state — multiple files
  const [entries, setEntries] = useState<FileEntry[]>([])

  // Step 1 GitHub PR tab state
  const [sourceMode, setSourceMode] = useState<"file" | "github-pr">("file")
  const [prUrl, setPrUrl] = useState("")
  const [githubToken, setGithubToken] = useState("")
  const [prAnalyzing, setPrAnalyzing] = useState(false)
  const [prAnalysis, setPrAnalysis] = useState<GithubPrAnalysis | null>(null)
  const [prError, setPrError] = useState("")
  const [selectedPrFiles, setSelectedPrFiles] = useState<Set<string>>(new Set())
  // Stored for write-back: keyed by synthetic file key → original GH path
  const [githubFileMeta, setGithubFileMeta] = useState<Map<string, { prUrl: string; branch: string; sourcePath: string }>>(new Map())

  // Step 2 state
  const [jobName, setJobName] = useState("")
  const [sourceLanguage, setSourceLanguage] = useState("en-US")
  // MVP: locked to Claude Sonnet 4.6
  const provider = "anthropic"
  const model = "claude-sonnet-4-6"
  const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set())
  const [langSearch, setLangSearch] = useState("")
  const [regionFilter, setRegionFilter] = useState("")

  // Terminology / glossary state
  type GlossaryTerm = { source: string; target: string }
  const [glossary, setGlossary] = useState<Record<string, GlossaryTerm[]>>({})
  const [glossaryOpen, setGlossaryOpen] = useState(false)
  const [glossaryTab, setGlossaryTab] = useState<string>("")

  const MAX_TERMS = 5

  function addTerm(lang: string) {
    setGlossary(prev => ({ ...prev, [lang]: [...(prev[lang] ?? []), { source: "", target: "" }] }))
  }
  function removeTerm(lang: string, i: number) {
    setGlossary(prev => {
      const terms = (prev[lang] ?? []).filter((_: GlossaryTerm, idx: number) => idx !== i)
      if (terms.length === 0) { const next = { ...prev }; delete next[lang]; return next }
      return { ...prev, [lang]: terms }
    })
  }
  function updateTerm(lang: string, i: number, field: "source" | "target", value: string) {
    setGlossary(prev => {
      const terms = [...(prev[lang] ?? [])]
      terms[i] = { ...terms[i], [field]: value }
      return { ...prev, [lang]: terms }
    })
  }
  const totalGlossaryTerms = Object.values(glossary).reduce((s, t) => s + t.filter((x: GlossaryTerm) => x.source.trim() && x.target.trim()).length, 0)

  // Step 3 state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [cardError, setCardError] = useState("")
  const [promoInput, setPromoInput] = useState("")
  const [promoState, setPromoState] = useState<{ valid: boolean; discountPct: number; code: string; maxWordsPerJob?: number | null; error?: string } | null>(null)
  const [promoLoading, setPromoLoading] = useState(false)

  // Restore wizard config after returning from Stripe card setup
  useEffect(() => {
    if (!restoringFromCardSetup) return
    try {
      const raw = sessionStorage.getItem(WIZARD_STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as { jobName: string; provider: string; model: string; selectedLangs: string[]; sourceLanguage?: string }
      sessionStorage.removeItem(WIZARD_STORAGE_KEY)
      setJobName(saved.jobName)
      setSelectedLangs(new Set(saved.selectedLangs))
      if (saved.sourceLanguage) setSourceLanguage(saved.sourceLanguage)
    } catch { /* ignore */ }
  }, [restoringFromCardSetup])

  // Auto-advance to Configure once files are re-uploaded after card setup
  useEffect(() => {
    if (!restoringFromCardSetup) return
    if (step !== 1) return
    if (entries.length === 0) return
    if (entries.some((e: FileEntry) => e.probePending || e.parseError)) return
    setStep(2)
  }, [entries, restoringFromCardSetup, step])

  async function addCard() {
    setAddingCard(true)
    setCardError("")
    // Save wizard config so it can be restored after Stripe redirect
    try {
      sessionStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify({
        jobName,
        provider,
        model,
        selectedLangs: [...selectedLangs],
        sourceLanguage,
      }))
    } catch { /* ignore */ }
    try {
      const res = await fetch("/api/billing/setup-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnPath: "/translation-studio" }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed to start card setup")
      window.location.href = data.url
    } catch (err) {
      setCardError(err instanceof Error ? err.message : "Failed to open payment setup. Please try again.")
      setAddingCard(false)
    }
  }

  const currentProvider = providers.find((p: (typeof providers)[number]) => p.name === provider)!

  // Languages pinned to the top of the browser
  const PINNED_CODES = ["en-US", "zh-CN", "zh-TW", "ja-JP", "ko-KR", "pt-BR", "es-MX", "de-DE", "fr-FR"]

  const filteredLangs = STUDIO_LANGUAGES.filter((l: (typeof STUDIO_LANGUAGES)[number]) => {
    const matchSearch = l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.code.toLowerCase().includes(langSearch.toLowerCase())
    const matchRegion = !regionFilter || l.region === regionFilter
    return matchSearch && matchRegion
  })

  const pinnedLangs = filteredLangs.filter((l: (typeof filteredLangs)[number]) => PINNED_CODES.includes(l.code))
  const unpinnedLangs = filteredLangs.filter((l: (typeof filteredLangs)[number]) => !PINNED_CODES.includes(l.code))

  const activePresetId = LANGUAGE_PRESETS.find((p: (typeof LANGUAGE_PRESETS)[number]) => {
    const validCodes = p.codes.filter((c: string) => STUDIO_LANGUAGES.some((l: (typeof STUDIO_LANGUAGES)[number]) => l.code === c))
    return validCodes.length === selectedLangs.size && validCodes.every((c: string) => selectedLangs.has(c))
  })?.id ?? null

  function parseNonPdfFile(f: File): Promise<FileEntry> {
    const key = fileKey(f)
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        try {
          if (f.name.endsWith(".xliff") || f.name.endsWith(".xlf")) {
            const meta = parseXliffMeta(content)
            if (meta.emptyUnitCount === 0) {
              resolve({ key, file: f, preview: [], parseError: "Nothing to translate — all segments are already filled.", xliffMeta: meta })
            } else {
              // Build a simple preview from <source> elements
              const sourceTexts: SourceUnit[] = []
              const unitRegex = /<trans-unit[^>]+id="([^"]+)"[\s\S]*?<source[^>]*>([\s\S]*?)<\/source>/g
              let m
              while ((m = unitRegex.exec(content)) !== null && sourceTexts.length < 10) {
                const text = m[2].replace(/<[^>]+>/g, "").trim()
                if (text) sourceTexts.push({ id: m[1], sourceText: text })
              }
              resolve({ key, file: f, preview: sourceTexts, parseError: "", xliffMeta: meta })
            }
          } else if (isResourceFormat(f.name)) {
            const units = parseResourcePreview(content, f.name)
            resolve({ key, file: f, preview: units, parseError: "" })
          } else {
            let units: SourceUnit[]
            if (f.name.endsWith(".json")) {
              units = flattenForPreview(JSON.parse(content) as unknown)
            } else if (f.name.endsWith(".md") || f.name.endsWith(".txt")) {
              units = parseMarkdownPreview(content)
            } else if (f.name.endsWith(".html") || f.name.endsWith(".htm")) {
              units = parseHtmlPreview(content)
            } else {
              units = parseCsvPreview(content)
            }
            resolve({ key, file: f, preview: units, parseError: "" })
          }
        } catch {
          resolve({ key, file: f, preview: [], parseError: "Couldn't read this file. Check that it's a valid format." })
        }
      }
      reader.readAsText(f)
    })
  }

  async function probePdf(key: string, f: File) {
    const fd = new FormData()
    fd.append("file", f)
    try {
      const res = await fetch("/api/translation-studio/probe-pdf", { method: "POST", body: fd })
      const probe = await res.json() as PdfProbe
      setEntries((prev) => prev.map((e: FileEntry) => e.key === key ? { ...e, pdfProbe: probe, probePending: false } : e))
    } catch {
      setEntries((prev) => prev.map((e: FileEntry) => e.key === key ? { ...e, probePending: false } : e))
    }
  }

  const FILE_SIZE_LIMITS: Record<string, number> = {
    pdf:         50 * 1024 * 1024,  // 50 MB — scanned/image PDFs are large
    json:         5 * 1024 * 1024,
    csv:          5 * 1024 * 1024,
    md:           5 * 1024 * 1024,
    txt:          5 * 1024 * 1024,
    xliff:        5 * 1024 * 1024,
    xlf:          5 * 1024 * 1024,
    strings:      5 * 1024 * 1024,
    stringsdict:  5 * 1024 * 1024,
    xcstrings:    5 * 1024 * 1024,
    po:           5 * 1024 * 1024,
    xml:          5 * 1024 * 1024,
    arb:          5 * 1024 * 1024,
    properties:   5 * 1024 * 1024,
  }

  function fileSizeError(f: File): string | null {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? ""
    const limit = FILE_SIZE_LIMITS[ext]
    if (!limit || f.size <= limit) return null
    const limitMb = limit / 1024 / 1024
    const sizeMb = (f.size / 1024 / 1024).toFixed(1)
    return `File is ${sizeMb} MB — exceeds the ${limitMb} MB limit for .${ext} files. Please split or compress it.`
  }

  async function addFiles(newFiles: File[]) {
    const existingKeys = new Set(entries.map((e: FileEntry) => e.key))
    const fresh = newFiles.filter((f: File) => !existingKeys.has(fileKey(f)))
    if (fresh.length === 0) return

    // Parse non-PDF files client-side; PDFs get a probe stub immediately
    const parsed = await Promise.all(
      fresh.map((f: File) => {
        const sizeErr = fileSizeError(f)
        if (sizeErr) {
          return Promise.resolve<FileEntry>({ key: fileKey(f), file: f, preview: [], parseError: sizeErr })
        }
        if (f.name.endsWith(".pdf")) {
          return Promise.resolve<FileEntry>({ key: fileKey(f), file: f, preview: [], parseError: "", probePending: true })
        }
        return parseNonPdfFile(f)
      })
    )

    setEntries((prev) => {
      const next = [...prev, ...parsed]
      if (!jobName && next.length > 0) {
        setJobName(next[0].file.name.replace(/\.(json|csv|md|txt|pdf|xliff|xlf|strings|stringsdict|xcstrings|po|xml|arb|properties)$/i, ""))
      }
      return next
    })

    // Auto-select detected target language from XLIFF files
    for (const entry of parsed) {
      if (entry.xliffMeta?.targetLanguage) {
        const lang = entry.xliffMeta.targetLanguage
        if (STUDIO_LANGUAGES.some((l: (typeof STUDIO_LANGUAGES)[number]) => l.code === lang)) {
          setSelectedLangs((s) => new Set([...s, lang]))
        }
      }
    }

    // Fire PDF probes in background
    for (const entry of parsed) {
      if (entry.file.name.endsWith(".pdf")) {
        probePdf(entry.key, entry.file)
      }
    }
  }

  function removeEntry(key: string) {
    setEntries((prev) => prev.filter((e: FileEntry) => e.key !== key))
  }

  const handleInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    await addFiles(files)
    // Reset input so the same file can be re-added after removal
    e.target.value = ""
  }, [entries, jobName]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter((f: File) =>
      /\.(json|csv|md|pdf|xliff)$/i.test(f.name)
    )
    await addFiles(files)
  }, [entries, jobName]) // eslint-disable-line react-hooks/exhaustive-deps

  async function analyzePr() {
    setPrError("")
    setPrAnalysis(null)
    setPrAnalyzing(true)
    try {
      const res = await fetch("/api/translation-studio/probe-github-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: prUrl.trim(), token: githubToken.trim() || undefined }),
      })
      const data = await res.json() as GithubPrAnalysis & { error?: string; message?: string }
      if (!res.ok) {
        setPrError(data.error ?? "Failed to analyze PR")
        return
      }
      setPrAnalysis(data)
      setSelectedPrFiles(new Set(data.files.map((f: GithubPrFile) => f.path)))
      if (data.message) setPrError(data.message)
    } catch {
      setPrError("Network error — could not reach GitHub API.")
    } finally {
      setPrAnalyzing(false)
    }
  }

  async function usePrFiles() {
    if (!prAnalysis) return
    const newFiles: File[] = []
    const newMeta = new Map(githubFileMeta)

    for (const f of prAnalysis.files.filter((f: GithubPrFile) => selectedPrFiles.has(f.path))) {
      const blob = new Blob([f.content], { type: "text/plain" })
      const filename = f.path.split("/").pop() ?? f.path
      const file = new File([blob], filename, { type: "text/plain" })
      const key = fileKey(file)
      newFiles.push(file)
      newMeta.set(key, { prUrl: prUrl.trim(), branch: prAnalysis.branch, sourcePath: f.path })
    }

    setGithubFileMeta(newMeta)
    await addFiles(newFiles)
    setSourceMode("file") // switch back to file tab to show the queued files
  }

  function toggleLang(code: string) {
    setSelectedLangs((s) => {
      const next = new Set(s)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })
  }

  function selectAll() { setSelectedLangs(new Set(filteredLangs.map((l: (typeof filteredLangs)[number]) => l.code))) }
  function clearAll() { setSelectedLangs(new Set()) }

  async function submit() {
    // Guard: re-validate before submission in case state drifted
    const validEntries = entries.filter((e: FileEntry) => !e.parseError)
    if (validEntries.length === 0) {
      setSubmitError("No valid files to submit. Please go back and check your files.")
      return
    }

    setSubmitting(true)
    setSubmitError("")

    const langs = JSON.stringify(Array.from(selectedLangs))
    let lastJobId: string | null = null
    const errors: string[] = []

    try {
      for (const entry of validEntries) {
        const fd = new FormData()
        fd.append("file", entry.file)
        fd.append("name", validEntries.length === 1 ? jobName : `${jobName} — ${entry.file.name.replace(/\.(json|csv|md|pdf|xliff)$/i, "")}`)
        fd.append("provider", provider)
        fd.append("model", model)
        fd.append("targetLanguages", langs)
        fd.append("sourceLanguage", entry.xliffMeta?.sourceLanguage ?? sourceLanguage)
        if (promoState?.valid) fd.append("promoCode", promoState.code)
        if (Object.keys(glossary).length > 0) fd.append("glossaryData", JSON.stringify(glossary))
        // Pass probe cache key so job creation can skip re-parsing the PDF
        if (entry.pdfProbe?.cacheKey) fd.append("pdfCacheKey", entry.pdfProbe.cacheKey)

        const res = await fetch("/api/translation-studio/jobs", { method: "POST", body: fd })
        const data = await res.json() as { jobId?: string; error?: string }
        if (!res.ok) {
          errors.push(`${entry.file.name}: ${data.error ?? "Failed to create job"}`)
        } else {
          lastJobId = data.jobId ?? null
        }
      }
    } catch (err) {
      setSubmitError(`Unexpected error: ${(err as Error).message ?? "Please try again."}`)
      setSubmitting(false)
      return
    }

    setSubmitting(false)

    if (errors.length > 0) {
      setSubmitError(errors.join("\n"))
      return
    }

    // Single file → go to job detail; multiple → go to studio list
    if (validEntries.length === 1 && lastJobId) {
      router.push(`/translation-studio/${lastJobId}`)
    } else {
      router.push("/translation-studio")
    }
  }

  // ── parse helpers ──────────────────────────────────────────────────────────

  function flattenForPreview(obj: unknown, prefix = ""): SourceUnit[] {
    if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
      return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => {
        const key = prefix ? `${prefix}.${k}` : k
        if (typeof v === "string") return [{ id: key, sourceText: v }]
        return flattenForPreview(v, key)
      })
    }
    if (Array.isArray(obj)) {
      return (obj as Record<string, unknown>[]).map((item: Record<string, unknown>) => ({
        id: String(item.id ?? item.key ?? ""),
        sourceText: String(item.value ?? item.text ?? item.source ?? ""),
      })).filter((u: { id: string; sourceText: string }) => u.id && u.sourceText)
    }
    return []
  }

  function parseMarkdownPreview(content: string): SourceUnit[] {
    const units: SourceUnit[] = []
    let index = 0
    let inFencedBlock = false
    const lines = content.split(/\r?\n/)
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      if (/^```/.test(line) || /^~~~/.test(line)) { inFencedBlock = !inFencedBlock; i++; continue }
      if (inFencedBlock || /^( {4}|\t)/.test(line)) { i++; continue }
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
      if (headingMatch) { units.push({ id: `h${headingMatch[1].length}_${index++}`, sourceText: headingMatch[2].trim() }); i++; continue }
      const listMatch = line.match(/^(\s*(?:[-*+]|\d+\.)\s+)(.+)$/)
      if (listMatch) { units.push({ id: `li_${index++}`, sourceText: listMatch[2].trim() }); i++; continue }
      if (line.trim() === "") { i++; continue }
      const paraLines: string[] = []
      while (i < lines.length && lines[i].trim() !== "" && !/^```/.test(lines[i]) && !/^~~~/.test(lines[i]) && !/^#{1,6}\s/.test(lines[i]) && !/^\s*(?:[-*+]|\d+\.)\s/.test(lines[i]) && !/^( {4}|\t)/.test(lines[i])) {
        paraLines.push(lines[i]); i++
      }
      if (paraLines.length > 0) units.push({ id: `p_${index++}`, sourceText: paraLines.join(" ").trim() })
    }
    return units
  }

  function parseCsvPreview(content: string): SourceUnit[] {
    return content.split(/\r?\n/).slice(1, 11)
      .map((line: string) => {
        const [id, ...rest] = line.split(",")
        return { id: id?.trim().replace(/"/g, ""), sourceText: rest.join(",").trim().replace(/^"|"$/g, "") }
      })
      .filter((u: { id: string | undefined; sourceText: string }) => u.id && u.sourceText)
  }

  // ── derived ────────────────────────────────────────────────────────────────

  const hasFiles = entries.length > 0
  const hasErrors = entries.some((e: FileEntry) => e.parseError)
  const canProceed = hasFiles && !hasErrors

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Promo banner — always visible across all steps */}
      <div className="mb-5 flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-sm text-indigo-800">
        <span className="shrink-0">🎉</span>
        <span>Use code <strong className="font-semibold tracking-wide">1TIME</strong> at checkout to translate your first 10,000 words free.</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-6 sm:mb-8">
        {([1, 2, 3] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-1.5 sm:gap-2">
            {i > 0 && <div className="w-5 sm:w-8 h-px bg-gray-200" />}
            <div className={`flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-medium ${step === s ? "text-indigo-600" : step > s ? "text-gray-400" : "text-gray-300"}`}>
              <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs ${step === s ? "bg-indigo-600 text-white" : step > s ? "bg-gray-200 text-gray-500" : "bg-gray-100 text-gray-300"}`}>{s}</span>
              {s === 1 ? "Upload" : s === 2 ? "Configure" : "Confirm"}
            </div>
          </div>
        ))}
      </div>

      {/* ── Step 1 — Upload ── */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Card-setup return banner */}
          {restoringFromCardSetup && (
            <div className="flex items-start gap-2 bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm">
              <span className="mt-0.5">✓</span>
              <span>Payment method saved! Re-upload your file to continue — your language settings have been restored.</span>
            </div>
          )}
          {/* Source mode tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setSourceMode("file")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${sourceMode === "file" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Upload files
            </button>
            <button
              onClick={() => setSourceMode("github-pr")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${sourceMode === "github-pr" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              GitHub PR
            </button>
          </div>

          {/* ── GitHub PR panel ── */}
          {sourceMode === "github-pr" && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pull Request URL</label>
                  <input
                    type="url"
                    value={prUrl}
                    onChange={(e) => { setPrUrl(e.target.value); setPrAnalysis(null); setPrError("") }}
                    placeholder="https://github.com/owner/repo/pull/123"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    GitHub token{" "}
                    <span className="text-gray-400 font-normal">(optional — required for private repos)</span>
                  </label>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_••••••••••••••••••••••••••••••••••••••"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Requires <code>repo</code> read scope. Used to read files from your branch.
                  </p>
                </div>
                <button
                  onClick={analyzePr}
                  disabled={!prUrl.trim() || prAnalyzing}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                >
                  {prAnalyzing ? "Analyzing…" : "Analyze PR"}
                </button>
              </div>

              {prError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {prError}
                </div>
              )}

              {prAnalysis && (
                <div className="space-y-4">
                  {/* PR meta */}
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-indigo-900">
                        {prAnalysis.owner}/{prAnalysis.repo} #{prAnalysis.prNumber}
                      </p>
                      <p className="text-xs text-indigo-600 mt-0.5">
                        Branch: <code>{prAnalysis.branch}</code> · {prAnalysis.totalUnits.toLocaleString()} strings · {prAnalysis.totalWordCount.toLocaleString()} words
                      </p>
                    </div>
                  </div>

                  {/* File table */}
                  {prAnalysis.files.length > 0 && (() => {
                    const selFiles = prAnalysis.files.filter((f: GithubPrFile) => selectedPrFiles.has(f.path))
                    const selUnits = selFiles.reduce((s: number, f: GithubPrFile) => s + f.unitCount, 0)
                    const selWords = selFiles.reduce((s: number, f: GithubPrFile) => s + f.wordCount, 0)
                    const allChecked = prAnalysis.files.every((f: GithubPrFile) => selectedPrFiles.has(f.path))
                    return (
                    <div className="border border-gray-200 rounded-lg overflow-x-auto">
                      <table className="w-full text-sm min-w-[400px]">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2">
                              <input type="checkbox" checked={allChecked}
                                onChange={() => setSelectedPrFiles(allChecked ? new Set() : new Set(prAnalysis.files.map((f: GithubPrFile) => f.path)))}
                                className="rounded border-gray-300 text-indigo-600 cursor-pointer" />
                            </th>
                            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">File</th>
                            <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Strings</th>
                            <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Words</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {prAnalysis.files.map((f: GithubPrFile) => {
                            const checked = selectedPrFiles.has(f.path)
                            return (
                            <tr key={f.path} className={checked ? "" : "opacity-40"}>
                              <td className="px-3 py-2">
                                <input type="checkbox" checked={checked}
                                  onChange={() => {
                                    const next = new Set(selectedPrFiles)
                                    checked ? next.delete(f.path) : next.add(f.path)
                                    setSelectedPrFiles(next)
                                  }}
                                  className="rounded border-gray-300 text-indigo-600 cursor-pointer" />
                              </td>
                              <td className="px-4 py-2 font-mono text-xs text-gray-700 truncate max-w-xs">
                                <span className="text-gray-400 mr-1.5 bg-gray-100 px-1 rounded">.{f.ext}</span>
                                {f.path}
                              </td>
                              <td className="px-4 py-2 text-right text-gray-600">{f.unitCount.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-gray-600">{f.wordCount.toLocaleString()}</td>
                            </tr>
                          )})}
                          <tr className="bg-gray-50 font-medium">
                            <td className="px-3 py-2" />
                            <td className="px-4 py-2 text-xs text-gray-700">Selected</td>
                            <td className="px-4 py-2 text-right text-gray-900">{selUnits.toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-gray-900">{selWords.toLocaleString()}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )})()}

                  {/* Skipped files */}
                  {prAnalysis.skippedFiles.length > 0 && (
                    <div className="border border-amber-200 rounded-lg overflow-hidden">
                      <div className="bg-amber-50 px-4 py-2 border-b border-amber-200">
                        <p className="text-xs font-medium text-amber-800">
                          {prAnalysis.skippedFiles.length} file{prAnalysis.skippedFiles.length !== 1 ? "s" : ""} skipped
                        </p>
                      </div>
                      <div className="divide-y divide-amber-100">
                        {prAnalysis.skippedFiles.map((f: { path: string; reason: string }) => (
                          <div key={f.path} className="px-4 py-2 flex items-start gap-3 text-xs">
                            <code className="text-gray-500 truncate flex-1">{f.path}</code>
                            <span className="text-amber-700 shrink-0">{f.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {prAnalysis.files.length > 0 && (
                    <>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800 space-y-1">
                        <p className="font-medium">What happens next</p>
                        <ol className="list-decimal pl-4 space-y-1 text-blue-700">
                          <li>Select the files you want to translate using the checkboxes above.</li>
                          <li>Click the button below — selected files load into the wizard.</li>
                          <li>Pick your target languages and confirm the job.</li>
                          <li>Once complete, download the translated files and commit them to your branch manually.</li>
                        </ol>
                      </div>
                      <button
                        onClick={usePrFiles}
                        disabled={selectedPrFiles.size === 0}
                        className="w-full px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                      >
                        Use {selectedPrFiles.size} selected file{selectedPrFiles.size !== 1 ? "s" : ""} →
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── File upload panel ── */}
          {sourceMode === "file" && (<>
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors cursor-pointer"
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".json,.csv,.md,.txt,.pdf,.html,.htm,.xliff,.xlf,.strings,.stringsdict,.xcstrings,.po,.xml,.arb,.properties"
              multiple
              className="hidden"
              onChange={handleInputChange}
            />
            <p className="text-gray-500">
              Drop files here or click to browse
            </p>
            <p className="text-xs text-gray-400 mt-1">JSON · CSV · Markdown · TXT · PDF · HTML · XLIFF · .strings · .po · Android XML · .arb · .properties · Multiple files OK</p>
          </div>

          {/* File list */}
          {entries.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {entries.length} file{entries.length !== 1 ? "s" : ""} queued
                </p>
                <button
                  onClick={() => setEntries([])}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Remove all
                </button>
              </div>

              {entries.map((entry: FileEntry) => {
                const isPdf = entry.file.name.endsWith(".pdf")
                const stringCount = isPdf ? null : entry.preview.length
                const probe = entry.pdfProbe
                const isXliff = (entry.file.name.endsWith(".xliff") || entry.file.name.endsWith(".xlf"))
                return (
                  <div
                    key={entry.key}
                    className={`bg-white rounded-xl border px-4 py-3 flex items-start gap-3 ${
                      entry.parseError ? "border-red-200 bg-red-50" : "border-gray-200"
                    }`}
                  >
                    {/* Type badge */}
                    <span className="mt-0.5 text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded shrink-0">
                      {fileTypeLabel(entry.file.name)}
                    </span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{entry.file.name}</p>
                      {entry.parseError ? (
                        <p className="text-xs text-red-600 mt-0.5">{entry.parseError}</p>
                      ) : entry.sizeWarning ? (
                        <p className="text-xs text-amber-600 mt-0.5">⚠ {entry.sizeWarning}</p>
                      ) : (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatBytes(entry.file.size)}
                          {isPdf && probe
                            ? ` · ${probe.numPages} page${probe.numPages !== 1 ? "s" : ""} · ~${probe.estimatedUnits} strings`
                            : isPdf && entry.probePending
                              ? null
                              : isXliff && entry.xliffMeta
                                ? ` · ${entry.xliffMeta.emptyUnitCount} untranslated unit${entry.xliffMeta.emptyUnitCount !== 1 ? "s" : ""}`
                                : stringCount !== null
                                  ? ` · ${stringCount} string${stringCount !== 1 ? "s" : ""} detected`
                                  : ""}
                        </p>
                      )}
                      {isPdf && entry.probePending && (() => {
                        const mb = entry.file.size / (1024 * 1024)
                        const estSecs = mb < 0.5 ? "5–15 sec" : mb < 2 ? "15–30 sec" : mb < 10 ? "30–60 sec" : "1–3 min"
                        return (
                          <div className="mt-2 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-indigo-600">Analysing PDF…</span>
                              <span className="text-xs text-gray-400">est. {estSecs}</span>
                            </div>
                            <div className="relative h-2.5 w-full bg-indigo-100 rounded-full overflow-hidden">
                              <div
                                className="absolute inset-y-0 left-0 w-2/5 bg-indigo-500 rounded-full"
                                style={{animation: "pdf-scan 1.5s ease-in-out infinite"}}
                              />
                            </div>
                            <p className="text-xs text-gray-400 leading-relaxed">
                              Extracting and segmenting all text now so translation starts instantly.
                              {mb >= 2 && " Large files run through multiple extraction strategies (pdftotext → pdfplumber → pypdf)."}
                              {mb >= 5 && " Scanned/image PDFs also require AI vision OCR, which adds extra time."}
                            </p>
                            <style>{`@keyframes pdf-scan{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}`}</style>
                          </div>
                        )
                      })()}
                      {isXliff && entry.xliffMeta && !entry.parseError && (
                        <p className="text-xs text-indigo-600 mt-0.5">
                          Source: <strong>{entry.xliffMeta.sourceLanguage}</strong>
                          {entry.xliffMeta.targetLanguage && (
                            <> · Detected target: <strong>{entry.xliffMeta.targetLanguage}</strong> (auto-selected)</>
                          )}
                        </p>
                      )}
                      {isPdf && probe && !entry.parseError && (
                        <>
                          <p className={`text-xs mt-0.5 ${probe.isScanned ? "text-amber-600" : "text-green-600"}`}>
                            {probe.isScanned
                              ? `Scanned PDF — ${probe.numPages} page${probe.numPages !== 1 ? "s" : ""}, text extracted via AI vision`
                              : `Text PDF — ${probe.wordCount.toLocaleString()} words across ${probe.numPages} page${probe.numPages !== 1 ? "s" : ""}`}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {probe.isScanned
                              ? "Scanned PDFs use Claude Vision OCR — analysis takes longer for many pages"
                              : "Text PDFs extract instantly — no AI needed for analysis"}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Delivers .xliff · .txt · .pdf — original layout is approximated
                          </p>
                        </>
                      )}
                      {entry.file.name.endsWith(".md") && !entry.parseError && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          Code blocks excluded from translation
                        </p>
                      )}
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => removeEntry(entry.key)}
                      className="text-gray-300 hover:text-red-500 transition-colors shrink-0 text-lg leading-none mt-0.5"
                      title="Remove file"
                    >
                      ×
                    </button>
                  </div>
                )
              })}

              {/* Add more */}
              <button
                onClick={() => document.getElementById("file-input")?.click()}
                className="w-full border border-dashed border-gray-300 rounded-xl py-2.5 text-sm text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
              >
                + Add more files
              </button>
            </div>
          )}

          {/* Preview for single non-PDF file */}
          {entries.length === 1 && !entries[0].file.name.endsWith(".pdf") && entries[0].preview.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-600">
                Preview (first 10 strings)
              </div>
              <table className="w-full text-sm min-w-[320px]">
                <tbody className="divide-y divide-gray-50">
                  {entries[0].preview.slice(0, 10).map((u: SourceUnit) => (
                    <tr key={u.id}>
                      <td className="px-4 py-2 text-xs text-gray-400 w-1/3 truncate">{u.id}</td>
                      <td className="px-4 py-2 text-gray-700 truncate">{u.sourceText}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              disabled={!canProceed || entries.some((e: (typeof entries)[number]) => e.probePending)}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40"
            >
              Next: Configure →
            </button>
          </div>
          </>)}
        </div>
      )}

      {/* ── Step 2 — Configure ── */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div>
              <h2 className="font-medium text-gray-900">Job details</h2>
              <p className="text-xs text-gray-400 mt-0.5">Name this job so you can find it later. Your downloaded files will use this name.</p>
              <p className="text-xs text-gray-400 mt-1">Pricing: $0.007/word + AI cost. Minimum charge $5.00/job.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Job name{entries.length > 1 && <span className="ml-1 text-gray-400 font-normal">(used as prefix for each file)</span>}
              </label>
              <input
                type="text"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {entries.some((e: FileEntry) => !e.xliffMeta) && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Source language</label>
                <select
                  value={sourceLanguage}
                  onChange={(e) => setSourceLanguage(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {STUDIO_LANGUAGES.map((l: (typeof STUDIO_LANGUAGES)[number]) => (
                    <option key={l.code} value={l.code}>{l.name} ({l.code})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">The original language of your content.</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div>
              <h2 className="font-medium text-gray-900">AI provider</h2>
            </div>
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-indigo-200 bg-indigo-50">
              <span className="text-indigo-600 text-lg">✦</span>
              <div>
                <p className="text-sm font-semibold text-indigo-900">Claude Sonnet 4.6 by Anthropic</p>
                <p className="text-xs text-indigo-600 mt-0.5">Best quality for translation — fixed for this release</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-medium text-gray-900">
                  Target languages
                  {selectedLangs.size > 0 && (
                    <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                      {selectedLangs.size} selected
                    </span>
                  )}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Choose your target languages. You'll get one translated file per language.
                </p>
              </div>
              <button onClick={clearAll} className="text-xs text-gray-400 hover:underline shrink-0 ml-4">Clear</button>
            </div>

            <div className="flex flex-wrap gap-2">
              {LANGUAGE_PRESETS.map((preset: (typeof LANGUAGE_PRESETS)[number]) => {
                const count = preset.codes.filter((c: string) => STUDIO_LANGUAGES.some((l: (typeof STUDIO_LANGUAGES)[number]) => l.code === c)).length
                const isActive = activePresetId === preset.id
                return (
                  <div key={preset.id} className="relative group/preset">
                    <button
                      type="button"
                      onClick={() => setSelectedLangs(new Set(preset.codes.filter((c: string) => STUDIO_LANGUAGES.some((l: (typeof STUDIO_LANGUAGES)[number]) => l.code === c))))}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        isActive
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700"
                      }`}
                    >
                      {preset.label} <span className={isActive ? "opacity-75" : "text-gray-400"}>({count})</span>
                    </button>
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 hidden group-hover/preset:block">
                      <div className="bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                        {preset.description}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                      </div>
                    </div>
                  </div>
                )
              })}
              <button
                type="button"
                onClick={selectAll}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  selectedLangs.size === STUDIO_LANGUAGES.length
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
                }`}
              >
                ✦ All ({STUDIO_LANGUAGES.length})
              </button>
            </div>

            {selectedLangs.size > 0 && (
              <div className="border border-indigo-100 bg-indigo-50 rounded-lg p-3">
                <p className="text-xs font-medium text-indigo-700 mb-2">{selectedLangs.size} selected</p>
                <div className="flex flex-wrap gap-1.5">
                  {STUDIO_LANGUAGES.filter((l: (typeof STUDIO_LANGUAGES)[number]) => selectedLangs.has(l.code)).map((lang: (typeof STUDIO_LANGUAGES)[number]) => (
                    <span
                      key={lang.code}
                      className="inline-flex items-center gap-1 text-xs bg-white border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full"
                    >
                      {lang.name}
                      <button type="button" onClick={() => toggleLang(lang.code)} className="text-indigo-400 hover:text-indigo-700 leading-none">×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search languages…"
                    value={langSearch}
                    onChange={(e) => setLangSearch(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <select
                    value={regionFilter}
                    onChange={(e) => setRegionFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">All regions</option>
                    {STUDIO_LANGUAGE_REGIONS.map((r: (typeof STUDIO_LANGUAGE_REGIONS)[number]) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
                  {/* Pinned: en-US + CJKV */}
                  {pinnedLangs.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 px-0.5">
                        Popular
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {pinnedLangs.map((lang: (typeof pinnedLangs)[number]) => (
                          <button
                            key={lang.code}
                            type="button"
                            onClick={() => toggleLang(lang.code)}
                            className={`text-xs px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
                              selectedLangs.has(lang.code)
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-gray-700 border-gray-200 hover:border-indigo-400"
                            }`}
                          >
                            <span className="block font-medium truncate">{lang.name}</span>
                            <span className="block opacity-60">{lang.code}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Divider */}
                  {pinnedLangs.length > 0 && unpinnedLangs.length > 0 && (
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-0.5 pt-1">
                      All languages
                    </p>
                  )}
                  {/* Rest */}
                  {unpinnedLangs.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {unpinnedLangs.map((lang: (typeof unpinnedLangs)[number]) => (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => toggleLang(lang.code)}
                          className={`text-xs px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
                            selectedLangs.has(lang.code)
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                          }`}
                        >
                          <span className="block font-medium truncate">{lang.name}</span>
                          <span className="block opacity-60">{lang.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
            </div>
          </div>

          {/* ── Terminology / Glossary ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header toggle */}
            <button
              type="button"
              onClick={() => setGlossaryOpen(o => !o)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-medium text-gray-900">Terminology</h2>
                  <span className="text-xs text-gray-400 font-normal">optional</span>
                  {totalGlossaryTerms > 0 && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      {totalGlossaryTerms} term{totalGlossaryTerms !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Pin key phrases so the AI translates them consistently every time.
                </p>
              </div>
              <span className="text-gray-400 text-sm ml-4 shrink-0">{glossaryOpen ? "▲" : "▼"}</span>
            </button>

            {/* Body */}
            {glossaryOpen && (
              <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">
                {selectedLangs.size === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">
                    Select target languages above to add terminology.
                  </p>
                ) : (() => {
                  const langs = STUDIO_LANGUAGES.filter((l: (typeof STUDIO_LANGUAGES)[number]) => selectedLangs.has(l.code))
                  const activeLang = selectedLangs.size === 1
                    ? langs[0]?.code ?? ""
                    : (selectedLangs.has(glossaryTab) ? glossaryTab : "")
                  const terms = glossary[activeLang] ?? []

                  return (
                    <>
                      {/* Language tabs — only shown for multiple languages */}
                      {selectedLangs.size > 1 && (
                        <div className="flex flex-wrap gap-1.5">
                          {langs.map((lang: (typeof STUDIO_LANGUAGES)[number]) => {
                            const count = (glossary[lang.code] ?? []).filter((t: GlossaryTerm) => t.source.trim() && t.target.trim()).length
                            const isActive = glossaryTab === lang.code
                            return (
                              <button
                                key={lang.code}
                                type="button"
                                onClick={() => setGlossaryTab(lang.code)}
                                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                                  isActive
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "border-gray-200 bg-gray-50 text-gray-600 hover:border-indigo-300 hover:text-indigo-700"
                                }`}
                              >
                                {lang.code}
                                {count > 0 && (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                    isActive ? "bg-indigo-500 text-white" : "bg-gray-200 text-gray-600"
                                  }`}>{count}</span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {/* Term editor pane */}
                      {(!activeLang && selectedLangs.size > 1) ? (
                        <p className="text-sm text-gray-400 text-center py-4">
                          Select a language tab to add terms.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {/* Column headers */}
                          {terms.length > 0 && (
                            <div className="grid grid-cols-[1fr_16px_1fr_24px] gap-2 px-1 pb-0.5">
                              <p className="text-xs font-medium text-gray-500">Source term</p>
                              <span />
                              <p className="text-xs font-medium text-gray-500">
                                {STUDIO_LANGUAGES.find((l: (typeof STUDIO_LANGUAGES)[number]) => l.code === activeLang)?.name ?? activeLang} translation
                              </p>
                              <span />
                            </div>
                          )}

                          {/* Term rows */}
                          {terms.map((term: GlossaryTerm, i: number) => (
                            <div key={i} className="grid grid-cols-[1fr_16px_1fr_24px] gap-2 items-center">
                              <input
                                value={term.source}
                                onChange={e => updateTerm(activeLang, i, "source", e.target.value)}
                                placeholder="e.g. l10n"
                                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-gray-300"
                              />
                              <span className="text-gray-300 text-sm text-center">→</span>
                              <input
                                value={term.target}
                                onChange={e => updateTerm(activeLang, i, "target", e.target.value)}
                                placeholder="e.g. 本地化"
                                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-gray-300"
                              />
                              <button
                                type="button"
                                onClick={() => removeTerm(activeLang, i)}
                                className="text-gray-300 hover:text-red-400 transition-colors text-xl leading-none flex items-center justify-center"
                                title="Remove term"
                              >×</button>
                            </div>
                          ))}

                          {/* Add term / counter row */}
                          <div className="flex items-center justify-between pt-1">
                            <button
                              type="button"
                              disabled={terms.length >= MAX_TERMS}
                              onClick={() => addTerm(activeLang)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                            >
                              <span className="text-base leading-none font-light">+</span> Add term
                            </button>
                            <span className={`text-xs tabular-nums ${terms.length >= MAX_TERMS ? "text-amber-500 font-medium" : "text-gray-400"}`}>
                              {terms.length}/{MAX_TERMS}
                            </span>
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2.5 leading-relaxed">
                        Listed terms are always translated exactly as specified. Leave a row blank to let AI decide.
                      </p>
                    </>
                  )
                })()}
              </div>
            )}
          </div>

          {entries.some((e: FileEntry) => e.probePending) && (
            <p className="text-xs text-amber-600 text-right">
              Analysing PDF… please wait before proceeding.
            </p>
          )}
          <div className="flex justify-between">
            <button onClick={() => { setStep(1); setJobName("") }} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!jobName.trim() || selectedLangs.size === 0 || entries.some((e: FileEntry) => e.probePending || e.parseError)}
              className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40"
              title={entries.some((e: FileEntry) => e.probePending) ? "Wait for PDF analysis to complete" : undefined}
            >
              Next: Confirm →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3 — Confirm + Cost estimate ── */}
      {step === 3 && (() => {
        const selectedModel = currentProvider.models.find((m: (typeof currentProvider.models)[number]) => m.id === model)!
        const batchSize = 50

        // Pricing constants (mirrors src/lib/stripe.ts — client-safe copy)
        const PAYG_MARKUP = 5
        const PLATFORM_FEE_PER_WORD = 0.007
        const MIN_JOB_FEE = 5.00
        const CHARS_PER_WORD = 5

        function fmt(n: number) {
          if (n < 0.001) return "< $0.001"
          return `$${n.toFixed(n < 0.01 ? 4 : n < 1 ? 3 : 2)}`
        }

        // Per-file cost rows
        const fileRows = entries.map((entry: FileEntry) => {
          const isPdf = entry.file.name.endsWith(".pdf")
          const isXliff = (entry.file.name.endsWith(".xliff") || entry.file.name.endsWith(".xlf"))
          const probe = entry.pdfProbe

          let strings: number
          let extractCostOneTime = 0
          let pdfLabel = ""

          if (isPdf) {
            if (probe) {
              strings = probe.estimatedUnits
              if (probe.isScanned) {
                // Scanned: Claude Vision — ~1 600 input + ~200 output tokens per page for extraction
                const extractIn = probe.numPages * 1600
                const extractOut = probe.numPages * 200
                extractCostOneTime = (extractIn * 3 + extractOut * 15) / 1_000_000
                pdfLabel = `${probe.numPages} pages · scanned · Vision extraction ${fmt(extractCostOneTime)}`
              } else {
                // Text-based: free extraction via pdf-parse
                pdfLabel = `${probe.numPages} pages · text-based · free extraction`
              }
            } else {
              // Probe still loading or failed — fall back to size estimate
              // Scanned PDFs average ~150 KB/page at 150 dpi
              const fallbackPages = Math.max(1, Math.ceil(entry.file.size / (150 * 1024)))
              strings = fallbackPages * 40
              pdfLabel = `~${fallbackPages} pages (estimated)`
            }
          } else if (isXliff) {
            strings = entry.xliffMeta?.emptyUnitCount ?? entry.preview.length
          } else {
            strings = entry.preview.length
          }

          const totalChars = isPdf
            ? (probe?.wordCount ? probe.wordCount * CHARS_PER_WORD : strings * 80)
            : isXliff && entry.xliffMeta?.sourceCharCount
              ? entry.xliffMeta.sourceCharCount
              : entry.preview.reduce((s: number, u: SourceUnit) => s + u.sourceText.length, 0)
          const batches = Math.max(1, Math.ceil(strings / batchSize))
          const inputTok = Math.ceil(totalChars / 4) + batches * 150
          const outputTok = Math.ceil(totalChars / 4 * 1.1)
          const rawApiCostPerLang = (inputTok * selectedModel.inputPricePer1M + outputTok * selectedModel.outputPricePer1M) / 1_000_000
          const estimatedWords = Math.ceil(totalChars / CHARS_PER_WORD)
          // Per-language charge = raw API cost × markup + platform fee per word
          // Platform fee minimum ($5/job) applied across all languages at the end
          const chargePerLang = rawApiCostPerLang * PAYG_MARKUP + estimatedWords * PLATFORM_FEE_PER_WORD
          const totalFileCost = extractCostOneTime * PAYG_MARKUP + chargePerLang * selectedLangs.size
          return { entry, isPdf, strings, estimatedWords, batches, inputTok, outputTok, rawApiCostPerLang, chargePerLang, totalFileCost, extractCostOneTime, pdfLabel }
        })

        const grandTotalRaw = fileRows.reduce((s: number, r: (typeof fileRows)[number]) => s + r.totalFileCost, 0)
        const totalWords = fileRows.reduce((s: number, r: (typeof fileRows)[number]) => s + r.estimatedWords, 0)
        // Compute effective discount pct — scale down if job words exceed the promo's free-word cap
        const effectiveDiscountPct = (() => {
          if (!promoState?.valid) return 0
          const { discountPct, maxWordsPerJob } = promoState
          if (maxWordsPerJob != null && totalWords > maxWordsPerJob) {
            return Math.round((maxWordsPerJob / totalWords) * discountPct)
          }
          return discountPct
        })()
        // Waive the minimum fee when the promo covers 100% of the variable cost so users
        // don't pay $5 on a $2 job that was supposed to be "free" with their promo code.
        const promoCoversAll = effectiveDiscountPct === 100
        const grandTotalBeforeDiscount = promoCoversAll ? grandTotalRaw : Math.max(MIN_JOB_FEE, grandTotalRaw)
        // Apply promo discount on top of the (post-minimum) total
        const promoDiscount = effectiveDiscountPct > 0 ? grandTotalBeforeDiscount * (effectiveDiscountPct / 100) : 0
        const grandTotalCharge = Math.max(0, grandTotalBeforeDiscount - promoDiscount)
        // Split into fixed (platform fee) and variable (AI markup) components for transparency

        const minFeeApplied = !promoCoversAll && grandTotalBeforeDiscount > grandTotalRaw

        return (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h2 className="font-medium text-gray-900">Review and start</h2>
              <dl className="text-sm space-y-2">
                <Row label="Job name" value={jobName} />
                <Row label="Files" value={`${entries.length} file${entries.length !== 1 ? "s" : ""} · ${totalWords.toLocaleString()} words`} />
                <Row label="AI model" value={`${currentProvider.label} — ${selectedModel.label}`} />
                <Row label="Target languages" value={`${selectedLangs.size} languages`} />
              </dl>
            </div>

            {/* Cost breakdown per file */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="font-medium text-gray-900">Estimated cost</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedModel.label}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{fmt(grandTotalCharge)}</p>
                  {(() => {
                    const agencyLow  = Math.round(totalWords * selectedLangs.size * 0.10)
                    const agencyHigh = Math.round(totalWords * selectedLangs.size * 0.15)
                    return agencyLow >= 10 ? (
                      <p className="text-xs text-gray-400 mt-0.5">
                        vs. ${agencyLow}–${agencyHigh} with a human agency
                      </p>
                    ) : null
                  })()}
                </div>
              </div>

              <table className="w-full text-sm min-w-[360px]">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-5 py-2 font-medium">File</th>
                    <th className="px-5 py-2 font-medium text-right">Words</th>
                    <th className="px-5 py-2 font-medium text-right">
                      Total ({selectedLangs.size} lang{selectedLangs.size !== 1 ? "s" : ""})
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {fileRows.map(({ entry, isPdf, estimatedWords, pdfLabel, totalFileCost }) => (
                    <tr key={entry.key} className="hover:bg-gray-50">
                      <td className="px-5 py-2.5">
                        <span className="font-medium text-gray-900 truncate block max-w-xs">{entry.file.name}</span>
                        {isPdf && pdfLabel && (
                          <span className="text-xs text-gray-400">{pdfLabel}</span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-right text-gray-500">
                        {isPdf ? `~${estimatedWords.toLocaleString()}` : estimatedWords.toLocaleString()}
                      </td>
                      <td className="px-5 py-2.5 text-right font-medium text-gray-900">
                        {fmt(minFeeApplied ? grandTotalBeforeDiscount / fileRows.length : totalFileCost)}
                        {minFeeApplied && (
                          <span className="block text-xs text-gray-400 font-normal">min. fee</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                  <tr>
                    <td className="px-5 py-2.5 font-semibold text-gray-900">Total</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-gray-900">~{totalWords.toLocaleString()}</td>
                    <td className="px-5 py-2.5 text-right font-bold text-indigo-700">{fmt(grandTotalCharge)}</td>
                  </tr>
                </tfoot>
              </table>

              {/* Cost summary — promo discount only */}
              {(promoState?.valid || minFeeApplied || fileRows.some((r: (typeof fileRows)[number]) => r.isPdf)) && (
                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 space-y-1.5">
                  {minFeeApplied && (
                    <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      <span className="shrink-0 mt-0.5">ⓘ</span>
                      <span>A {fmt(MIN_JOB_FEE)} minimum applies — your content is small so the minimum job fee is charged instead of the per-word rate. Add more languages or files to get more value from this job.</span>
                    </div>
                  )}
                  {promoState?.valid && (
                    <div className="flex justify-between text-xs text-green-600 font-medium">
                      <span>Promo code <span className="font-bold">{promoState.code}</span> ({effectiveDiscountPct}% off)</span>
                      <span>−{fmt(promoDiscount)}</span>
                    </div>
                  )}
                  {fileRows.some((r: (typeof fileRows)[number]) => r.isPdf) && (
                    <p className="text-xs text-gray-400">
                      PDF: delivered as .xliff (bilingual), .txt, and .pdf. Original layout is approximated.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Promo code */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-700 mb-2">Promo code</p>
              <div className="flex gap-2">
                <input
                  value={promoInput}
                  onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoState(null) }}
                  placeholder="Enter code"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={submitting}
                />
                <button
                  type="button"
                  disabled={!promoInput.trim() || promoLoading || submitting}
                  onClick={async () => {
                    setPromoLoading(true)
                    setPromoState(null)
                    try {
                      const res = await fetch("/api/billing/promo", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ code: promoInput.trim() }),
                      })
                      const data = await res.json() as { valid: boolean; discountPct?: number; code?: string; maxWordsPerJob?: number | null; error?: string }
                      if (data.valid) {
                        setPromoState({ valid: true, discountPct: data.discountPct!, code: data.code!, maxWordsPerJob: data.maxWordsPerJob })
                      } else {
                        setPromoState({ valid: false, discountPct: 0, code: "", error: data.error })
                      }
                    } catch {
                      setPromoState({ valid: false, discountPct: 0, code: "", error: "Failed to validate code" })
                    }
                    setPromoLoading(false)
                  }}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
                >
                  {promoLoading ? "…" : "Apply"}
                </button>
              </div>
              {promoState && (
                <div className="mt-1.5 space-y-1">
                  <p className={`text-xs ${promoState.valid ? "text-green-600" : "text-red-500"}`}>
                    {promoState.valid
                      ? `✓ Code accepted — first 10,000 words free!`
                      : `✕ ${promoState.error}`}
                  </p>
                  {promoState.valid && promoState.maxWordsPerJob != null && totalWords > promoState.maxWordsPerJob && (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      ℹ First {promoState.maxWordsPerJob.toLocaleString()} words are free — you&apos;ll only pay for the remaining {(totalWords - promoState.maxWordsPerJob).toLocaleString()} words.
                    </p>
                  )}
                </div>
              )}
            </div>

            {submitError && (
              <div className="space-y-2">
                <pre className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 whitespace-pre-wrap">{submitError}</pre>
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Your card has not been charged — the error occurred before any translation began.
                </p>
              </div>
            )}

            {!hasCard ? (
              /* ── No payment method: payment is the only CTA ── */
              <div className="bg-white rounded-xl border-2 border-indigo-200 p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💳</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Add a card to get started</p>
                    <p className="text-xs text-gray-500 mt-1">
                      You're only charged when your translation job completes — nothing is billed today.
                    </p>
                  </div>
                </div>
                {cardError && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {cardError}
                  </div>
                )}
                <div className="flex items-center justify-between gap-4">
                  <button onClick={() => setStep(2)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                    ← Back
                  </button>
                  <button
                    onClick={addCard}
                    disabled={addingCard}
                    className="flex-1 max-w-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                  >
                    {addingCard ? "Redirecting to payment…" : "Add payment method →"}
                  </button>
                </div>
                <p className="text-xs text-gray-400 text-center">
                  Secured by Stripe · We never store your card details
                </p>
              </div>
            ) : (
              /* ── Card on file: show confirmation and start button ── */
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <span>✓</span>
                  <span>Payment method on file — you will be charged when this job completes.</span>
                </div>
                <div className="flex justify-between">
                  <button onClick={() => setStep(2)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                    ← Back
                  </button>
                  <button
                    onClick={submit}
                    disabled={submitting}
                    className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {submitting
                      ? `Starting${entries.length > 1 ? "…" : "…"}`
                      : `Start Translation${entries.length > 1 ? ` (${entries.length} jobs)` : ""}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 font-medium">{value}</dd>
    </div>
  )
}
