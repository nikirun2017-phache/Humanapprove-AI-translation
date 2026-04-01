import { existsSync } from "fs"

const IMAGE_PLACEHOLDER = "__IMAGE_PLACEHOLDER__"

function findChromium(): string {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/usr/bin/chromium-browser",  // Alpine (apk add chromium)
    "/usr/bin/chromium",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
  ].filter(Boolean) as string[]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  throw new Error(
    "Chromium not found. Install chromium or set PUPPETEER_EXECUTABLE_PATH."
  )
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Convert a simplified Markdown string to HTML.
 * Handles: # headings, - lists, | tables, __IMAGE_PLACEHOLDER__ markers.
 */
function markdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  let html = ""
  let inList = false

  for (const line of lines) {
    const h3 = line.match(/^### (.+)$/)
    const h2 = line.match(/^## (.+)$/)
    const h1 = line.match(/^# (.+)$/)
    const li = line.match(/^(?:[-*+]|\d+\.)\s+(.+)$/)

    if (h3) {
      if (inList) { html += "</ul>\n"; inList = false }
      html += `<h3>${escapeHtml(h3[1].trim())}</h3>\n`
    } else if (h2) {
      if (inList) { html += "</ul>\n"; inList = false }
      html += `<h2>${escapeHtml(h2[1].trim())}</h2>\n`
    } else if (h1) {
      if (inList) { html += "</ul>\n"; inList = false }
      html += `<h1>${escapeHtml(h1[1].trim())}</h1>\n`
    } else if (li) {
      if (!inList) { html += "<ul>\n"; inList = true }
      html += `<li>${escapeHtml(li[1].trim())}</li>\n`
    } else if (line.startsWith("|")) {
      if (inList) { html += "</ul>\n"; inList = false }
      const cells = line.split("|").filter((c) => c.trim() && !c.match(/^[-\s]+$/))
      if (cells.length > 0) {
        html += `<p class="table-row">${cells.map((c) => escapeHtml(c.trim())).join(" &nbsp;·&nbsp; ")}</p>\n`
      }
    } else if (line.trim() === IMAGE_PLACEHOLDER) {
      if (inList) { html += "</ul>\n"; inList = false }
      html += `<div class="img-placeholder">📷 Image</div>\n`
    } else if (!line.trim()) {
      if (inList) { html += "</ul>\n"; inList = false }
    } else {
      if (inList) { html += "</ul>\n"; inList = false }
      html += `<p>${escapeHtml(line.trim())}</p>\n`
    }
  }
  if (inList) html += "</ul>\n"
  return html
}

function buildHtml(bodyHtml: string, title: string, targetLanguage: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: system-ui, -apple-system, "Noto Sans", "Noto Sans CJK SC",
               "Noto Sans CJK TC", "Noto Sans CJK JP", "Noto Sans CJK KR",
               Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.65;
  color: #111827;
}
.page { padding: 72px; }
.doc-header {
  text-align: center;
  margin-bottom: 28px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}
.doc-title { font-size: 16pt; font-weight: 600; margin-bottom: 4px; }
.doc-lang  { font-size: 9pt; color: #6b7280; }
p  { margin-bottom: 10px; }
h1 { font-size: 14pt; font-weight: 600; margin: 20px 0 8px; }
h2 { font-size: 13pt; font-weight: 600; margin: 16px 0 6px; }
h3 { font-size: 11pt; font-weight: 600; margin: 12px 0 4px; }
ul { margin: 4px 0 10px 0; padding-left: 20px; }
li { margin-bottom: 3px; }
.table-row { font-size: 10pt; margin-bottom: 4px; color: #374151; }
.img-placeholder {
  background: #f9fafb;
  border: 1.5px dashed #d1d5db;
  border-radius: 6px;
  padding: 22px 16px;
  text-align: center;
  color: #9ca3af;
  font-size: 10pt;
  margin: 14px 0;
}
</style>
</head>
<body>
<div class="page">
  <div class="doc-header">
    <div class="doc-title">${escapeHtml(title)}</div>
    <div class="doc-lang">${escapeHtml(targetLanguage)}</div>
  </div>
  ${bodyHtml}
</div>
</body>
</html>`
}

async function renderHtmlToPdf(html: string): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const puppeteer = require("puppeteer-core") as typeof import("puppeteer-core")
  const executablePath = findChromium()

  const browser = await puppeteer.launch({
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
    ],
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30_000 })
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      // Padding is handled inside the HTML template
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

/**
 * Generate a translated PDF from a list of paragraphs.
 * Paragraphs equal to "__IMAGE_PLACEHOLDER__" are rendered as gray image boxes.
 */
export async function generateTranslatedPdf(
  paragraphs: string[],
  title: string,
  targetLanguage: string
): Promise<Buffer> {
  const bodyHtml = paragraphs
    .filter((p) => p.trim())
    .map((p) =>
      p === IMAGE_PLACEHOLDER
        ? `<div class="img-placeholder">📷 Image</div>`
        : `<p>${escapeHtml(p)}</p>`
    )
    .join("\n")

  return renderHtmlToPdf(buildHtml(bodyHtml, title, targetLanguage))
}

/**
 * Generate a translated PDF from a Markdown string (Claude Vision output).
 * Handles headings, lists, tables, and __IMAGE_PLACEHOLDER__ markers.
 */
export async function generatePdfFromMarkdown(
  markdown: string,
  title: string,
  targetLanguage: string
): Promise<Buffer> {
  return renderHtmlToPdf(buildHtml(markdownToHtml(markdown), title, targetLanguage))
}

/**
 * Generate a plain-text version of the translated content.
 * Image placeholders are omitted from the .txt output.
 */
export function generateTranslatedTxt(
  paragraphs: string[],
  title: string,
  targetLanguage: string
): string {
  const header = `${title}\nLanguage: ${targetLanguage}\n${"─".repeat(40)}\n`
  return (
    header +
    "\n" +
    paragraphs
      .filter((p) => p.trim() && p !== IMAGE_PLACEHOLDER)
      .join("\n\n")
  )
}
