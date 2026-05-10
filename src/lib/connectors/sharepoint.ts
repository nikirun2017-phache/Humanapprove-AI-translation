/**
 * SharePoint connector — site pages via Microsoft Graph.
 *
 * Auth: Microsoft Graph OAuth access token (obtain from Azure portal or Graph Explorer).
 * Docs: https://learn.microsoft.com/en-us/graph/api/resources/sharepoint
 */

export interface ContentItem {
  id: string
  name: string
  state: string
  itemCount: number
}

const GRAPH = "https://graph.microsoft.com/v1.0"

function headers(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
}

/** Convert SharePoint site URL to a Graph-compatible site ID */
async function resolveSiteId(accessToken: string, siteUrl: string): Promise<string> {
  const url = new URL(siteUrl)
  const hostname = url.hostname
  const path = url.pathname.replace(/^\//, "")
  const res = await fetch(`${GRAPH}/sites/${hostname}:/${path}`, {
    headers: headers(accessToken),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Could not resolve SharePoint site: ${res.status}`)
  const data = await res.json() as { id: string }
  return data.id
}

export async function testConnection(siteUrl: string, accessToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const siteId = await resolveSiteId(accessToken, siteUrl)
    const res = await fetch(`${GRAPH}/sites/${siteId}`, {
      headers: headers(accessToken),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return { ok: true }
    if (res.status === 401) return { ok: false, error: "Invalid or expired access token" }
    if (res.status === 403) return { ok: false, error: "Access denied — check token permissions" }
    return { ok: false, error: `Graph API responded with ${res.status}` }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

export async function listContent(siteUrl: string, accessToken: string): Promise<ContentItem[]> {
  const siteId = await resolveSiteId(accessToken, siteUrl)
  const res = await fetch(`${GRAPH}/sites/${siteId}/pages`, {
    headers: headers(accessToken),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Graph API error ${res.status}`)
  const data = await res.json() as { value: Array<{ id: string; name: string; title: string; webUrl: string }> }
  return (data.value ?? []).map((page) => ({
    id: `${siteId}::${page.id}`,
    name: page.title || page.name || page.id,
    state: "page",
    itemCount: 1,
  }))
}

export async function fetchContent(accessToken: string, contentId: string): Promise<Record<string, string>> {
  const [siteId, pageId] = contentId.split("::")
  const res = await fetch(`${GRAPH}/sites/${siteId}/pages/${pageId}/microsoft.graph.sitePage?$expand=canvasLayout`, {
    headers: headers(accessToken),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Graph API error ${res.status}`)
  const data = await res.json() as {
    title: string
    description?: string
    canvasLayout?: { horizontalSections: Array<{ columns: Array<{ webparts: Array<{ data?: { innerHtml?: string } }> }> }> }
  }
  const result: Record<string, string> = {}
  if (data.title) result["title"] = data.title
  if (data.description) result["description"] = data.description
  // Extract text from canvas web parts
  let sectionIndex = 0
  data.canvasLayout?.horizontalSections?.forEach((section) => {
    section.columns?.forEach((col) => {
      col.webparts?.forEach((wp) => {
        const html = wp.data?.innerHtml ?? ""
        if (html) {
          const plain = html.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim()
          if (plain) result[`section_${++sectionIndex}`] = plain
        }
      })
    })
  })
  return result
}

export async function pushTranslation(
  accessToken: string, contentId: string, targetLanguage: string, translations: Record<string, string>
): Promise<void> {
  const [siteId, pageId] = contentId.split("::")
  // Update page title and description
  const body: Record<string, unknown> = {}
  if (translations["title"]) body["title"] = `[${targetLanguage}] ${translations["title"]}`
  if (translations["description"]) body["description"] = translations["description"]

  const res = await fetch(`${GRAPH}/sites/${siteId}/pages/${pageId}`, {
    method: "PATCH",
    headers: headers(accessToken),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`SharePoint update failed ${res.status}: ${msg.slice(0, 200)}`)
  }
}
