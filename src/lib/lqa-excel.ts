/**
 * LQA Excel Report Generator
 * Produces a two-sheet workbook matching the Python LQA.py report format:
 *  Sheet 1 "LQA Summary"  — score card, error breakdown, findings table
 *  Sheet 2 "Bilingual"    — all source/target pairs with issues highlighted
 *
 * Uses exceljs (pure-JS, works in serverless Node.js environments).
 */

import ExcelJS from "exceljs"
import type { LqaAnalysisResult, LqaFinding, ErrorType } from "./lqa-analyzer"

export interface LqaReportMeta {
  fileName: string
  sourceLanguage: string
  targetLanguage: string
  model: string
  createdAt: Date
}

const ERROR_TYPE_LABELS: Record<ErrorType, string> = {
  acc: "ACCURACY",
  lang: "LANGUAGE",
  style: "STYLE",
}

const ERROR_TYPE_COLORS: Record<ErrorType, string> = {
  acc: "FADBD8",
  lang: "FDEBD0",
  style: "FCF3CF",
}

function scoreColor(score: number): string {
  if (score >= 95) return "27AE60"
  if (score >= 85) return "F39C12"
  return "E74C3C"
}

function applyHeaderStyle(
  cell: ExcelJS.Cell,
  bgColor = "2C3E50",
  textColor = "FFFFFF"
) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${bgColor}` } }
  cell.font = { bold: true, color: { argb: `FF${textColor}` }, size: 11 }
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
}

function applyBorder(cell: ExcelJS.Cell) {
  const thin: ExcelJS.BorderStyle = "thin"
  cell.border = {
    top: { style: thin },
    left: { style: thin },
    bottom: { style: thin },
    right: { style: thin },
  }
}

// ─── Sheet 1: LQA Summary ─────────────────────────────────────────────────────

function buildSummarySheet(
  ws: ExcelJS.Worksheet,
  meta: LqaReportMeta,
  result: LqaAnalysisResult
) {
  ws.columns = [
    { key: "A", width: 28 },
    { key: "B", width: 65 },
    { key: "C", width: 18 },
    { key: "D", width: 65 },
  ]

  let row = 1

  // Title
  ws.mergeCells(`A${row}:D${row}`)
  const title = ws.getCell(`A${row}`)
  title.value = "Translation Quality Review Report"
  title.font = { bold: true, size: 16, color: { argb: "FF2C3E50" } }
  title.alignment = { horizontal: "center", vertical: "middle" }
  ws.getRow(row).height = 32
  row += 2

  // Metadata
  const metadata: [string, string][] = [
    ["File Name", meta.fileName],
    ["Source Language", meta.sourceLanguage],
    ["Target Language", meta.targetLanguage],
    ["Total Units", String(result.findings.length > 0 ? "—" : "All passed")],
    ["Model", meta.model],
    ["Generated", meta.createdAt.toISOString().slice(0, 19).replace("T", " ")],
  ]

  for (const [label, value] of metadata) {
    ws.getCell(`A${row}`).value = label
    ws.getCell(`A${row}`).font = { bold: true }
    ws.mergeCells(`B${row}:D${row}`)
    ws.getCell(`B${row}`).value = value
    row++
  }
  row++

  // Quality score banner
  ws.mergeCells(`A${row}:D${row}`)
  const scoreCell = ws.getCell(`A${row}`)
  const bandLabel = result.qualityBand
  scoreCell.value = `Quality Score: ${result.qualityScore}/100  (${bandLabel})`
  scoreCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${scoreColor(result.qualityScore)}` },
  }
  scoreCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } }
  scoreCell.alignment = { horizontal: "center", vertical: "middle" }
  ws.getRow(row).height = 36
  row += 2

  // Error counts table
  const errHeader = ws.getRow(row)
  ;["Error Type", "Count", "", ""].forEach((h, i) => {
    const cell = errHeader.getCell(i + 1)
    cell.value = h
    applyHeaderStyle(cell)
  })
  ws.getRow(row).height = 22
  row++

  const errorRows: [string, number, string][] = [
    ["Accuracy Errors (-3 pts each)", result.accuracyErrors, "C0392B"],
    ["Language Quality Errors (-2 pts each)", result.languageErrors, "E67E22"],
    ["Style/Fluency Errors (-1 pt each)", result.styleErrors, "F39C12"],
  ]

  for (const [label, count, color] of errorRows) {
    ws.getCell(`A${row}`).value = label
    const countCell = ws.getCell(`B${row}`)
    countCell.value = count
    countCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${color}` } }
    countCell.font = { bold: true, color: { argb: "FFFFFFFF" } }
    countCell.alignment = { horizontal: "center" }
    row++
  }
  row++

  // Improvements section
  ws.mergeCells(`A${row}:D${row}`)
  const improveHeader = ws.getCell(`A${row}`)
  improveHeader.value = "Improvements Needed"
  applyHeaderStyle(improveHeader)
  ws.getRow(row).height = 22
  row++

  if (result.findings.length === 0) {
    ws.mergeCells(`A${row}:D${row}`)
    const noneCell = ws.getCell(`A${row}`)
    noneCell.value = "Excellent translation quality — no improvements needed"
    noneCell.font = { italic: true, color: { argb: "FF27AE60" } }
    noneCell.alignment = { horizontal: "center" }
    row++
  } else {
    // Sub-header
    const subHdr = ws.getRow(row)
    ;["#", "Improvement Description", "Accept/Reject", "Linguist Comment"].forEach((h, i) => {
      const cell = subHdr.getCell(i + 1)
      cell.value = h
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECF0F1" } }
      cell.font = { bold: true }
      cell.alignment = { horizontal: i === 0 ? "center" : "left", vertical: "middle" }
      applyBorder(cell)
    })
    ws.getRow(row).height = 20
    row++

    let itemNum = 1
    for (const finding of result.findings) {
      for (const err of finding.errors) {
        const bgColor = ERROR_TYPE_COLORS[err.type]
        const typeLabel = ERROR_TYPE_LABELS[err.type]
        const description = `[${typeLabel}] ID: ${finding.unitId}\n${err.description}\nSuggestion: ${err.suggestion}`

        const numCell = ws.getCell(`A${row}`)
        numCell.value = itemNum
        numCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${bgColor}` } }
        numCell.alignment = { horizontal: "center", vertical: "top" }
        applyBorder(numCell)

        const descCell = ws.getCell(`B${row}`)
        descCell.value = description
        descCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${bgColor}` } }
        descCell.alignment = { horizontal: "left", vertical: "top", wrapText: true }
        applyBorder(descCell)

        const acceptCell = ws.getCell(`C${row}`)
        acceptCell.value = ""
        acceptCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } }
        applyBorder(acceptCell)

        const noteCell = ws.getCell(`D${row}`)
        noteCell.value = ""
        noteCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } }
        applyBorder(noteCell)

        const estimatedLines = Math.ceil(description.length / 80) + 2
        ws.getRow(row).height = Math.max(40, estimatedLines * 15)
        row++
        itemNum++
      }
    }
  }

  row++

  // Footer
  ws.mergeCells(`A${row}:D${row}`)
  const footer = ws.getCell(`A${row}`)
  footer.value = `Generated by LQA Studio — ${meta.createdAt.toISOString().slice(0, 10)}`
  footer.font = { italic: true, size: 9, color: { argb: "FF7F8C8D" } }
  footer.alignment = { horizontal: "center" }
}

// ─── Sheet 2: Bilingual ───────────────────────────────────────────────────────

function buildBilingualSheet(
  ws: ExcelJS.Worksheet,
  meta: LqaReportMeta,
  units: Array<{ id: string; source: string; target: string }>,
  findings: LqaFinding[]
) {
  ws.columns = [
    { key: "id",     width: 28 },
    { key: "source", width: 60 },
    { key: "target", width: 60 },
    { key: "issues", width: 55 },
    { key: "notes",  width: 40 },
  ]

  // Header row
  const headers = [
    "Unit ID",
    `Source (${meta.sourceLanguage})`,
    `Translation (${meta.targetLanguage})`,
    "Issues Found",
    "Reviewer Notes",
  ]
  const hdrRow = ws.addRow(headers)
  hdrRow.eachCell((cell: ExcelJS.Cell, colNum: number) => {
    const bg = colNum <= 3 ? "1A5276" : colNum === 4 ? "6C3483" : "4A235A"
    applyHeaderStyle(cell, bg)
    applyBorder(cell)
  })
  hdrRow.height = 22
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1, activeCell: "A2" }]
  ws.autoFilter = { from: "A1", to: "E1" }

  // Build a lookup: unitId → findings
  const findingMap = new Map<string, LqaFinding>()
  for (const f of findings) findingMap.set(f.unitId, f)

  const altFillA = "EAF2FF"
  const altFillB = "FFFFFF"
  const issueFill = "FDFEFE"

  units.forEach((unit, idx) => {
    const finding = findingMap.get(unit.id)
    const bg = idx % 2 === 0 ? altFillA : altFillB
    const issueSummary = finding
      ? finding.errors.map((e) => `[${ERROR_TYPE_LABELS[e.type]}] ${e.description}`).join("\n")
      : ""

    const dataRow = ws.addRow([
      unit.id,
      unit.source,
      unit.target,
      issueSummary,
      "",
    ])

    dataRow.eachCell((cell: ExcelJS.Cell, colNum: number) => {
      const fillColor = colNum === 4 && issueSummary ? issueFill : bg
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${fillColor}` } }
      cell.alignment = { horizontal: "left", vertical: "top", wrapText: true }
      applyBorder(cell)

      if (colNum === 4 && issueSummary) {
        cell.font = { color: { argb: "FFC0392B" }, size: 10 }
      }
    })

    const maxLen = Math.max(unit.source.length, unit.target.length)
    dataRow.height = Math.max(18, Math.min(Math.ceil(maxLen / 60) + 1, 8) * 15)
  })
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function generateLqaExcel(
  meta: LqaReportMeta,
  result: LqaAnalysisResult,
  allUnits: Array<{ id: string; source: string; target: string }>
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = "LQA Studio"
  wb.created = meta.createdAt

  const summarySheet = wb.addWorksheet("LQA Summary")
  buildSummarySheet(summarySheet, meta, result)

  const bilingualSheet = wb.addWorksheet("Bilingual")
  buildBilingualSheet(bilingualSheet, meta, allUnits, result.findings)

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
