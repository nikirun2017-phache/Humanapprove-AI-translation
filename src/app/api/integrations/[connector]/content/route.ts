import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import * as Pendo from "@/lib/connectors/pendo"
import * as Webflow from "@/lib/connectors/webflow"
import * as Salesforce from "@/lib/connectors/salesforce"
import * as Zendesk from "@/lib/connectors/zendesk"
import * as Contentful from "@/lib/connectors/contentful"
import * as WordPress from "@/lib/connectors/wordpress"
import * as HubSpot from "@/lib/connectors/hubspot"
import * as Jira from "@/lib/connectors/jira"
import * as Slack from "@/lib/connectors/slack"
import * as Qualtrics from "@/lib/connectors/qualtrics"
import * as Marketo from "@/lib/connectors/marketo"
import * as GoogleDrive from "@/lib/connectors/googledrive"
import * as SharePoint from "@/lib/connectors/sharepoint"

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
    switch (connector) {
      case "pendo":
        return NextResponse.json(await Pendo.listContent(creds.apiKey ?? ""))

      case "webflow": {
        const siteId = config.siteId ?? req.nextUrl.searchParams.get("siteId") ?? ""
        if (!siteId) {
          const sites = await Webflow.listSites(creds.apiKey ?? "")
          return NextResponse.json({ sites, items: [] })
        }
        return NextResponse.json({ items: await Webflow.listContent(creds.apiKey ?? "", siteId) })
      }

      case "salesforce":
        return NextResponse.json(await Salesforce.listContent(creds.instanceUrl ?? config.instanceUrl ?? "", creds.accessToken ?? ""))

      case "zendesk":
        return NextResponse.json(await Zendesk.listContent(creds.subdomain ?? "", creds.email ?? "", creds.apiToken ?? ""))

      case "contentful":
        return NextResponse.json(await Contentful.listContent(creds.spaceId ?? "", creds.accessToken ?? "", config.environmentId || "master"))

      case "wordpress":
        return NextResponse.json(await WordPress.listContent(creds.siteUrl ?? "", creds.username ?? "", creds.applicationPassword ?? ""))

      case "hubspot":
        return NextResponse.json(await HubSpot.listContent(creds.apiToken ?? ""))

      case "jira":
        return NextResponse.json(await Jira.listContent(creds.cloudUrl ?? "", creds.email ?? "", creds.apiToken ?? "", config.projectKey || undefined))

      case "slack":
        return NextResponse.json(await Slack.listContent(creds.botToken ?? "", config.channelId || undefined))

      case "qualtrics":
        return NextResponse.json(await Qualtrics.listContent(creds.apiToken ?? "", creds.dataCenter ?? ""))

      case "marketo":
        return NextResponse.json(await Marketo.listContent(creds.munchkinId ?? "", creds.clientId ?? "", creds.clientSecret ?? ""))

      case "googledrive":
        return NextResponse.json(await GoogleDrive.listContent(creds.accessToken ?? "", config.folderId || undefined))

      case "sharepoint":
        return NextResponse.json(await SharePoint.listContent(creds.siteUrl ?? "", creds.accessToken ?? ""))

      default:
        return NextResponse.json({ error: "Unknown connector" }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
