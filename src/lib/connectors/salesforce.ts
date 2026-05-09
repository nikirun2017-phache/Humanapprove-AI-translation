/**
 * Salesforce connector — CMS content via REST API.
 *
 * Auth: Authorization: Bearer {accessToken}
 * Instance URL: user-provided (e.g. https://myorg.my.salesforce.com)
 */

export interface SfContentItem {
  id: string
  title: string
  contentKey: string
  language: string
  status: string
  type: string
}

export interface ContentItem {
  id: string
  name: string
  state: string
  itemCount: number
}

function headers(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  }
}

function cleanUrl(url: string) {
  return url.replace(/\/$/, "")
}

export async function testConnection(instanceUrl: string, accessToken: string): Promise<{ ok: boolean; error?: string; orgName?: string }> {
  try {
    const res = await fetch(`${cleanUrl(instanceUrl)}/services/data/v59.0/`, {
      headers: headers(accessToken),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) {
      return { ok: true }
    }
    if (res.status === 401) return { ok: false, error: "Invalid or expired access token" }
    return { ok: false, error: `Salesforce API responded with ${res.status}` }
  } catch (err) {
    return { ok: false, error: `Connection failed: ${(err as Error).message}` }
  }
}

export async function listContent(instanceUrl: string, accessToken: string): Promise<ContentItem[]> {
  const res = await fetch(
    `${cleanUrl(instanceUrl)}/services/data/v59.0/connect/cms/managed-content/delivery/contents?pageSize=50`,
    {
      headers: headers(accessToken),
      signal: AbortSignal.timeout(15_000),
    }
  )
  if (!res.ok) throw new Error(`Salesforce API error ${res.status}`)
  const data = await res.json() as { items?: SfContentItem[] }
  const items = data.items ?? []
  return items.map((item) => ({
    id: item.id,
    name: item.title || item.contentKey,
    state: item.status,
    itemCount: 1,
  }))
}

export async function fetchContent(instanceUrl: string, accessToken: string, contentId: string): Promise<Record<string, string>> {
  const res = await fetch(
    `${cleanUrl(instanceUrl)}/services/data/v59.0/connect/cms/managed-content/delivery/contents/${contentId}`,
    {
      headers: headers(accessToken),
      signal: AbortSignal.timeout(15_000),
    }
  )
  if (!res.ok) throw new Error(`Salesforce API error ${res.status}`)
  const data = await res.json() as { contentBody?: Record<string, { value?: string }> }
  const result: Record<string, string> = {}
  Object.entries(data.contentBody ?? {}).forEach(([key, val]) => {
    if (typeof val?.value === "string" && val.value.trim()) {
      result[key] = val.value.trim()
    }
  })
  return result
}

export async function pushTranslation(
  instanceUrl: string,
  accessToken: string,
  contentId: string,
  translations: Record<string, string>
): Promise<void> {
  const body = {
    contentBody: Object.fromEntries(
      Object.entries(translations).map(([k, v]) => [k, { value: v }])
    ),
  }
  const res = await fetch(
    `${cleanUrl(instanceUrl)}/services/data/v59.0/connect/cms/managed-content/delivery/contents/${contentId}`,
    {
      method: "PATCH",
      headers: headers(accessToken),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Salesforce push failed ${res.status}: ${err.slice(0, 200)}`)
  }
}
