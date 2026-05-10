/**
 * GitHub connector — repository localization files.
 *
 * Auth: Personal Access Token (classic or fine-grained).
 * Flow: configure owner/repo/branch → list i18n files → import → commit translated file.
 * Docs: https://docs.github.com/en/rest
 */

export interface ContentItem {
  id: string
  name: string
  state: string
  itemCount: number
}

const BASE = "https://api.github.com"

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
    Authorization: `Bearer ${apiToken}`,
    Accept: "application/vnd.github.v3+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
}

export async function testConnection(apiToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE}/user`, {
      headers: headers(apiToken),
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return { ok: true }
    if (res.status === 401) return { ok: false, error: "Invalid personal access token" }
    return { ok: false, error: `GitHub API responded with ${res.status}` }
  } catch (err) {
    return { ok: false, error: `Connection failed: ${(err as Error).message}` }
  }
}

export async function listContent(apiToken: string, owner?: string, repoName?: string, branch = "main"): Promise<ContentItem[]> {
  if (!owner || !repoName) {
    // List accessible repos so the user can identify the right one
    const res = await fetch(`${BASE}/user/repos?per_page=50&sort=updated&affiliation=owner,collaborator`, {
      headers: headers(apiToken),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`GitHub API error ${res.status}`)
    const repos = await res.json() as Array<{ full_name: string; default_branch: string; private: boolean }>
    return repos.map((r) => ({
      id: `repo::${r.full_name}::${r.default_branch}`,
      name: `${r.private ? "🔒 " : ""}${r.full_name}`,
      state: "repository",
      itemCount: 0,
    }))
  }

  // List i18n files in the configured repo
  const treeRes = await fetch(`${BASE}/repos/${owner}/${repoName}/git/trees/${branch}?recursive=1`, {
    headers: headers(apiToken),
    signal: AbortSignal.timeout(15_000),
  })
  if (!treeRes.ok) throw new Error(`GitHub API error ${treeRes.status} — check owner, repo, and branch`)
  const treeData = await treeRes.json() as { tree: Array<{ path: string; type: string }> }
  const files = (treeData.tree ?? [])
    .filter((item) => item.type === "blob" && isI18nFile(item.path))
    .slice(0, 80)
  if (files.length === 0) {
    return [{
      id: `no-i18n-files::${owner}::${repoName}`,
      name: "No localization files found — check that your repo has i18n files (JSON, YAML, .po, .strings, .arb…)",
      state: "empty",
      itemCount: 0,
    }]
  }
  return files.map((f) => ({
    id: `${owner}::${repoName}::${branch}::${f.path}`,
    name: f.path,
    state: "file",
    itemCount: 1,
  }))
}

export async function fetchContent(apiToken: string, contentId: string): Promise<Record<string, string>> {
  if (contentId.startsWith("repo::") || contentId.startsWith("no-i18n-files::")) {
    throw new Error("Select a specific file to import, not a repository. Configure owner and repo in the connector settings first.")
  }
  const [owner, repo, branch, ...pathParts] = contentId.split("::")
  const filePath = pathParts.join("/")

  const res = await fetch(`${BASE}/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`, {
    headers: headers(apiToken),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`GitHub API error ${res.status}`)
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

/** Fetch an existing file's SHA (needed for GitHub API updates) */
async function getFileSha(apiToken: string, owner: string, repo: string, branch: string, filePath: string): Promise<string | undefined> {
  const res = await fetch(`${BASE}/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`, {
    headers: headers(apiToken),
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) return undefined
  const data = await res.json() as { sha?: string }
  return data.sha
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
  const [owner, repo, branch, ...pathParts] = contentId.split("::")
  const sourcePath = pathParts.join("/")
  const targetPath = deriveTargetPath(sourcePath, targetLanguage)

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
  const encoded = Buffer.from(content).toString("base64")

  // Get existing SHA if file exists (required by GitHub API for updates)
  const sha = await getFileSha(apiToken, owner, repo, branch, targetPath)

  const body: Record<string, unknown> = {
    message: `feat(i18n): add ${targetLanguage} translations`,
    content: encoded,
    branch,
  }
  if (sha) body.sha = sha

  const res = await fetch(`${BASE}/repos/${owner}/${repo}/contents/${targetPath}`, {
    method: "PUT",
    headers: { ...headers(apiToken), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GitHub commit failed ${res.status}: ${err.slice(0, 300)}`)
  }
}
