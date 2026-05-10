/**
 * Pendo connector — guide content management via app.pendo.io API.
 *
 * Auth: X-Pendo-Integration-Key header.
 * Docs: https://engageapi.pendo.io/
 */

export interface PendoGuide {
  id: string
  name: string
  state: "public" | "disabled" | "draft" | string
  appId: number
  steps: PendoStep[]
}

export interface PendoStep {
  id: string
  type: string
  contentUrl?: string
  content?: string // raw HTML
  attributes?: { title?: string; [key: string]: unknown }
}

export interface ContentItem {
  id: string
  name: string
  state: string
  itemCount: number // number of translatable text chunks
}

const BASE = "https://app.pendo.io"

function headers(apiKey: string) {
  return {
    "x-pendo-integration-key": apiKey,
    "Content-Type": "application/json",
  }
}

export async function testConnection(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE}/api/v1/guide`, {
      method: "GET",
      headers: headers(apiKey),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok || res.status === 200) return { ok: true }
    if (res.status === 401 || res.status === 403) return { ok: false, error: "Invalid or unauthorized integration key" }
    return { ok: false, error: `Pendo API responded with ${res.status}` }
  } catch (err) {
    return { ok: false, error: `Connection failed: ${(err as Error).message}` }
  }
}

export async function listContent(apiKey: string): Promise<ContentItem[]> {
  const res = await fetch(`${BASE}/api/v1/guide`, {
    headers: headers(apiKey),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Pendo API error ${res.status}`)
  const guides = await res.json() as PendoGuide[]
  return guides.map((g) => ({
    id: g.id,
    name: g.name || `Guide ${g.id}`,
    state: g.state,
    itemCount: g.steps?.length ?? 0,
  }))
}

export async function fetchGuide(apiKey: string, guideId: string): Promise<PendoGuide> {
  const res = await fetch(`${BASE}/api/v1/guide/${guideId}`, {
    headers: headers(apiKey),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Pendo API error ${res.status}`)
  return res.json() as Promise<PendoGuide>
}

/** Strip HTML tags and decode basic entities → plain text */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

/**
 * Extract translatable text segments from a Pendo guide.
 * Returns a plain JSON record suitable for parseJsonSource.
 */
export function guideToJson(guide: PendoGuide): Record<string, string> {
  const result: Record<string, string> = {}
  guide.steps?.forEach((step, i) => {
    const prefix = `step${i + 1}`
    if (step.attributes?.title) {
      result[`${prefix}_title`] = String(step.attributes.title).trim()
    }
    if (step.content) {
      const text = stripHtml(step.content)
      if (text) result[`${prefix}_content`] = text
    }
  })
  return result
}

/**
 * Rebuild the guide's step content HTML by substituting translated strings back in.
 * Simple string replacement — preserves surrounding HTML structure.
 */
export function mergeTranslationsIntoGuide(
  guide: PendoGuide,
  translations: Record<string, string>
): PendoGuide {
  const steps = guide.steps?.map((step, i) => {
    const prefix = `step${i + 1}`
    let { content, attributes } = step

    if (attributes?.title && translations[`${prefix}_title`]) {
      attributes = { ...attributes, title: translations[`${prefix}_title`] }
    }
    if (content && translations[`${prefix}_content`]) {
      const translated = translations[`${prefix}_content`]
      if (!content.includes("<")) {
        // Plain text — replace directly
        content = translated
      } else {
        // HTML content: preserve the outermost wrapper tag and replace its entire
        // inner content with the translation.  The previous regex used a global
        // replace which injected the full translated string into EVERY matched
        // tag — duplicating the text N times for N elements in the step.
        const outerMatch = content.match(/^(\s*<([a-zA-Z][a-zA-Z0-9]*)[^>]*>)([\s\S]*?)(<\/\2>\s*)$/)
        if (outerMatch) {
          // Single outer wrapper (e.g. <div …>…</div>) — keep it, replace body
          content = `${outerMatch[1]}${translated}${outerMatch[4]}`
        } else {
          // No clear single wrapper — wrap translated paragraphs in <p> tags
          const paras = translated.split(/\n{2,}/).filter(Boolean)
          content = paras.length > 1
            ? paras.map((p) => `<p>${p.trim()}</p>`).join("")
            : `<p>${translated}</p>`
        }
      }
    }
    return { ...step, content, attributes }
  })
  return { ...guide, steps: steps ?? guide.steps }
}

/**
 * Push translated guide back to Pendo.
 */
export async function pushTranslation(apiKey: string, guide: PendoGuide): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/guide/${guide.id}`, {
    method: "PUT",
    headers: headers(apiKey),
    body: JSON.stringify(guide),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pendo push failed ${res.status}: ${err.slice(0, 200)}`)
  }
}
