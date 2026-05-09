import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import * as Pendo from "@/lib/connectors/pendo"
import * as Webflow from "@/lib/connectors/webflow"
import * as Salesforce from "@/lib/connectors/salesforce"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ connector: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { connector } = await params

  // Read credentials from DB (never trust client to send raw keys)
  const integration = await db.integration.findUnique({
    where: { userId_connector: { userId: session.user.id, connector } },
  })
  if (!integration) {
    return NextResponse.json({ error: "Integration not configured" }, { status: 404 })
  }

  let creds: Record<string, string> = {}
  let config: Record<string, string> = {}
  try { creds = JSON.parse(integration.credentials) } catch { /* */ }
  try { config = JSON.parse(integration.config) } catch { /* */ }

  let result: { ok: boolean; error?: string }

  if (connector === "pendo") {
    result = await Pendo.testConnection(creds.apiKey ?? "")
  } else if (connector === "webflow") {
    result = await Webflow.testConnection(creds.apiKey ?? "")
  } else if (connector === "salesforce") {
    result = await Salesforce.testConnection(creds.instanceUrl ?? config.instanceUrl ?? "", creds.accessToken ?? "")
  } else {
    return NextResponse.json({ error: "Unknown connector" }, { status: 400 })
  }

  // Update status in DB
  await db.integration.update({
    where: { userId_connector: { userId: session.user.id, connector } },
    data: {
      status: result.ok ? "connected" : "error",
      lastTestedAt: new Date(),
    },
  })

  return NextResponse.json(result)
}
