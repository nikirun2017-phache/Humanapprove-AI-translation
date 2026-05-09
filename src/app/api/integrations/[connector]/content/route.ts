import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import * as Pendo from "@/lib/connectors/pendo"
import * as Webflow from "@/lib/connectors/webflow"
import * as Salesforce from "@/lib/connectors/salesforce"

// GET /api/integrations/[connector]/content — list importable content items
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ connector: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { connector } = await params

  const integration = await db.integration.findUnique({
    where: { userId_connector: { userId: session.user.id, connector } },
  })
  if (!integration || integration.status !== "connected") {
    return NextResponse.json({ error: "Integration not connected" }, { status: 400 })
  }

  let creds: Record<string, string> = {}
  let config: Record<string, string> = {}
  try { creds = JSON.parse(integration.credentials) } catch { /* */ }
  try { config = JSON.parse(integration.config) } catch { /* */ }

  try {
    if (connector === "pendo") {
      const items = await Pendo.listContent(creds.apiKey ?? "")
      return NextResponse.json(items)
    }
    if (connector === "webflow") {
      const siteId = config.siteId ?? req.nextUrl.searchParams.get("siteId") ?? ""
      if (!siteId) {
        // Return list of sites first so user can pick one
        const sites = await Webflow.listSites(creds.apiKey ?? "")
        return NextResponse.json({ sites, items: [] })
      }
      const items = await Webflow.listContent(creds.apiKey ?? "", siteId)
      return NextResponse.json({ items })
    }
    if (connector === "salesforce") {
      const items = await Salesforce.listContent(creds.instanceUrl ?? config.instanceUrl ?? "", creds.accessToken ?? "")
      return NextResponse.json(items)
    }
    return NextResponse.json({ error: "Unknown connector" }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
