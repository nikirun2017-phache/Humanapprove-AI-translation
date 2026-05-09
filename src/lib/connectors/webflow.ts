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
  try {
    const res = await fetch(`${BASE}/token/introspect`, {
      headers: headers(apiToken),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) {
      const data = await res.json() as { authorization?: { user?: { data?: { email?: string } } } }
      const email = data?.authorization?.user?.data?.email
      return { ok: true, displayName: email }
    }
    if (res.status === 401 || res.status === 403) return { ok: false, error: "Invalid or unauthorized API token" }
    return { ok: false, error: `Webflow API responded with ${res.status}` }
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

export async function listContent(apiToken: string, siteId: string): Promise<ContentItem[]> {
  const collections = await listCollections(apiToken, siteId)
  return collections.map((c) => ({
    id: c.id,
    name: c.displayName,
    state: "collection",
    itemCount: 0, // item count would require an extra request per collection
  }))
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
