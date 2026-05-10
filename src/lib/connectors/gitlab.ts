/**
 * GitLab connector — repository localization files.
 *
 * Auth: Personal Access Token (PAT) or Project/Group access token.
 * Flow: configure projectPath/branch → list i18n files → import → commit translated file.
 * Docs: https://docs.gitlab.com/ee/api/
 */

export interface ContentItem {
  id: string
  name: string
  state: string
  itemCount: number
}

const BASE = "https://gitlab.com/api/v4"

// File extensions that indicate a localization file
const I18N_EXTS = new Set(["json", "yaml", "yml", "po", "pot", "strings", "stringsdict", "xcstrings", "arb", "xliff", "xlf", "properties"])

// Directory name fragments that indicate an i18n directory
const I18N_DIRS = ["locale", "locales", "i18n", "lang", "langs", "translations", "translation", "l10n", "intl"]

function isI18nFile(path: string): boolean {
  const parts = path.split("/")
  const filename = parts[parts.length - 1]
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  if (!I18N_EXTS.has(ext)) return false
  // Always include if it has a locale-like name (en.json, en-US.json, fr_FR.yaml)
  if (/^[a-z]{2}([_-][A-Z]{2})?\.[a-z]+$/.test(filename)) return true
  // Include if inside an i18n directory
  return parts.some((part) => I18N_DIRS.some((d) => part.toLowerCase().includes(d)))
}

function headers(apiToken: string): Record<string, string> {
  return {
    "PRIVATE-TOKEN": apiToken,
  }
}

/** Encode a project path (e.g. "mygroup/myrepo") as a URL component */
function encodeProject(projectPath: string): string {
  return encodeURIComponent(projectPath)
}

