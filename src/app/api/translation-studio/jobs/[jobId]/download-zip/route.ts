import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readFile } from "fs/promises"
import JSZip from "jszip"
import { parseXliff } from "@/lib/xliff-parser"
import { parseCsvFull } from "@/lib/source-parser"
import { generateTranslatedTxt } from "@/lib/pdf-generator"
import {
  exportAsStrings, exportAsStringsDict, exportAsXcstrings,
  exportAsPo, exportAsAndroidXml, exportAsArb, exportAsProperties,
} from "@/lib/original-format-exporter"
import { reconstructHtml } from "@/lib/html-source-parser"

export const maxDuration = 60

// GET /api/translation-studio/jobs/[jobId]/download-zip
// Returns a ZIP archive containing all completed task files for a job.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { jobId } = await params
  const { id: userId, role } = session.user

  const job = await db.translationJob.findUnique({
    where: { id: jobId },
    include: {
      tasks: {
        where: { status: "completed" },
        orderBy: { targetLanguage: "asc" },
      },
    },
  })

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (role !== "admin" && job.createdById !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (job.tasks.length === 0) {
    return NextResponse.json({ error: "No completed tasks to download" }, { status: 409 })
  }

  const fmt = job.sourceFormat
  const sourceContent = job.sourceData ?? (job.sourceFileUrl ? await readFile(job.sourceFileUrl, "utf-8").catch(() => "") : "")

  const zip = new JSZip()

  for (const task of job.tasks) {
    const safeLang = task.targetLanguage.replace(/[^a-zA-Z0-9-_]/g, "_")
    const xliffContent = task.xliffData ?? (task.xliffFileUrl ? await readFile(task.xliffFileUrl, "utf-8").catch(() => null) : null)
    if (!xliffContent) continue

    try {
      if (fmt === "xliff") {
        zip.file(`${safeLang}.xliff`, xliffContent)
        continue
      }

      if (fmt === "pdf") {
        // PDF source: include translated .txt (PDF generation is too slow for bulk ZIP)
        const parsed = parseXliff(xliffContent)
        const paragraphs = parsed.units
          .map((u: (typeof parsed.units)[number]) => {
            if (u.targetText === "__IMAGE_PLACEHOLDER__") return null
            return u.targetText?.trim() ? u.targetText : null
          })
          .filter(Boolean) as string[]
        const txt = generateTranslatedTxt(paragraphs, job.name, task.targetLanguage)
        zip.file(`${safeLang}.txt`, txt)
        continue
      }

      const parsed = parseXliff(xliffContent)
      const translations = new Map<string, string>(
        parsed.units
          .filter((u: (typeof parsed.units)[number]) => u.targetText?.trim())
          .map((u: (typeof parsed.units)[number]) => [u.id, u.targetText])
      )

      if (fmt === "json") {
        const sourceJson = JSON.parse(sourceContent) as unknown
        zip.file(`${safeLang}.json`, JSON.stringify(applyTranslationsToJson(sourceJson, translations), null, 2))
        continue
      }

      if (fmt === "csv") {
        if (job.csvTranslateColumns) {
          const translateCols = JSON.parse(job.csvTranslateColumns) as string[]
          const { headers, rows } = parseCsvFull(sourceContent)
          const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
          const outLines = [headers.map(esc).join(",")]
          for (const row of rows) {
            const rowKey = row[0] ?? ""
            const outRow = headers.map((col: string, ci: number) => {
              if (ci === 0) return esc(row[0] ?? "")
              if (translateCols.includes(col)) return esc(translations.get(`${rowKey}__COL__${col}`) ?? row[ci] ?? "")
              return esc(row[ci] ?? "")
            })
            outLines.push(outRow.join(","))
          }
          zip.file(`${safeLang}.csv`, outLines.join("\n"))
        } else {
          const unitsRaw = job.unitsData ?? ""
          const units = unitsRaw ? (JSON.parse(unitsRaw) as Array<{ id: string; sourceText: string }>) : []
          const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
          const lines = ["id,value"]
          for (const unit of units) {
            const id = unit.id.includes(",") ? `"${unit.id.replace(/"/g, '""')}"` : unit.id
            lines.push(`${id},${esc(translations.get(unit.id) ?? unit.sourceText)}`)
          }
          zip.file(`${safeLang}.csv`, lines.join("\n"))
        }
        continue
      }

      if (fmt === "md") {
        zip.file(`${safeLang}.md`, reconstructMarkdown(sourceContent, translations))
        continue
      }

      if (fmt === "html") {
        zip.file(`${safeLang}.html`, reconstructHtml(sourceContent, translations, task.targetLanguage))
        continue
      }

      const RESOURCE_FMTS = new Set(["strings", "stringsdict", "xcstrings", "po", "xml", "arb", "properties"])
      if (RESOURCE_FMTS.has(fmt)) {
        const units = parsed.units
          .filter((u: (typeof parsed.units)[number]) => u.targetText?.trim())
          .map((u: (typeof parsed.units)[number]) => ({
            id: u.id, sourceText: u.sourceText ?? "", translatedText: u.targetText,
          }))
        let body: string
        switch (fmt) {
          case "strings":     body = exportAsStrings(units); break
          case "stringsdict": body = exportAsStringsDict(units); break
          case "xcstrings":   body = exportAsXcstrings(units, sourceContent, task.targetLanguage); break
          case "po":          body = exportAsPo(units, task.targetLanguage); break
          case "xml":         body = exportAsAndroidXml(units); break
          case "arb":         body = exportAsArb(units, sourceContent, task.targetLanguage); break
          case "properties":  body = exportAsProperties(units); break
          default:            body = units.map(u => u.translatedText).join("\n")
        }
        zip.file(`${safeLang}.${fmt}`, body)
        continue
      }

      // Fallback: include raw XLIFF
      zip.file(`${safeLang}.xliff`, xliffContent)

    } catch (err) {
      console.error(`[download-zip] Failed to generate file for ${task.targetLanguage}:`, err)
      // Skip failed tasks rather than aborting the whole ZIP
    }
  }

  const safeName = job.name.replace(/[^a-zA-Z0-9-_]/g, "_")
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })

  return new NextResponse(zipBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName}.zip"`,
    },
  })
}

