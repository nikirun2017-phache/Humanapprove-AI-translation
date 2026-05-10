/**
 * Zendesk Guide connector — Help Center articles.
 *
 * Auth: Basic auth with email/token (email/token:apiToken, Base64-encoded).
 * Docs: https://developer.zendesk.com/api-reference/help-center/
 */

export interface ContentItem {
  id: string
  name: string
  state: string
  itemCount: number
}

function base(subdomain: string) {
  return `https://${subdomain.replace(/\.zendesk\.com.*$/, "")}.zendesk.com`
}

function headers(email: string, apiToken: string): Record<string, string> {
  const encoded = Buffer.from(`${email}/token:${apiToken}`).toString("base64")
  return { Authorization: `Basic ${encoded}`, "Content-Type": "application/json" }
}

export async function testConnection(subdomain: string, email: string, apiToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${base(subdomain)}/api/v2/help_center/articles?per_page=1`, {
      headers: headers(email, apiToken),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return { ok: true }
    if (res.status === 401 || res.status === 403) return { ok: false, error: "Invalid email or API token" }
    return { ok: false, error: `Zendesk responded with ${res.status}` }
  } catch (err) {
    return { ok: false, error: `Connection failed: ${(err as Error).message}` }
  }
}

export async function listContent(subdomain: string, email: string, apiToken: string): Promise<ContentItem[]> {
  const res = await fetch(`${base(subdomain)}/api/v2/help_center/articles?per_page=50&sort_by=updated_at&sort_order=desc`, {
    headers: headers(email, apiToken),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Zendesk API error ${res.status}`)
  const data = await res.json() as { articles: Array<{ id: number; title: string; draft: boolean }> }
  return (data.articles ?? []).map((a) => ({
    id: String(a.id),
    name: a.title || `Article ${a.id}`,
    state: a.draft ? "draft" : "published",
    itemCount: 1,
  }))
}

export async function fetchContent(subdomain: string, email: string, apiToken: string, articleId: string): Promise<Record<string, string>> {
  const res = await fetch(`${base(subdomain)}/api/v2/help_center/articles/${articleId}`, {
    headers: headers(email, apiToken),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Zendesk API error ${res.status}`)
  const data = await res.json() as { article: { title: string; body: string } }
  const result: Record<string, string> = {}
  if (data.article.title) result["title"] = data.article.title
  if (data.article.body) {
    const plain = data.article.body
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
      .replace(/\s{2,}/g, " ").trim()
    if (plain) result["body"] = plain
  }
  return result
}

export async function pushTranslation(
  subdomain: string, email: string, apiToken: string,
  articleId: string, locale: string, translations: Record<string, string>
): Promise<void> {
  const h = headers(email, apiToken)
  const body = JSON.stringify({
    translation: { locale, title: translations["title"], body: translations["body"] ? `<p>${translations["body"]}</p>` : undefined },
  })
  // Try create first; if 422/409 (already exists), update instead
  const createRes = await fetch(`${base(subdomain)}/api/v2/help_center/articles/${articleId}/translations`, {
    method: "POST", headers: h, body, signal: AbortSignal.timeout(15_000),
  })
  if (createRes.ok) return
  if (createRes.status === 422 || createRes.status === 409) {
    const putRes = await fetch(`${base(subdomain)}/api/v2/help_center/articles/${articleId}/translations/${locale}`, {
      method: "PUT", headers: h, body, signal: AbortSignal.timeout(15_000),
    })
    if (!putRes.ok) {
      const msg = await putRes.text()
      throw new Error(`Zendesk update translation failed ${putRes.status}: ${msg.slice(0, 200)}`)
    }
    return
  }
  const msg = await createRes.text()
  throw new Error(`Zendesk create translation failed ${createRes.status}: ${msg.slice(0, 200)}`)
}
