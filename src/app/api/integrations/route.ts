import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

const VALID_CONNECTORS = new Set(["pendo", "webflow", "salesforce"])

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
    credentials: Record<string, string>
    config?: Record<string, string>
  }

  if (!VALID_CONNECTORS.has(body.connector)) {
    return NextResponse.json({ error: "Unknown connector" }, { status: 400 })
  }

  // Sanitize: only allow known credential keys, trim values
  const cleanCreds: Record<string, string> = {}
  const ALLOWED_KEYS = new Set(["apiKey", "instanceUrl", "accessToken", "siteId"])
  Object.entries(body.credentials ?? {}).forEach(([k, v]) => {
    if (ALLOWED_KEYS.has(k) && typeof v === "string") cleanCreds[k] = v.trim()
  })

  const cleanConfig: Record<string, string> = {}
  Object.entries(body.config ?? {}).forEach(([k, v]) => {
    if (ALLOWED_KEYS.has(k) && typeof v === "string") cleanConfig[k] = v.trim()
  })

  const integration = await db.integration.upsert({
    where: { userId_connector: { userId: session.user.id, connector: body.connector } },
    create: {
      userId: session.user.id,
      connector: body.connector,
      credentials: JSON.stringify(cleanCreds),
      config: JSON.stringify(cleanConfig),
      status: "disconnected",
    },
    update: {
      credentials: JSON.stringify(cleanCreds),
      config: JSON.stringify(cleanConfig),
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