// ── Helpers (mirrors download/route.ts) ───────────────────────────────────────

function applyTranslationsToJson(node: unknown, translations: Map<string, string>, prefix = ""): unknown {
  if (typeof node === "string") return translations.get(prefix) ?? node
  if (Array.isArray(node)) {
    return node.map((item: unknown) => {
      if (typeof item === "object" && item !== null) {
        const entry = item as Record<string, unknown>
        const id = String(entry.id ?? entry.key ?? entry.name ?? "")
        if (id && translations.has(id)) return { ...entry, value: translations.get(id) }
      }
      return item
    })
  }
  if (typeof node === "object" && node !== null) {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
      result[key] = applyTranslationsToJson(val, translations, prefix ? `${prefix}.${key}` : key)
    }
    return result
  }
  return node
}

function reconstructMarkdown(source: string, translations: Map<string, string>): string {
  const lines = source.split(/\r?\n/)
  const out: string[] = []
  let index = 0
  let inFenced = false
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^```/.test(line) || /^~~~/.test(line)) { inFenced = !inFenced; out.push(line); i++; continue }
    if (inFenced || /^( {4}|\t)/.test(line)) { out.push(line); i++; continue }
    const hm = line.match(/^(#{1,6})\s+(.+)$/)
    if (hm) { const id = `h${hm[1].length}_${index++}`; out.push(`${hm[1]} ${translations.get(id) ?? hm[2].trim()}`); i++; continue }
    const lm = line.match(/^(\s*(?:[-*+]|\d+\.)\s+)(.+)$/)
    if (lm) { const id = `li_${index++}`; out.push(`${lm[1]}${translations.get(id) ?? lm[2].trim()}`); i++; continue }
    if (!line.trim()) { out.push(line); i++; continue }
    const paraLines: string[] = []
    while (i < lines.length && lines[i].trim() && !/^```|^~~~|^#{1,6}\s|^\s*(?:[-*+]|\d+\.)\s|^( {4}|\t)/.test(lines[i])) {
      paraLines.push(lines[i]); i++
    }
    if (paraLines.length > 0) {
      const text = paraLines.join(" ").trim()
      if (text) out.push(translations.get(`p_${index++}`) ?? text)
    }
  }
  return out.join("\n")
}