export async function testConnection(apiToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE}/user`, {
      headers: headers(apiToken),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return { ok: true }
    if (res.status === 401) return { ok: false, error: "Invalid personal access token" }
    return { ok: false, error: `GitLab API responded with ${res.status}` }
  } catch (err) {
    return { ok: false, error: `Connection failed: ${(err as Error).message}` }
  }
}

export async function listContent(
  apiToken: string, projectPath?: string, branch = "main"
): Promise<ContentItem[]> {
  if (!projectPath) {
    // List accessible projects so the user can identify the right one
    const res = await fetch(`${BASE}/projects?membership=true&per_page=50&order_by=last_activity_at`, {
      headers: headers(apiToken),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`GitLab API error ${res.status}`)
    const projects = await res.json() as Array<{ path_with_namespace: string; name: string; visibility: string; default_branch: string }>
    return projects.map((p) => ({
      id: `project::${p.path_with_namespace}::${p.default_branch}`,
      name: `${p.visibility === "private" ? "🔒 " : ""}${p.path_with_namespace}`,
      state: "project",
      itemCount: 0,
    }))
  }

  // List i18n files in the configured project
  const encoded = encodeProject(projectPath)
  const treeRes = await fetch(
    `${BASE}/projects/${encoded}/repository/tree?recursive=true&per_page=100&ref=${branch}`,
    { headers: headers(apiToken), signal: AbortSignal.timeout(15_000) }
  )
  if (!treeRes.ok) throw new Error(`GitLab API error ${treeRes.status} — check project path and branch`)
  const tree = await treeRes.json() as Array<{ path: string; type: string }>
  const files = tree.filter((item) => item.type === "blob" && isI18nFile(item.path)).slice(0, 80)

  if (files.length === 0) {
    return [{
      id: `no-i18n-files::${projectPath}`,
      name: "No localization files found — check that your repo has i18n files (JSON, YAML, .po, .strings, .arb…)",
      state: "empty",
      itemCount: 0,
    }]
  }
  return files.map((f) => ({
    id: `${projectPath}::${branch}::${f.path}`,
    name: f.path,
    state: "file",
    itemCount: 1,
  }))
}

export async function fetchContent(apiToken: string, contentId: string): Promise<Record<string, string>> {
  if (contentId.startsWith("project::") || contentId.startsWith("no-i18n-files::")) {
    throw new Error("Select a specific file to import. Configure project path in the connector settings first.")
  }
  const [projectPath, branch, ...pathParts] = contentId.split("::")
  const filePath = pathParts.join("/")
  const encoded = encodeProject(projectPath)

  const res = await fetch(
    `${BASE}/projects/${encoded}/repository/files/${encodeURIComponent(filePath)}?ref=${branch}`,
    { headers: headers(apiToken), signal: AbortSignal.timeout(15_000) }
  )
  if (!res.ok) throw new Error(`GitLab API error ${res.status}`)
  const data = await res.json() as { content: string; encoding: string }
  const raw = Buffer.from(data.content.replace(/\n/g, ""), data.encoding as BufferEncoding).toString("utf-8")

  // Parse JSON (most common): flatten nested objects
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result: Record<string, string> = {}
    function flatten(obj: Record<string, unknown>, prefix = "") {
      Object.entries(obj).forEach(([key, val]) => {
        const k = prefix ? `${prefix}.${key}` : key
        if (typeof val === "string" && val.trim()) result[k] = val
        else if (val && typeof val === "object" && !Array.isArray(val)) flatten(val as Record<string, unknown>, k)
      })
    }
    flatten(parsed)
    if (Object.keys(result).length > 0) return result
  } catch { /* not JSON */ }

  // Plain text fallback: split into paragraphs
  const paragraphs = raw.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const result: Record<string, string> = {}
  paragraphs.forEach((para, i) => { result[`p${i + 1}`] = para })
  return result
}

/** Derive the target file path by replacing the source locale in the filename */
function deriveTargetPath(sourcePath: string, targetLanguage: string): string {
  const dir = sourcePath.includes("/") ? sourcePath.slice(0, sourcePath.lastIndexOf("/") + 1) : ""
  const filename = sourcePath.slice(dir.length)
  const [base, ...extParts] = filename.split(".")
  const ext = extParts.join(".")
  // If filename looks like a locale code (en.json, en-US.json, en_US.yaml) replace it
  if (/^[a-z]{2}([_-][A-Z]{2})?$/.test(base)) {
    return `${dir}${targetLanguage}.${ext}`
  }
  // Otherwise append locale before extension: messages.json → messages.fr-FR.json
  return `${dir}${base}.${targetLanguage}.${ext}`
}

export async function pushTranslation(
  apiToken: string, contentId: string, targetLanguage: string, translations: Record<string, string>
): Promise<void> {
  const [projectPath, branch, ...pathParts] = contentId.split("::")
  const sourcePath = pathParts.join("/")
  const targetPath = deriveTargetPath(sourcePath, targetLanguage)
  const encoded = encodeProject(projectPath)

  // Rebuild nested JSON from flat translation keys
  const output: Record<string, unknown> = {}
  Object.entries(translations).forEach(([key, val]) => {
    const parts = key.split(".")
    let obj = output
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof obj[parts[i]] !== "object" || obj[parts[i]] === null) obj[parts[i]] = {}
      obj = obj[parts[i]] as Record<string, unknown>
    }
    obj[parts[parts.length - 1]] = val
  })

  const content = JSON.stringify(output, null, 2) + "\n"

  // Check if file already exists to decide create vs update
  const checkRes = await fetch(
    `${BASE}/projects/${encoded}/repository/files/${encodeURIComponent(targetPath)}?ref=${branch}`,
    { headers: headers(apiToken), signal: AbortSignal.timeout(8_000) }
  )
  const fileExists = checkRes.ok

  const method = fileExists ? "PUT" : "POST"
  const body: Record<string, unknown> = {
    branch,
    content,
    commit_message: `feat(i18n): add ${targetLanguage} translations`,
    encoding: "text",
  }

  const res = await fetch(
    `${BASE}/projects/${encoded}/repository/files/${encodeURIComponent(targetPath)}`,
    {
      method,
      headers: { ...headers(apiToken), "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GitLab commit failed ${res.status}: ${err.slice(0, 300)}`)
  }
}
