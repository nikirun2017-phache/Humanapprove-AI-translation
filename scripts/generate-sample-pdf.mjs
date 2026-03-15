/**
 * Generates a sample PDF with realistic translatable content.
 * Uses raw PDF 1.4 syntax — no external dependencies required.
 * Output: uploads/sample-source.pdf
 */

import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, "../uploads/sample-source.pdf")

// ---------------------------------------------------------------------------
// Content: a fictional SaaS product — "Horizon" project management app
// Two pages, realistic UI copy, headings, paragraphs, bullet lists
// ---------------------------------------------------------------------------

const pages = [
  {
    title: "Welcome to Horizon",
    lines: [
      "Horizon is a modern project management platform designed for",
      "distributed teams. Whether you are managing a startup or a global",
      "enterprise, Horizon gives you the tools to plan, track, and deliver",
      "work on time.",
      "",
      "Key Features",
      "",
      "  - Smart task boards with drag-and-drop prioritisation",
      "  - Real-time collaboration and live cursors",
      "  - Automated progress reports sent to your inbox",
      "  - Native integrations with Slack, GitHub, and Jira",
      "  - Enterprise-grade security with SOC 2 Type II certification",
      "",
      "Getting Started",
      "",
      "Create your first workspace by clicking the New Workspace button",
      "in the top navigation bar. You can invite team members immediately",
      "after setup. No credit card is required for the free trial.",
    ],
  },
  {
    title: "Plans and Pricing",
    lines: [
      "Horizon offers three subscription tiers to fit teams of all sizes.",
      "",
      "Free Plan",
      "",
      "  - Up to 5 users",
      "  - 3 active projects",
      "  - 1 GB file storage",
      "  - Community support",
      "",
      "Pro Plan  -  $12 per user per month",
      "",
      "  - Unlimited users and projects",
      "  - 100 GB file storage",
      "  - Priority email support",
      "  - Advanced analytics dashboard",
      "  - Custom fields and automations",
      "",
      "Enterprise Plan  -  Custom pricing",
      "",
      "  - Everything in Pro",
      "  - Dedicated success manager",
      "  - SLA guarantee with 99.9% uptime",
      "  - Single sign-on and SCIM provisioning",
      "  - On-premise deployment option",
      "",
      "Contact our sales team at sales@horizon.app for a personalised quote.",
    ],
  },
]

// ---------------------------------------------------------------------------
// PDF builder
// ---------------------------------------------------------------------------

function encodeText(str) {
  // Escape PDF special characters in parentheses strings
  return str
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
}

function buildPdf(pages) {
  const objects = []
  const offsets = []

  function addObj(content) {
    const id = objects.length + 1
    objects.push({ id, content })
    return id
  }

  // Build page streams first so we know lengths
  const pageStreams = pages.map((page) => {
    const margin = 50
    const lineHeight = 16
    const titleSize = 16
    const bodySize = 11
    let y = 742

    const ops = []

    // Title
    ops.push(`BT`)
    ops.push(`/F1 ${titleSize} Tf`)
    ops.push(`${margin} ${y} Td`)
    ops.push(`(${encodeText(page.title)}) Tj`)
    ops.push(`ET`)
    y -= titleSize + 10

    // Underline rule
    ops.push(`${margin} ${y + 4} m ${612 - margin} ${y + 4} l S`)
    y -= 8

    // Body lines
    ops.push(`BT`)
    ops.push(`/F1 ${bodySize} Tf`)
    for (const line of page.lines) {
      if (line === "") {
        y -= lineHeight * 0.6
        continue
      }
      // Check if it's a section heading (no leading spaces, ends with a letter or digit)
      const isHeading = !line.startsWith(" ") && !line.startsWith("-") &&
        line.trim().length > 0 && page.lines.indexOf(line) !== 0
      if (isHeading && !line.startsWith("  -") && page.lines[page.lines.indexOf(line) - 1] === "") {
        ops.push(`ET`)
        ops.push(`BT`)
        ops.push(`/F1 ${bodySize + 2} Tf`)
        ops.push(`${margin} ${y} Td`)
        ops.push(`(${encodeText(line.trim())}) Tj`)
        ops.push(`ET`)
        ops.push(`BT`)
        ops.push(`/F1 ${bodySize} Tf`)
        y -= lineHeight * 1.2
        continue
      }
      ops.push(`${margin} ${y} Td`)
      ops.push(`(${encodeText(line.trimEnd())}) Tj`)
      ops.push(`0 0 Td`) // reset relative position for next Td
      y -= lineHeight
    }
    ops.push(`ET`)

    return ops.join("\n")
  })

  // Catalog and Pages placeholders — IDs assigned after we know page IDs
  const catalogId = addObj(null)    // 1
  const pagesRootId = addObj(null)  // 2

  // Font
  const fontId = addObj(
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`
  )

  // Page content streams + page objects
  const pageIds = pageStreams.map((stream) => {
    const streamBytes = Buffer.from(stream, "latin1")
    const contentId = addObj(
      `<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`
    )
    const pageId = addObj(
      `<< /Type /Page /Parent ${pagesRootId} 0 R ` +
      `/MediaBox [0 0 612 792] ` +
      `/Contents ${contentId} 0 R ` +
      `/Resources << /Font << /F1 ${fontId} 0 R >> >> >>`
    )
    return pageId
  })

  // Patch catalog and pages root
  objects[catalogId - 1].content = `<< /Type /Catalog /Pages ${pagesRootId} 0 R >>`
  objects[pagesRootId - 1].content =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`

  // Serialize
  const parts = ["%PDF-1.4\n"]

  for (const obj of objects) {
    offsets.push(parts.join("").length)
    parts.push(`${obj.id} 0 obj\n${obj.content}\nendobj\n`)
  }

  const xrefOffset = parts.join("").length
  const body = parts.join("")

  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f \n" + offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n `).join("\n"),
  ].join("\n")

  const trailer = [
    "trailer",
    `<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>`,
    "startxref",
    xrefOffset + body.length,
    "%%EOF",
  ].join("\n")

  return body + xref + "\n" + trailer + "\n"
}

const pdf = buildPdf(pages)
mkdirSync(join(__dirname, "../uploads"), { recursive: true })
writeFileSync(outPath, pdf, "binary")
console.log(`✓ Written: ${outPath}`)
console.log(`  Size: ${(pdf.length / 1024).toFixed(1)} KB`)
console.log(`  Pages: ${pages.length}`)
