/**
 * Contentful connector — entries via Content Management API.
 *
 * Auth: CMA personal access token (Bearer).
 * Docs: https://www.contentful.com/developers/docs/references/content-management-api/
 */

export interface ContentItem {
  id: string
  name: string
  state: string
  itemCount: number
}

const BASE = "https://api.contentful.com"

function headers(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
}

export async function testConnection(spaceId: string, accessToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE}/spaces/${spaceId}`, {
      headers: headers(accessToken),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return { ok: true }
    if (res.status === 401 || res.status === 403) return { ok: false, error: "Invalid API token or space ID" }
    return { ok: false, error: `Contentful responded with ${res.status}` }
  } catch (err) {
    return { ok: false, error: `Connection failed: ${(err as Error).message}` }
  }
}

export async function listContent(spaceId: string, accessToken: string, environmentId = "master"): Promise<ContentItem[]> {
  const res = await fetch(`${BASE}/spaces/${spaceId}/environments/${environmentId}/entries?limit=50&order=-sys.updatedAt`, {
    headers: headers(accessToken),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Contentful API error ${res.status}`)
  const data = await res.json() as { items: Array<{ sys: { id: string; publishedAt?: string }; fields: Record<string, Record<string, unknown>> }> }
  return (data.items ?? []).map((entry) => {
    // Find a title-like field in the first locale
    const firstLocaleValues = Object.values(entry.fields ?? {}).map((lv) => Object.values(lv ?? {})[0])
    const title = firstLocaleValues.find((v) => typeof v === "string" && v.length > 0) as string | undefined
    const textFieldCount = Object.values(entry.fields ?? {}).filter((lv) => typeof Object.values(lv ?? {})[0] === "string").length
    return {
      id: entry.sys.id,
      name: title?.slice(0, 80) ?? entry.sys.id,
      state: entry.sys.publishedAt ? "published" : "draft",
      itemCount: textFieldCount,
    }
  })
}

export async function fetchContent(spaceId: string, accessToken: string, environmentId = "master", entryId: string): Promise<Record<string, string>> {
  const res = await fetch(`${BASE}/spaces/${spaceId}/environments/${environmentId}/entries/${entryId}`, {
    headers: headers(accessToken),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Contentful API error ${res.status}`)
  const data = await res.json() as { fields: Record<string, Record<string, unknown>>; sys: { version: number } }
  const result: Record<string, string> = {}
  // Extract string-type fields from first available locale
  Object.entries(data.fields ?? {}).forEach(([fieldId, locales]) => {
    const localeValues = Object.values(locales ?? {})
    const val = localeValues.find((v) => typeof v === "string" && (v as string).trim())
    if (typeof val === "string") result[fieldId] = val.trim()
  })
  return result
}

export async function fetchEntryMeta(spaceId: string, accessToken: string, environmentId = "master", entryId: string): Promise<{ version: number; fields: Record<string, Record<string, unknown>> }> {
  const res = await fetch(`${BASE}/spaces/${spaceId}/environments/${environmentId}/entries/${entryId}`, {
    headers: headers(accessToken),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Contentful API error ${res.status}`)
  const data = await res.json() as { fields: Record<string, Record<string, unknown>>; sys: { version: number } }
  return { version: data.sys.version, fields: data.fields }
}

export async function pushTranslation(
  spaceId: string, accessToken: string, environmentId = "master",
  entryId: string, targetLocale: string, translations: Record<string, string>
): Promise<void> {
  // Fetch current entry to get version + existing fields
  const { version, fields } = await fetchEntryMeta(spaceId, accessToken, environmentId, entryId)

  // Merge translations into the existing fields under the target locale
  const updatedFields = { ...fields }
  Object.entries(translations).forEach(([fieldId, value]) => {
    if (updatedFields[fieldId]) {
      updatedFields[fieldId] = { ...updatedFields[fieldId], [targetLocale]: value }
    }
  })

  const res = await fetch(`${BASE}/spaces/${spaceId}/environments/${environmentId}/entries/${entryId}`, {
    method: "PUT",
    headers: { ...headers(accessToken), "X-Contentful-Version": String(version) },
    body: JSON.stringify({ fields: updatedFields }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`Contentful update failed ${res.status}: ${msg.slice(0, 200)}`)
  }
}
