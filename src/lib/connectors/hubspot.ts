/**
 * HubSpot connector — blog posts via CMS API.
 *
 * Auth: Private app token (Bearer).
 * Docs: https://developers.hubspot.com/docs/api/cms/blog-post
 */

export interface ContentItem {
  id: string
  name: string
  state: string
  itemCount: number
}

const BASE = "https://api.hubapi.com"

function headers(apiToken: string): Record<string, string> {
  return { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ").trim()
}

export async function testConnection(apiToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE}/cms/v3/blogs/posts?limit=1`, {
      headers: headers(apiToken),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return { ok: true }
    if (res.status === 401 || res.status === 403) return { ok: false, error: "Invalid private app token" }
    return { ok: false, error: `HubSpot responded with ${res.status}` }
  } catch (err) {
    return { ok: false, error: `Connection failed: ${(err as Error).message}` }
  }
}

export async function listContent(apiToken: string): Promise<ContentItem[]> {
  const res = await fetch(`${BASE}/cms/v3/blogs/posts?limit=50&sort=-updatedAt`, {
    headers: headers(apiToken),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`HubSpot API error ${res.status}`)
  const data = await res.json() as { results: Array<{ id: string; name: string; state: string }> }
  return (data.results ?? []).map((p) => ({
    id: p.id,
    name: p.name || `Post ${p.id}`,
    state: (p.state ?? "").toLowerCase(),
    itemCount: 3,
  }))
}

export async function fetchContent(apiToken: string, postId: string): Promise<Record<string, string>> {
  const res = await fetch(`${BASE}/cms/v3/blogs/posts/${postId}`, {
    headers: headers(apiToken),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`HubSpot API error ${res.status}`)
  const data = await res.json() as { name: string; postBody: string; metaDescription: string }
  const result: Record<string, string> = {}
  if (data.name) result["name"] = data.name
  const body = stripHtml(data.postBody ?? "")
  if (body) result["postBody"] = body
  if (data.metaDescription) result["metaDescription"] = data.metaDescription
  return result
}

export async function pushTranslation(apiToken: string, targetLanguage: string, translations: Record<string, string>): Promise<void> {
  // Create a new draft blog post with translated content
  const res = await fetch(`${BASE}/cms/v3/blogs/posts`, {
    method: "POST",
    headers: headers(apiToken),
    body: JSON.stringify({
      name: translations["name"] ? `[${targetLanguage}] ${translations["name"]}` : `[${targetLanguage}] Translation`,
      postBody: translations["postBody"] ? `<p>${translations["postBody"]}</p>` : "",
      metaDescription: translations["metaDescription"] ?? "",
      state: "DRAFT",
      language: targetLanguage.split("-")[0].toLowerCase(),
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`HubSpot create post failed ${res.status}: ${msg.slice(0, 200)}`)
  }
}
