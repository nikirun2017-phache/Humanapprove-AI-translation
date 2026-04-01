import PDFDocument from "pdfkit"
import { existsSync } from "fs"

// Find a Unicode-capable TTF font (no TTC — pdfkit cannot subset collections).
function findFont(preferCjk: boolean): string | null {
  const cjkCandidates = [
    // Alpine Linux (after `apk add font-noto-cjk`)
    "/usr/share/fonts/noto-cjk/NotoSansCJKsc-Regular.otf",
    "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
    // macOS
    "/Library/Fonts/Arial Unicode.ttf",
    "/System/Library/Fonts/STHeiti Light.ttc",
  ]
  const latinCandidates = [
    // Alpine Linux (after `apk add font-noto`)
    "/usr/share/fonts/noto/NotoSans-Regular.ttf",
    "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    // macOS — TTF only, not TTC
    "/Library/Fonts/Arial Unicode.ttf",
    "/Library/Fonts/Arial.ttf",
  ]
  // For CJK, only search CJK candidates — do NOT fall back to Latin fonts.
  // pdfkit crashes trying to encode CJK codepoints with a Latin-only font.
  // If no CJK font is found, return null so pdfkit uses built-in Helvetica
  // which renders missing chars as boxes rather than throwing.
  const candidates = preferCjk ? cjkCandidates : latinCandidates
  // Skip TTC files - pdfkit cannot subset collections
  for (const p of candidates) {
    if (!p.endsWith(".ttc") && existsSync(p)) return p
  }
  return null
}

// Parse a simplified Markdown string and render it to a PDFDocument.
// Supports: # h1, ## h2, ### h3, - list items, blank lines between paragraphs.
function renderMarkdownToPdf(doc: PDFKit.PDFDocument, markdown: string): void {
  const lines = markdown.split(/\r?\n/)
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Headings
    const h1Match = line.match(/^#\s+(.+)$/)
    const h2Match = line.match(/^##\s+(.+)$/)
    const h3Match = line.match(/^###\s+(.+)$/)
    if (h1Match) {
      doc.moveDown(0.5).fontSize(16).text(h1Match[1].trim(), { lineGap: 2 })
      doc.moveDown(0.4)
      i++; continue
    }
    if (h2Match) {
      doc.moveDown(0.4).fontSize(13).text(h2Match[1].trim(), { lineGap: 2 })
      doc.moveDown(0.3)
      i++; continue
    }
    if (h3Match) {
      doc.moveDown(0.3).fontSize(11).text(h3Match[1].trim(), { lineGap: 2 })
      doc.moveDown(0.2)
      i++; continue
    }

    // List item
    const listMatch = line.match(/^(\s*[-*+]|\s*\d+\.)\s+(.+)$/)
    if (listMatch) {
      doc.fontSize(11).text(`• ${listMatch[2].trim()}`, {
        indent: 12,
        lineGap: 2,
        paragraphGap: 3,
      })
      i++; continue
    }

    // Blank line
    if (!line.trim()) {
      doc.moveDown(0.4)
      i++; continue
    }

    // Table row — render as plain text (simplified)
    if (line.startsWith("|")) {
      const cells = line.split("|").filter((c) => c.trim() && !c.match(/^[-\s]+$/))
      if (cells.length > 0) {
        doc.fontSize(10).text(cells.map((c) => c.trim()).join("   "), { lineGap: 2 })
      }
      i++; continue
    }

    // Regular paragraph (collect consecutive non-blank, non-special lines)
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].match(/^#{1,6}\s/) &&
      !lines[i].match(/^[-*+]\s/) &&
      !lines[i].startsWith("|")
    ) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length > 0) {
      doc.fontSize(11).text(paraLines.join(" ").trim(), { lineGap: 3, paragraphGap: 8 })
    }
  }
}

export function generateTranslatedPdf(
  paragraphs: string[],
  title: string,
  targetLanguage: string
): Promise<Buffer> {
  const isCjk = /^(zh|ja|ko)/.test(targetLanguage)
  const fontPath = findFont(isCjk)
  return buildPdf(fontPath, title, targetLanguage, (doc) => {
    doc.fontSize(11).fillColor("#111827")
    for (const para of paragraphs) {
      if (para.trim()) {
        doc.text(para, { lineGap: 3, paragraphGap: 8 })
      }
    }
  })
}

export function generatePdfFromMarkdown(
  markdown: string,
  title: string,
  targetLanguage: string
): Promise<Buffer> {
  const isCjk = /^(zh|ja|ko)/.test(targetLanguage)
  const fontPath = findFont(isCjk)
  return buildPdf(fontPath, title, targetLanguage, (doc) => {
    doc.fillColor("#111827")
    renderMarkdownToPdf(doc, markdown)
  })
}

function buildPdf(
  fontPath: string | null,
  title: string,
  targetLanguage: string,
  render: (doc: PDFKit.PDFDocument) => void
): Promise<Buffer> {
  return buildPdfWithFont(fontPath, title, targetLanguage, render)
    .catch(() => {
      // Font failed (e.g. OTF not supported by pdfkit) — retry with built-in Helvetica
      return buildPdfWithFont(null, title, targetLanguage, render)
    })
}

function buildPdfWithFont(
  fontPath: string | null,
  title: string,
  targetLanguage: string,
  render: (doc: PDFKit.PDFDocument) => void
): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 72, info: { Title: title } })
  const chunks: Buffer[] = []
  doc.on("data", (c: Buffer) => chunks.push(c))

  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

  try {
    if (fontPath) {
      doc.registerFont("body", fontPath)
      doc.font("body")
    } else {
      doc.font("Helvetica")
    }

    // Document header
    doc.fontSize(16).text(title, { align: "center" })
    doc.moveDown(0.4)
    doc.fontSize(9).fillColor("#6b7280").text(targetLanguage, { align: "center" })
    doc.moveDown(1.5)
    doc.moveTo(72, doc.y).lineTo(doc.page.width - 72, doc.y).strokeColor("#e5e7eb").stroke()
    doc.moveDown(1)

    render(doc)
  } finally {
    doc.end()
  }

  return finished
}

export function generateTranslatedTxt(
  paragraphs: string[],
  title: string,
  targetLanguage: string
): string {
  const header = `${title}\nLanguage: ${targetLanguage}\n${"─".repeat(40)}\n`
  return header + "\n" + paragraphs.filter((p) => p.trim()).join("\n\n")
}
