/**
 * Webflow connector — CMS collections via api.webflow.com/v2.
 *
 * Auth: Authorization: Bearer {apiToken}
 * Docs: https://developers.webflow.com/reference
 */

export interface WebflowSite {
  id: string
  displayName: string
  shortName: string
}

export interface WebflowCollection {
  id: string
  displayName: string
  singularName: string
  slug: string
}

export interface WebflowItem {
  id: string
  fieldData: Record<string, unknown>
  [key: string]: unknown
}

export interface ContentItem {
  id: string          // "collectionId:itemId" or just collectionId for the list view
  name: string
  state: string
  itemCount: number
}

const BASE = "https://api.webflow.com/v2"

function headers(apiToken: string) {
  return {
    Authorization: `Bearer ${apiToken}`,
    "Accept-Version": "1.0.0",
  }
}

export async function testConnection(apiToken: string): Promise<{ ok: boolean; error?: string; displayName?: string }> {
  // Try /token/introspect first (OAuth tokens); fall back to /sites (site API tokens)
  try {
    const introspect = await fetch(`${BASE}/token/introspect`, {
      headers: headers(apiToken),
      signal: AbortSignal.timeout(8_000),
    })
    if (introspect.ok) {
      const data = await introspect.json() as { authorization?: { user?: { data?: { email?: string } } } }
      return { ok: true, displayName: data?.authorization?.user?.data?.email }
    }
    // Fall through to /sites if introspect not supported for this token type
    if (introspect.status !== 404 && introspect.status !== 405) {
      if (introspect.status === 401 || introspect.status === 403)
        return { ok: false, error: "Invalid or unauthorized API token" }
      return { ok: false, error: `Webflow API responded with ${introspect.status}` }
    }
  } catch { /* fall through */ }

  // Fallback: /sites works for both OAuth and site API tokens
  try {
    const sitesRes = await fetch(`${BASE}/sites`, {
      headers: headers(apiToken),
      signal: AbortSignal.timeout(10_000),
    })
    if (sitesRes.ok) return { ok: true }
    if (sitesRes.status === 401 || sitesRes.status === 403)
      return { ok: false, error: "Invalid or unauthorized API token" }
    return { ok: false, error: `Webflow API responded with ${sitesRes.status}` }
  } catch (err) {
    return { ok: false, error: `Connection failed: ${(err as Error).message}` }
  }
}

export async function listSites(apiToken: string): Promise<WebflowSite[]> {
  const res = await fetch(`${BASE}/sites`, {
    headers: headers(apiToken),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Webflow API error ${res.status}`)
  const data = await res.json() as { sites: WebflowSite[] }
  return data.sites ?? []
}

export async function listCollections(apiToken: string, siteId: string): Promise<WebflowCollection[]> {
  const res = await fetch(`${BASE}/sites/${siteId}/collections`, {
    headers: headers(apiToken),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Webflow API error ${res.status}`)
  const data = await res.json() as { collections: WebflowCollection[] }
  return data.collections ?? []
}

export async function listPages(apiToken: string, siteId: string): Promise<Array<{ id: string; title: string; slug: string }>> {
  const res = await fetch(`${BASE}/sites/${siteId}/pages`, {
    headers: headers(apiToken),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) return []
  const data = await res.json() as { pages: Array<{ id: string; title: string; slug: string }> }
  return data.pages ?? []
}

export async function listLocales(apiToken: string, siteId: string): Promise<Array<{ id: string; tag: string; displayName: string }>> {
  const res = await fetch(`${BASE}/sites/${siteId}/locales`, {
    headers: headers(apiToken),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) return []
  const data = await res.json() as { locales: Array<{ id: string; tag: string; displayName: string }> }
  return data.locales ?? []
}

export async function listContent(apiToken: string, siteId: string): Promise<ContentItem[]> {
  const [collections, pages] = await Promise.all([
    listCollections(apiToken, siteId),
    listPages(apiToken, siteId),
  ])
  return [
    ...collections.map((c) => ({
      id: c.id,
      name: `📄 ${c.displayName}`,
      state: "collection",
      itemCount: 0,
    })),
    ...pages.map((p) => ({
      id: `page:${p.id}:${siteId}`,
      name: `🌐 ${p.title || p.slug}`,
      state: "page",
      itemCount: 1,
    })),
  ]
}

/** Fetch page content for translation using Webflow Pages Localization API */
export async function fetchPageContent(apiToken: string, siteId: string, pageId: string): Promise<Record<string, string>> {
  // GET /sites/{siteId}/pages/{pageId}/content — returns DOM nodes for the primary locale
  const res = await fetch(`${BASE}/sites/${siteId}/pages/${pageId}/content`, {
    headers: headers(apiToken),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Webflow pages content API error ${res.status}`)
  const data = await res.json() as {
    nodes?: Array<{ nodeId: string; type: string; text?: { text?: string } }>
  }
  const result: Record<string, string> = {}
  ;(data.nodes ?? []).forEach((node) => {
    if (node.text?.text?.trim()) {
      result[`node_${node.nodeId}`] = node.text.text.trim()
    }
  })
  return result
}

/** Push translated page content for a specific locale */
export async function pushPageLocale(
  apiToken: string, siteId: string, pageId: string,
  localeId: string, translations: Record<string, string>
): Promise<void> {
  // Build nodes array from our translation map
  const nodes = Object.entries(translations).map(([key, text]) => {
    const nodeId = key.replace(/^node_/, "")
    return { nodeId, text: { text } }
  })
  const res = await fetch(`${BASE}/sites/${siteId}/pages/${pageId}/content?localeId=${localeId}`, {
    method: "POST",
    headers: { ...headers(apiToken), "Content-Type": "application/json" },
    body: JSON.stringify({ nodes }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Webflow page locale push failed ${res.status}: ${err.slice(0, 200)}`)
  }
}

export async function fetchCollectionItems(apiToken: string, collectionId: string): Promise<WebflowItem[]> {
  const res = await fetch(`${BASE}/collections/${collectionId}/items?limit=100`, {
    headers: headers(apiToken),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Webflow API error ${res.status}`)
  const data = await res.json() as { items: WebflowItem[] }
  return data.items ?? []
}

/** Extract translatable text fields from a collection's items → flat JSON record */
export function itemsToJson(items: WebflowItem[]): Record<string, string> {
  const result: Record<string, string> = {}
  const STRING_FIELDS = new Set(["name", "slug", "description", "body", "summary", "title", "excerpt", "content"])

  items.forEach((item) => {
    const data = item.fieldData ?? {}
    Object.entries(data).forEach(([key, val]) => {
      if (typeof val !== "string" || !val.trim()) return
      if (STRING_FIELDS.has(key) || key.startsWith("text") || key.startsWith("content")) {
        const safeKey = `item_${item.id}_${key}`.replace(/[^a-zA-Z0-9_]/g, "_")
        result[safeKey] = val.trim()
      }
    })
  })
  return result
}

/** Patch a single CMS item with translated field values */
export async function patchItem(apiToken: string, collectionId: string, itemId: string, fields: Record<string, string>): Promise<void> {
  const res = await fetch(`${BASE}/collections/${collectionId}/items/${itemId}`, {
    method: "PATCH",
    headers: { ...headers(apiToken), "Content-Type": "application/json" },
    body: JSON.stringify({ fieldData: fields }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Webflow patch failed ${res.status}: ${err.slice(0, 200)}`)
  }
}
