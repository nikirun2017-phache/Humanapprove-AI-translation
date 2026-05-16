import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const VALID_CONNECTORS = new Set([
  "pendo", "webflow", "salesforce",
  "zendesk", "contentful", "wordpress", "hubspot",
  "jira", "slack", "qualtrics", "marketo", "googledrive", "sharepoint",
  "github", "gitlab",
])

// GET /api/integrations — list user's integrations
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const integrations = await db.integration.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      connector: true,
      config: true,
      status: true,
      lastTestedAt: true,
      // Never return raw credentials — only masked version
      credentials: true,
    },
  })

  // Mask secrets before returning
  const masked = integrations.map((i: typeof integrations[number]) => {
    let creds: Record<string, string> = {}
    try { creds = JSON.parse(i.credentials) } catch { /* */ }
    const maskedCreds: Record<string, string> = {}
    Object.keys(creds).forEach((k) => {
      const v = creds[k]
      maskedCreds[k] = v ? `${"•".repeat(Math.min(v.length - 4, 12))}${v.slice(-4)}` : ""
    })
    return { ...i, credentials: maskedCreds }
  })

  return NextResponse.json(masked)
}

// PUT /api/integrations/[connector] is handled by the sub-route, but
// we also allow PUT here for convenience: PUT /api/integrations with { connector, credentials, config }
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as {
    connector: string
    credentials?: Record<string, string>  // optional — absent means "keep existing"
    config?: Record<string, string>
  }

  if (!VALID_CONNECTORS.has(body.connector)) {
    return NextResponse.json({ error: "Unknown connector" }, { status: 400 })
  }

  const ALLOWED_KEYS = new Set([
    // existing
    "apiKey", "instanceUrl", "accessToken", "siteId",
    // zendesk
    "subdomain", "email", "apiToken",
    // contentful
    "spaceId", "environmentId",
    // wordpress / sharepoint
    "siteUrl", "username", "applicationPassword",
    // jira
    "cloudUrl", "projectKey",
    // slack
    "botToken", "channelId",
    // qualtrics
    "dataCenter",
    // marketo
    "clientId", "clientSecret", "munchkinId",
    // google drive
    "folderId",
    // github / gitlab
    "owner", "repoName", "projectPath", "branch",
  ])

  const cleanConfig: Record<string, string> = {}
  Object.entries(body.config ?? {}).forEach(([k, v]) => {
    if (ALLOWED_KEYS.has(k) && typeof v === "string") cleanConfig[k] = v.trim()
  })

  // Fetch existing record once — used to preserve both credentials and config
  const existing = await db.integration.findUnique({
    where: { userId_connector: { userId: session.user.id, connector: body.connector } },
    select: { credentials: true, config: true },
  })

  // If credentials were provided, sanitize and use them.
  // If absent (config-only update), preserve existing credentials.
  let credentialsJson: string
  if (body.credentials !== undefined && Object.keys(body.credentials).length > 0) {
    const cleanCreds: Record<string, string> = {}
    Object.entries(body.credentials).forEach(([k, v]) => {
      if (ALLOWED_KEYS.has(k) && typeof v === "string") cleanCreds[k] = v.trim()
    })
    credentialsJson = JSON.stringify(cleanCreds)
  } else {
    credentialsJson = existing?.credentials ?? "{}"
  }

  // Always merge new config on top of existing config so partial updates
  // (e.g. saving only credentials) never wipe previously saved keys like siteId.
  let existingConfig: Record<string, string> = {}
  try { existingConfig = JSON.parse(existing?.config ?? "{}") } catch { /* */ }
  const mergedConfig = { ...existingConfig, ...cleanConfig }

  const integration = await db.integration.upsert({
    where: { userId_connector: { userId: session.user.id, connector: body.connector } },
    create: {
      userId: session.user.id,
      connector: body.connector,
      credentials: credentialsJson,
      config: JSON.stringify(mergedConfig),
      status: "disconnected",
    },
    update: {
      credentials: credentialsJson,
      config: JSON.stringify(mergedConfig),
      status: "disconnected",
      lastTestedAt: null,
    },
  })

  return NextResponse.json({ id: integration.id, connector: integration.connector, status: integration.status })
}

// DELETE /api/integrations?connector=pendo
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const connector = req.nextUrl.searchParams.get("connector")
  if (!connector || !VALID_CONNECTORS.has(connector)) {
    return NextResponse.json({ error: "Unknown connector" }, { status: 400 })
  }

  await db.integration.deleteMany({
    where: { userId: session.user.id, connector },
  })

  return NextResponse.json({ ok: true })
}
