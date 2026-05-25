/**
 * Google Drive connector — Google Docs and native DOCX files.
 *
 * Auth: OAuth access token (user obtains from Google OAuth Playground or service account).
 * Docs: https://developers.google.com/drive/api/guides/about-sdk
 *
 * Supported file types:
 *  - application/vnd.google-apps.document  (Google Docs — exported as plain text)
 *  - application/vnd.openxmlformats-officedocument.wordprocessingml.document (.docx)
 */

export interface ContentItem {
  id: string
  name: string
  state: string
  itemCount: number
  /** "gdoc" for native Google Docs, "docx" for uploaded Word files */
  fileType?: "gdoc" | "docx"
}

const DRIVE_BASE = "https://www.googleapis.com/drive/v3"
const DOCS_BASE = "https://docs.googleapis.com/v1"

function headers(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` }
}

export async function testConnection(accessToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${DRIVE_BASE}/about?fields=user`, {
      headers: headers(accessToken),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return { ok: true }
    if (res.status === 401) return { ok: false, error: "Invalid or expired access token" }
    return { ok: false, error: `Google Drive responded with ${res.status}` }
  } catch (err) {
    return { ok: false, error: `Connection failed: ${(err as Error).message}` }
  }
}

const GDOC_MIME  = "application/vnd.google-apps.document"
const DOCX_MIME  = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

export async function listContent(accessToken: string, folderId?: string): Promise<ContentItem[]> {
  const folderFilter = folderId ? ` and '${folderId}' in parents` : ""
  // List both native Google Docs and uploaded DOCX files
  const q = `(mimeType='${GDOC_MIME}' or mimeType='${DOCX_MIME}')${folderFilter} and trashed=false`
  const res = await fetch(
    `${DRIVE_BASE}/files?q=${encodeURIComponent(q)}&pageSize=50&orderBy=modifiedTime+desc&fields=files(id,name,mimeType,modifiedTime)`,
    { headers: headers(accessToken), signal: AbortSignal.timeout(15_000) }
  )
  if (!res.ok) throw new Error(`Google Drive API error ${res.status}`)
  const data = await res.json() as { files: Array<{ id: string; name: string; mimeType: string }> }
  return (data.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    state: "document",
    itemCount: 1,
    fileType: f.mimeType === DOCX_MIME ? "docx" : "gdoc",
  }))
}

export async function fetchContent(
  accessToken: string,
  fileId: string,
  fileType?: "gdoc" | "docx"
): Promise<Record<string, string>> {
  if (fileType === "docx") {
    // Download the DOCX binary and return it as a single base64-encoded entry
    // so the import route can forward it to parseDocxSource()
    const res = await fetch(`${DRIVE_BASE}/files/${fileId}?alt=media`, {
      headers: headers(accessToken),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`Google Drive download failed ${res.status}`)
    const arrayBuffer = await res.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString("base64")
    // Special sentinel key tells the import route this is a raw DOCX binary
    return { __docx_base64__: base64 }
  }

  // Native Google Doc — export as plain text
  const res = await fetch(`${DRIVE_BASE}/files/${fileId}/export?mimeType=text/plain`, {
    headers: headers(accessToken),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Google Drive export failed ${res.status}`)
  const text = await res.text()
  // Split into paragraphs for translation, preserving structure
  const paragraphs = text.split(/\n{2,}/).map((p) => p.replace(/\n/g, " ").trim()).filter((p) => p.length > 0)
  const result: Record<string, string> = {}
  paragraphs.forEach((para, i) => { result[`paragraph_${i + 1}`] = para })
  return result
}

export async function pushTranslation(
  accessToken: string, folderId: string | undefined, originalFileId: string,
  targetLanguage: string, translations: Record<string, string>
): Promise<void> {
  // Get original file name
  const metaRes = await fetch(`${DRIVE_BASE}/files/${originalFileId}?fields=name,parents`, {
    headers: headers(accessToken),
    signal: AbortSignal.timeout(10_000),
  })
  const meta = await metaRes.json() as { name: string; parents: string[] }
  const translatedName = `[${targetLanguage}] ${meta.name}`
  const parentId = folderId ?? meta.parents?.[0]

  // Create a new Google Doc with the translated content
  const content = Object.values(translations).join("\n\n")
  const boundary = "boundary123"
  const metaPart = JSON.stringify({ name: translatedName, mimeType: "application/vnd.google-apps.document", parents: parentId ? [parentId] : [] })
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    metaPart,
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    content,
    `--${boundary}--`,
  ].join("\r\n")

  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`, {
    method: "POST",
    headers: { ...headers(accessToken), "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`Google Drive upload failed ${res.status}: ${msg.slice(0, 200)}`)
  }
}
