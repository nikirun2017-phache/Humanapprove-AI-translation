/**
 * Jira connector — issues via Jira Cloud REST API v3.
 *
 * Auth: Basic auth with email + API token.
 * Push: Posts a comment with the translated content (non-destructive).
 * Docs: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
 */

export interface ContentItem {
  id: string
  name: string
  state: string
  itemCount: number
}

function base(cloudUrl: string) {
  return cloudUrl.replace(/\/$/, "") + "/rest/api/3"
}

function headers(email: string, apiToken: string): Record<string, string> {
  const encoded = Buffer.from(`${email}:${apiToken}`).toString("base64")
  return { Authorization: `Basic ${encoded}`, "Content-Type": "application/json" }
}

/** Recursively extract plain text from Atlassian Document Format (ADF) */
function adfToText(node: Record<string, unknown>): string {
  if (node.type === "text" && typeof node.text === "string") return node.text
  if (Array.isArray(node.content)) {
    return (node.content as Record<string, unknown>[]).map(adfToText).filter(Boolean).join(" ")
  }
  return ""
}

export async function testConnection(cloudUrl: string, email: string, apiToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${base(cloudUrl)}/myself`, {
      headers: headers(email, apiToken),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return { ok: true }
    if (res.status === 401 || res.status === 403) return { ok: false, error: "Invalid email or API token" }
    return { ok: false, error: `Jira responded with ${res.status}` }
  } catch (err) {
    return { ok: false, error: `Connection failed: ${(err as Error).message}` }
  }
}

export async function listContent(cloudUrl: string, email: string, apiToken: string, projectKey?: string): Promise<ContentItem[]> {
  const jql = projectKey ? `project = ${projectKey} ORDER BY updated DESC` : "ORDER BY updated DESC"
  const res = await fetch(`${base(cloudUrl)}/search?jql=${encodeURIComponent(jql)}&maxResults=50&fields=summary,status,issuetype`, {
    headers: headers(email, apiToken),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Jira API error ${res.status}`)
  const data = await res.json() as { issues: Array<{ id: string; key: string; fields: { summary: string; status: { name: string } } }> }
  return (data.issues ?? []).map((issue) => ({
    id: issue.key,
    name: `${issue.key}: ${issue.fields?.summary ?? ""}`,
    state: (issue.fields?.status?.name ?? "").toLowerCase(),
    itemCount: 2,
  }))
}

export async function fetchContent(cloudUrl: string, email: string, apiToken: string, issueKey: string): Promise<Record<string, string>> {
  const res = await fetch(`${base(cloudUrl)}/issue/${issueKey}?fields=summary,description`, {
    headers: headers(email, apiToken),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Jira API error ${res.status}`)
  const data = await res.json() as { fields: { summary: string; description: Record<string, unknown> | null } }
  const result: Record<string, string> = {}
  if (data.fields.summary) result["summary"] = data.fields.summary
  if (data.fields.description) {
    const descText = adfToText(data.fields.description as Record<string, unknown>).replace(/\s{2,}/g, " ").trim()
    if (descText) result["description"] = descText
  }
  return result
}

export async function pushTranslation(
  cloudUrl: string, email: string, apiToken: string,
  issueKey: string, targetLanguage: string, translations: Record<string, string>
): Promise<void> {
  // Post translated content as a comment (non-destructive)
  const parts: string[] = [`**Translation [${targetLanguage}]**`]
  if (translations["summary"]) parts.push(`**Summary:** ${translations["summary"]}`)
  if (translations["description"]) parts.push(`**Description:** ${translations["description"]}`)

  const body = {
    body: {
      type: "doc",
      version: 1,
      content: parts.map((text) => ({
        type: "paragraph",
        content: [{ type: "text", text }],
      })),
    },
  }

  const res = await fetch(`${base(cloudUrl)}/issue/${issueKey}/comment`, {
    method: "POST",
    headers: headers(email, apiToken),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`Jira post comment failed ${res.status}: ${msg.slice(0, 200)}`)
  }
}
