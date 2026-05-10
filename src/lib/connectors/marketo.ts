/**
 * Marketo connector — email templates via Marketo REST API.
 *
 * Auth: OAuth2 client credentials (client_id + client_secret).
 * Docs: https://developers.marketo.com/rest-api/
 */

export interface ContentItem {
  id: string
  name: string
  state: string
  itemCount: number
}

function base(munchkinId: string) {
  return `https://${munchkinId}.mktorest.com`
}

async function getAccessToken(munchkinId: string, clientId: string, clientSecret: string): Promise<string> {
  const url = `${base(munchkinId)}/identity/oauth/token?grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Marketo auth failed ${res.status}`)
  const data = await res.json() as { access_token?: string; error?: string }
  if (!data.access_token) throw new Error(data.error ?? "Failed to obtain Marketo access token")
  return data.access_token
}

function headers(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }
}

export async function testConnection(munchkinId: string, clientId: string, clientSecret: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const token = await getAccessToken(munchkinId, clientId, clientSecret)
    const res = await fetch(`${base(munchkinId)}/rest/asset/v1/emails.json?maxReturn=1`, {
      headers: headers(token),
      signal: AbortSignal.timeout(10_000),
    })
    const data = await res.json() as { success: boolean; errors?: Array<{ message: string }> }
    if (data.success) return { ok: true }
    return { ok: false, error: data.errors?.[0]?.message ?? "Marketo API error" }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

export async function listContent(munchkinId: string, clientId: string, clientSecret: string): Promise<ContentItem[]> {
  const token = await getAccessToken(munchkinId, clientId, clientSecret)
  const res = await fetch(`${base(munchkinId)}/rest/asset/v1/emails.json?maxReturn=50`, {
    headers: headers(token),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Marketo API error ${res.status}`)
  const data = await res.json() as { result: Array<{ id: number; name: string; status: string }> }
  return (data.result ?? []).map((e) => ({
    id: String(e.id),
    name: e.name || `Email ${e.id}`,
    state: (e.status ?? "").toLowerCase(),
    itemCount: 2,
  }))
}

export async function fetchContent(munchkinId: string, clientId: string, clientSecret: string, emailId: string): Promise<Record<string, string>> {
  const token = await getAccessToken(munchkinId, clientId, clientSecret)
  // Get subject line
  const emailRes = await fetch(`${base(munchkinId)}/rest/asset/v1/email/${emailId}.json`, {
    headers: headers(token),
    signal: AbortSignal.timeout(15_000),
  })
  if (!emailRes.ok) throw new Error(`Marketo API error ${emailRes.status}`)
  const emailData = await emailRes.json() as { result: Array<{ subject: { value: string }; fromName: { value: string } }> }
  const email = emailData.result?.[0]
  // Get content sections
  const contentRes = await fetch(`${base(munchkinId)}/rest/asset/v1/email/${emailId}/content.json`, {
    headers: headers(token),
    signal: AbortSignal.timeout(15_000),
  })
  const contentData = await contentRes.json() as { result: Array<{ htmlId: string; contentType: string; value: Array<{ type: string; value: string }> }> }
  const result: Record<string, string> = {}
  if (email?.subject?.value) result["subject"] = email.subject.value
  ;(contentData.result ?? []).forEach((section) => {
    const textVal = section.value?.find((v) => v.type === "Text" || v.type === "HTML")
    if (textVal?.value) {
      const plain = textVal.value.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim()
      if (plain) result[section.htmlId] = plain
    }
  })
  return result
}

export async function pushTranslation(
  munchkinId: string, clientId: string, clientSecret: string,
  emailId: string, targetLanguage: string, translations: Record<string, string>
): Promise<void> {
  const token = await getAccessToken(munchkinId, clientId, clientSecret)
  // Clone the email, then update content
  const cloneRes = await fetch(`${base(munchkinId)}/rest/asset/v1/email/${emailId}/clone.json`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ name: `[${targetLanguage}] Email ${emailId}`, folderId: { id: 0, type: "Folder" } }),
    signal: AbortSignal.timeout(15_000),
  })
  const cloneData = await cloneRes.json() as { result: Array<{ id: number }> }
  const newEmailId = cloneData.result?.[0]?.id
  if (!newEmailId) throw new Error("Failed to clone Marketo email for translation")
  // Update subject
  if (translations["subject"]) {
    await fetch(`${base(munchkinId)}/rest/asset/v1/email/${newEmailId}/content/subject.json`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify([{ type: "Text", value: translations["subject"] }]),
      signal: AbortSignal.timeout(15_000),
    })
  }
  // Update other sections
  const sectionKeys = Object.keys(translations).filter((k) => k !== "subject")
  for (const sectionId of sectionKeys) {
    await fetch(`${base(munchkinId)}/rest/asset/v1/email/${newEmailId}/content/${sectionId}.json`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify([{ type: "Text", value: translations[sectionId] }]),
      signal: AbortSignal.timeout(15_000),
    })
  }
}
