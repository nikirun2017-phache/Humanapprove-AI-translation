/**
 * WordPress connector — posts and pages via WP REST API.
 *
 * Auth: Application passwords (WP 5.6+) with Basic auth.
 * Docs: https://developer.wordpress.org/rest-api/
 */

export interface ContentItem {
  id: string
  name: string
  state: string
  itemCount: number
}

function base(siteUrl: string) {
  return siteUrl.replace(/\/$/, "") + "/wp-json/wp/v2"
}

function headers(username: string, applicationPassword: string): Record<string, string> {
  const encoded = Buffer.from(`${username}:${applicationPassword}`).toString("base64")
  return { Authorization: `Basic ${encoded}`, "Content-Type": "application/json" }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ").trim()
}

export async function testConnection(siteUrl: string, username: string, applicationPassword: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${base(siteUrl)}/users/me`, {
      headers: headers(username, applicationPassword),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return { ok: true }
    if (res.status === 401 || res.status === 403) return { ok: false, error: "Invalid username or application password" }
    return { ok: false, error: `WordPress responded with ${res.status}` }
  } catch (err) {
    return { ok: false, error: `Connection failed: ${(err as Error).message}` }
  }
}

export async function listContent(siteUrl: string, username: string, applicationPassword: string): Promise<ContentItem[]> {
  const h = headers(username, applicationPassword)
  const [postsRes, pagesRes] = await Promise.all([
    fetch(`${base(siteUrl)}/posts?per_page=30&orderby=modified&order=desc&_fields=id,title,status`, { headers: h, signal: AbortSignal.timeout(15_000) }),
    fetch(`${base(siteUrl)}/pages?per_page=20&orderby=modified&order=desc&_fields=id,title,status`, { headers: h, signal: AbortSignal.timeout(15_000) }),
  ])
  const posts = postsRes.ok ? await postsRes.json() as Array<{ id: number; title: { rendered: string }; status: string }> : []
  const pages = pagesRes.ok ? await pagesRes.json() as Array<{ id: number; title: { rendered: string }; status: string }> : []
  return [
    ...posts.map((p) => ({ id: `post:${p.id}`, name: stripHtml(p.title?.rendered ?? "") || `Post ${p.id}`, state: p.status, itemCount: 2 })),
    ...pages.map((p) => ({ id: `page:${p.id}`, name: stripHtml(p.title?.rendered ?? "") || `Page ${p.id}`, state: p.status, itemCount: 2 })),
  ]
}

export async function fetchContent(siteUrl: string, username: string, applicationPassword: string, contentId: string): Promise<Record<string, string>> {
  const [type, id] = contentId.split(":")
  const endpoint = type === "page" ? "pages" : "posts"
  const res = await fetch(`${base(siteUrl)}/${endpoint}/${id}`, {
    headers: headers(username, applicationPassword),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`WordPress API error ${res.status}`)
  const data = await res.json() as { title: { rendered: string }; content: { rendered: string }; excerpt: { rendered: string } }
  const result: Record<string, string> = {}
  const title = stripHtml(data.title?.rendered ?? "")
  const content = stripHtml(data.content?.rendered ?? "")
  const excerpt = stripHtml(data.excerpt?.rendered ?? "")
  if (title) result["title"] = title
  if (content) result["content"] = content
  if (excerpt) result["excerpt"] = excerpt
  return result
}

export async function pushTranslation(
  siteUrl: string, username: string, applicationPassword: string,
  contentId: string, targetLanguage: string, translations: Record<string, string>
): Promise<void> {
  // Create a translated draft post/page
  const [type] = contentId.split(":")
  const endpoint = type === "page" ? "pages" : "posts"
  const title = translations["title"] ? `[${targetLanguage}] ${translations["title"]}` : `[${targetLanguage}] Translation`
  const res = await fetch(`${base(siteUrl)}/${endpoint}`, {
    method: "POST",
    headers: headers(username, applicationPassword),
    body: JSON.stringify({
      title,
      content: translations["content"] ?? "",
      excerpt: translations["excerpt"] ?? "",
      status: "draft",
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`WordPress create failed ${res.status}: ${msg.slice(0, 200)}`)
  }
}
