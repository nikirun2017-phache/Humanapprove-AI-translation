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
    // Fall through to /sites if introspect not supported for this token type.
    // 5xx means the endpoint errored (site tokens return 500 here) — not an auth failure.
    if (introspect.status < 500 && introspect.status !== 404 && introspect.status !== 405) {
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

export async function listLocales(apiToken: string, siteId: string): Promise<Array<{ id: string; tag: string; displayName: string; isPrimary?: boolean }>> {
  // Try the dedicated locales endpoint first (requires Localization add-on; 404s on Starter plan).
  const res = await fetch(`${BASE}/sites/${siteId}/locales`, {
    headers: headers(apiToken),
    signal: AbortSignal.timeout(10_000),
  })
  if (res.ok) {
    const data = await res.json() as {
      locales?: Array<{ id: string; tag: string; displayName: string }>
      primary?: { id: string; tag: string; displayName: string }
    }
    const secondary = (data.locales ?? []).map(l => ({ ...l, isPrimary: false }))
    const primary = data.primary ? [{ ...data.primary, isPrimary: true }] : []
    return [...secondary, ...primary]
  }

  // Fallback: GET /sites/{siteId} always works on all plans including Starter.
  // The site object includes locales.primary which contains the primary locale ID
  // needed to push translated content via POST /pages/{pageId}/dom?localeId=...
  try {
    const siteRes = await fetch(`${BASE}/sites/${siteId}`, {
      headers: headers(apiToken),
      signal: AbortSignal.timeout(10_000),
    })
    if (siteRes.ok) {
      const site = await siteRes.json() as {
        locales?: {
          primary?: { id: string; cmsLocaleId?: string; tag: string; displayName?: string }
          secondary?: Array<{ id: string; cmsLocaleId?: string; tag: string; displayName?: string }>
        }
      }
      const primary = site.locales?.primary
      const secondary = site.locales?.secondary ?? []
      const result: Array<{ id: string; cmsLocaleId?: string; tag: string; displayName: string; isPrimary?: boolean }> = []
      if (primary) {
        result.push({
          id: primary.id,
          cmsLocaleId: primary.cmsLocaleId,
          tag: primary.tag,
          displayName: primary.displayName ?? primary.tag,
          isPrimary: true,
        })
      }
      result.push(...secondary.map(l => ({
        id: l.id,
        cmsLocaleId: l.cmsLocaleId,
        tag: l.tag,
        displayName: l.displayName ?? l.tag,
        isPrimary: false as const,
      })))
      return result
    }
  } catch { /* fall through */ }

  return []
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

/** Fetch page content for translation using Webflow Pages DOM API */
export async function fetchPageContent(apiToken: string, _siteId: string, pageId: string): Promise<Record<string, string>> {
  // GET /pages/{pageId}/dom — returns DOM nodes; text.text has the plain-text value
  const res = await fetch(`${BASE}/pages/${pageId}/dom`, {
    headers: headers(apiToken),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Webflow DOM API error ${res.status}`)
  const data = await res.json() as {
    nodes?: Array<{ id: string; type: string; text?: { text?: string | null } }>
  }
  const result: Record<string, string> = {}
  ;(data.nodes ?? []).forEach((node) => {
    const txt = node.text?.text
    if (txt && txt.trim()) {
      result[`node_${node.id}`] = txt.trim()
    }
  })
  return result
}

/**
 * Push translated page content back to Webflow Pages DOM API.
 *
 * Webflow requires EXACTLY ONE of:
 *   ?localeId={id}  — locale ID from GET /sites/{siteId}/locales (preferred)
 *   ?locale={tag}   — locale tag, e.g. "zh-CN" (fallback when no ID available)
 *
 * Both primary and secondary locales require one of these parameters.
 *
 * Per Webflow API spec, each node in the request body must have:
 *   { nodeId: string, text: string }   ← text is a plain string, NOT { text: string }
 */
export async function pushPageLocale(
  apiToken: string, _siteId: string, pageId: string,
  localeId: string | null, translations: Record<string, string>,
  localeTag?: string   // fallback: used when localeId is unavailable
): Promise<void> {
  const nodes = Object.entries(translations).map(([key, text]) => ({
    nodeId: key.replace(/^node_/, ""),
    text,
  }))

  let url: string
  if (localeId) {
    url = `${BASE}/pages/${pageId}/dom?localeId=${encodeURIComponent(localeId)}`
  } else if (localeTag) {
    url = `${BASE}/pages/${pageId}/dom?locale=${encodeURIComponent(localeTag)}`
  } else {
    url = `${BASE}/pages/${pageId}/dom`
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { ...headers(apiToken), "Content-Type": "application/json" },
    body: JSON.stringify({ nodes }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const errText = await res.text()
    let detail = errText.slice(0, 400)
    try {
      const parsed = JSON.parse(errText) as {
        message?: string
        msg?: string
        err?: string
        code?: string | number
        errors?: string[]
        details?: Array<{ message?: string } | string>
      }
      if (parsed.message) detail = parsed.message
      else if (parsed.msg) detail = parsed.msg
      else if (parsed.err) detail = parsed.err
      else if (parsed.errors?.length) detail = parsed.errors.join("; ")
      else if (parsed.details?.length) {
        detail = parsed.details
          .map(d => (typeof d === "string" ? d : d.message ?? ""))
          .filter(Boolean)
          .join("; ")
      }
    } catch { /* keep raw text */ }
    console.error(`[Webflow] pushPageLocale failed — HTTP ${res.status} for page=${pageId} localeId=${localeId ?? "none"} localeTag=${localeTag ?? "none"}: ${detail}`)
    throw new Error(`Webflow push failed (HTTP ${res.status}): ${detail}`)
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
    console.error(`[Webflow] patchItem failed — HTTP ${res.status} collection=${collectionId} item=${itemId}: ${err.slice(0, 300)}`)
    throw new Error(`Webflow patch failed (HTTP ${res.status}): ${err.slice(0, 200)}`)
  }
}
