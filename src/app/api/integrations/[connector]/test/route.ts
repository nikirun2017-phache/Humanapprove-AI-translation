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
import * as GitHub from "@/lib/connectors/github"
import * as GitLab from "@/lib/connectors/gitlab"
import * as Shopify from "@/lib/connectors/shopify"
import * as Notion from "@/lib/connectors/notion"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ connector: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { connector } = await params

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

  try {
    switch (connector) {
      case "pendo":
        result = await Pendo.testConnection(creds.apiKey ?? "")
        break
      case "webflow":
        result = await Webflow.testConnection(creds.apiKey ?? "")
        break
      case "salesforce":
        result = await Salesforce.testConnection(creds.instanceUrl ?? config.instanceUrl ?? "", creds.accessToken ?? "")
        break
      case "zendesk":
        result = await Zendesk.testConnection(creds.subdomain ?? "", creds.email ?? "", creds.apiToken ?? "")
        break
      case "contentful":
        result = await Contentful.testConnection(creds.spaceId ?? "", creds.accessToken ?? "")
        break
      case "wordpress":
        result = await WordPress.testConnection(creds.siteUrl ?? "", creds.username ?? "", creds.applicationPassword ?? "")
        break
      case "hubspot":
        result = await HubSpot.testConnection(creds.apiToken ?? "")
        break
      case "jira":
        result = await Jira.testConnection(creds.cloudUrl ?? "", creds.email ?? "", creds.apiToken ?? "")
        break
      case "slack":
        result = await Slack.testConnection(creds.botToken ?? "")
        break
      case "qualtrics":
        result = await Qualtrics.testConnection(creds.apiToken ?? "", creds.dataCenter ?? "")
        break
      case "marketo":
        result = await Marketo.testConnection(creds.munchkinId ?? "", creds.clientId ?? "", creds.clientSecret ?? "")
        break
      case "googledrive":
        result = await GoogleDrive.testConnection(creds.accessToken ?? "")
        break
      case "sharepoint":
        result = await SharePoint.testConnection(creds.siteUrl ?? "", creds.accessToken ?? "")
        break
      case "github":
        result = await GitHub.testConnection(creds.apiToken ?? "")
        break
      case "gitlab":
        result = await GitLab.testConnection(creds.apiToken ?? "")
        break
      case "shopify":
        result = await Shopify.testConnection(creds.shop ?? "", creds.accessToken ?? "")
        break
      case "notion":
        result = await Notion.testConnection(creds.token ?? "")
        break
      default:
        return NextResponse.json({ error: "Unknown connector" }, { status: 400 })
    }
  } catch (err) {
    result = { ok: false, error: (err as Error).message }
  }

  await db.integration.update({
    where: { userId_connector: { userId: session.user.id, connector } },
    data: { status: result.ok ? "connected" : "error", lastTestedAt: new Date() },
  })

  return NextResponse.json(result)
}
