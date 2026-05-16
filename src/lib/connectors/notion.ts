/**
 * Notion connector — pages via Notion API v1.
 *
 * Auth: Authorization: Bearer {token} + Notion-Version header.
 * Docs: https://developers.notion.com/docs/getting-started
 */

export interface ContentItem {
  id: string
  name: string
  state: string
  itemCount: number
}

// Notion rich text object (simplified)
interface NotionRichText {
  type: "text" | "mention" | "equation"
  plain_text: string
  text?: { content: string; link?: { url: string } | null }
}

interface NotionTitleProperty {
  title: NotionRichText[]
}

interface NotionRichTextProperty {
  rich_text: NotionRichText[]
}

type NotionProperty = NotionTitleProperty | NotionRichTextProperty | Record<string, unknown>

interface NotionPage {
  id: string
  object: "page"
  properties: Record<string, NotionProperty>
}

interface NotionBlock {
  id: string
  type: string
  paragraph?: { rich_text: NotionRichText[] }
  heading_1?: { rich_text: NotionRichText[] }
  heading_2?: { rich_text: NotionRichText[] }
  heading_3?: { rich_text: NotionRichText[] }
  bulleted_list_item?: { rich_text: NotionRichText[] }
  numbered_list_item?: { rich_text: NotionRichText[] }
  quote?: { rich_text: NotionRichText[] }
  callout?: { rich_text: NotionRichText[] }
}

interface NotionUser {
  name: string
  type: string
  bot?: Record<string, unknown>
  person?: { email: string }
}

const NOTION_VERSION = "2022-06-28"

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  }
}

function extractPlainText(richText: NotionRichText[]): string {
  if (!Array.isArray(richText)) return ""
  return richText.map((rt) => rt.plain_text ?? "").join("").trim()
}

function getPageTitle(page: NotionPage): string {
  // Check common title property names
  for (const key of ["title", "Title", "Name", "name"]) {
    const prop = page.properties[key] as NotionProperty | undefined
    if (!prop) continue
    if ("title" in prop && Array.isArray((prop as NotionTitleProperty).title)) {
      const text = extractPlainText((prop as NotionTitleProperty).title)
      if (text) return text
    }
    if ("rich_text" in prop && Array.isArray((prop as NotionRichTextProperty).rich_text)) {
      const text = extractPlainText((prop as NotionRichTextProperty).rich_text)
      if (text) return text
    }
  }
  // Fallback: find first property that has a title array
  for (const prop of Object.values(page.properties)) {
    if (prop && "title" in prop && Array.isArray((prop as NotionTitleProperty).title)) {
      const text = extractPlainText((prop as NotionTitleProperty).title)
      if (text) return text
    }
  }
  return `Page ${page.id.slice(0, 8)}`
}

/** Extract text from a block's rich_text array based on block type */
function getBlockText(block: NotionBlock): string | null {
  const richText =
    block.paragraph?.rich_text ??
    block.heading_1?.rich_text ??
    block.heading_2?.rich_text ??
    block.heading_3?.rich_text ??
    block.bulleted_list_item?.rich_text ??
    block.numbered_list_item?.rich_text ??
    block.quote?.rich_text ??
    block.callout?.rich_text ??
    null

  if (!richText) return null
  const text = extractPlainText(richText)
  return text || null
}

const SUPPORTED_BLOCK_TYPES = new Set([
  "paragraph",
  "heading_1",
  "heading_2",
  "heading_3",
  "bulleted_list_item",
  "numbered_list_item",
  "quote",
  "callout",
])

export async function testConnection(
  token: string
): Promise<{ ok: boolean; displayName?: string; error?: string }> {
  try {
    const res = await fetch("https://api.notion.com/v1/users/me", {
      headers: headers(token),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      if (res.status === 401) return { ok: false, error: "Invalid or expired Notion integration token" }
      return { ok: false, error: `Notion responded with ${res.status}` }
    }
    const data = await res.json() as NotionUser
    return { ok: true, displayName: data.name }
  } catch (err) {
    return { ok: false, error: `Connection failed: ${(err as Error).message}` }
  }
}

export async function listContent(token: string): Promise<ContentItem[]> {
  const res = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      filter: { object: "page" },
      page_size: 50,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    throw new Error(`Notion search failed with status ${res.status}`)
  }
  const data = await res.json() as { results: NotionPage[] }
  return data.results
    .filter((obj): obj is NotionPage => obj.object === "page")
    .map((page) => ({
      id: page.id,
      name: getPageTitle(page),
      state: "page",
      itemCount: 1,
    }))
}

export async function fetchContent(
  token: string,
  pageId: string
): Promise<Record<string, string>> {
  const res = await fetch(
    `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`,
    {
      headers: headers(token),
      signal: AbortSignal.timeout(15_000),
    }
  )
  if (!res.ok) {
    throw new Error(`Notion blocks fetch failed with status ${res.status}`)
  }
  const data = await res.json() as { results: NotionBlock[] }
  const result: Record<string, string> = {}

  for (const block of data.results) {
    if (!SUPPORTED_BLOCK_TYPES.has(block.type)) continue
    const text = getBlockText(block)
    if (!text) continue
    const key = `block_${block.id}_${block.type}`
    result[key] = text
  }

  return result
}

export async function pushTranslation(
  token: string,
  pageId: string,
  locale: string,
  translations: Record<string, string>
): Promise<void> {
  const h = headers(token)
  const errors: string[] = []

  for (const [key, translatedText] of Object.entries(translations)) {
    // Key format: "block_{blockId}_{type}"
    const match = key.match(/^block_([^_]+(?:-[^_]+)*)_([a-z_0-9]+)$/)
    if (!match) continue

    const blockId = match[1]
    const blockType = match[2] as
      | "paragraph"
      | "heading_1"
      | "heading_2"
      | "heading_3"
      | "bulleted_list_item"
      | "numbered_list_item"
      | "quote"
      | "callout"

    if (!SUPPORTED_BLOCK_TYPES.has(blockType)) continue

    const richText = [{ type: "text", text: { content: translatedText } }]

    const patchBody: Record<string, unknown> = {
      [blockType]: { rich_text: richText },
    }

    const res = await fetch(`https://api.notion.com/v1/blocks/${blockId}`, {
      method: "PATCH",
      headers: h,
      body: JSON.stringify(patchBody),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const msg = await res.text()
      errors.push(`Block ${blockId} (${blockType}): ${res.status} ${msg.slice(0, 100)}`)
    }
  }

  if (errors.length > 0) {
    throw new Error(`Notion push had ${errors.length} error(s): ${errors.slice(0, 3).join("; ")}`)
  }

  // Suppress unused variable warning — locale is part of the public API signature
  void locale
}
