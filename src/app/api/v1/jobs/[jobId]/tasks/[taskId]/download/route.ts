import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { resolveAuth } from "@/lib/resolve-auth"
import { readFile } from "fs/promises"
import { parseXliff } from "@/lib/xliff-parser"
import { generateTranslatedTxt } from "@/lib/pdf-generator"
import {
  exportAsStrings, exportAsStringsDict, exportAsXcstrings,
  exportAsPo, exportAsAndroidXml, exportAsArb, exportAsProperties,
  formatMimeType,
} from "@/lib/original-format-exporter"

/**
 * GET /api/v1/jobs/[jobId]/tasks/[taskId]/download
 * Download the translated file for a completed task.
 * Accepts optional ?format= query param (same as the internal download route).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string; taskId: string }> }
) {
  const auth = await resolveAuth(req)
  if (auth.kind === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { jobId, taskId } = await params

  const [job, task] = await Promise.all([
    db.translationJob.findUnique({ where: { id: jobId } }),
    db.translationTask.findUnique({ where: { id: taskId } }),
  ])

  if (!job || !task || task.jobId !== jobId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (auth.user.role !== "admin" && job.createdById !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (task.status !== "completed" && task.status !== "imported") {
    return NextResponse.json(
      { error: "Translation not yet complete", status: task.status },
      { status: 409 }
    )
  }
  if (!task.xliffData && !task.xliffFileUrl) {
    return NextResponse.json({ error: "Translation output not found" }, { status: 404 })
  }

  const safeName = `${job.name}-${task.targetLanguage}`.replace(/[^a-zA-Z0-9-_]/g, "_")
  const fmt = job.sourceFormat

  // XLIFF source: serve raw XLIFF
  if (fmt === "xliff") {
    const xliff = task.xliffData ?? await readFile(task.xliffFileUrl!, "utf-8")
    return new NextResponse(xliff, {
      headers: {
        "Content-Type": "application/xliff+xml",
        "Content-Disposition": `attachment; filename="${safeName}.xliff"`,
      },
    })
  }

  // JSON / CSV / Markdown / text-based localization formats
  const [xliffContent, sourceContent] = await Promise.all([
    task.xliffData ? Promise.resolve(task.xliffData) : readFile(task.xliffFileUrl!, "utf-8"),
    job.sourceData ? Promise.resolve(job.sourceData) : readFile(job.sourceFileUrl, "utf-8"),
  ])

  const parsed = parseXliff(xliffContent)
  const translations = new Map<string, string>(
    parsed.units
      .filter((u: (typeof parsed.units)[number]) => u.targetText?.trim())
      .map((u: (typeof parsed.units)[number]) => [u.id, u.targetText])
  )

  if (fmt === "json") {
    const sourceJson = JSON.parse(sourceContent) as unknown
    const translated = applyTranslationsToJson(sourceJson, translations)
    return new NextResponse(JSON.stringify(translated, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}.json"`,
      },
    })
  }

  if (fmt === "csv") {
    const unitsContent = job.unitsData ?? await readFile(job.unitsFileUrl, "utf-8")
    const units = JSON.parse(unitsContent) as Array<{ id: string; sourceText: string }>
    const lines = ["id,value"]
    for (const unit of units) {
      const text = translations.get(unit.id) ?? unit.sourceText
      const escapedId = unit.id.includes(",") ? `"${unit.id.replace(/"/g, '""')}"` : unit.id
      const escapedText = `"${text.replace(/"/g, '""')}"`
      lines.push(`${escapedId},${escapedText}`)
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}.csv"`,
      },
    })
  }

  if (fmt === "md") {
    const reconstructed = reconstructMarkdown(sourceContent, translations)
    return new NextResponse(reconstructed, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}.md"`,
      },
    })
  }

  if (fmt === "txt") {
    const paragraphs = parsed.units
      .map((u: (typeof parsed.units)[number]) => u.targetText?.trim())
      .filter(Boolean) as string[]
    const txt = generateTranslatedTxt(paragraphs, job.name, task.targetLanguage)
    return new NextResponse(txt, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeName}.txt"`,
      },
    })
  }

  // Localisation resource formats
  const RESOURCE_FORMATS = new Set(["strings","stringsdict","xcstrings","po","xml","arb","properties"])
  if (RESOURCE_FORMATS.has(fmt)) {
    const units = parsed.units
      .filter((u: (typeof parsed.units)[number]) => u.targetText?.trim())
      .map((u: (typeof parsed.units)[number]) => ({
        id: u.id,
        sourceText: u.sourceText ?? "",
        translatedText: u.targetText,
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

    const mime = formatMimeType(fmt)
    return new NextResponse(body, {
      headers: {
        "Content-Type": `${mime}; charset=utf-8`,
        "Content-Disposition": `attachment; filename="${safeName}.${fmt}"`,
      },
    })
  }

  // Fallback: raw XLIFF
  const xliff = task.xliffData ?? await readFile(task.xliffFileUrl!, "utf-8")
  return new NextResponse(xliff, {
    headers: {
      "Content-Type": "application/xliff+xml",
      "Content-Disposition": `attachment; filename="${safeName}.xliff"`,
    },
  })
}

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
  let inFencedBlock = false
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^```/.test(line) || /^~~~/.test(line)) { inFencedBlock = !inFencedBlock; out.push(line); i++; continue }
    if (inFencedBlock) { out.push(line); i++; continue }
    if (/^( {4}|\t)/.test(line)) { out.push(line); i++; continue }
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const text = headingMatch[2].trim()
      if (text) { const id = `h${headingMatch[1].length}_${index++}`; out.push(`${headingMatch[1]} ${translations.get(id) ?? text}`) }
      else out.push(line)
      i++; continue
    }
    const listMatch = line.match(/^(\s*(?:[-*+]|\d+\.)\s+)(.+)$/)
    if (listMatch) {
      const text = listMatch[2].trim()
      if (text) { const id = `li_${index++}`; out.push(`${listMatch[1]}${translations.get(id) ?? text}`) }
      else out.push(line)
      i++; continue
    }
    if (!line.trim()) { out.push(line); i++; continue }
    const paraLines: string[] = []
    while (i < lines.length && lines[i].trim() !== "" && !/^```/.test(lines[i]) && !/^~~~/.test(lines[i]) && !/^(#{1,6})\s/.test(lines[i]) && !/^(\s*(?:[-*+]|\d+\.)\s+)/.test(lines[i]) && !/^( {4}|\t)/.test(lines[i])) {
      paraLines.push(lines[i]); i++
    }
    if (paraLines.length > 0) {
      const text = paraLines.join(" ").trim()
      if (text) { const id = `p_${index++}`; out.push(translations.get(id) ?? text) }
    }
  }
  return out.join("\n")
}
