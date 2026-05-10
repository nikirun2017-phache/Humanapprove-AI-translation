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

interface PushBody {
  jobId: string
  targetLanguage: string
}

// POST /api/integrations/[connector]/push — push a completed translation back to CMS
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ connector: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { connector } = await params
  const body = await req.json() as PushBody

  if (!body.jobId || !body.targetLanguage) {
    return NextResponse.json({ error: "Missing jobId or targetLanguage" }, { status: 400 })
  }

  const job = await db.translationJob.findUnique({
    where: { id: body.jobId },
    include: { tasks: { where: { targetLanguage: body.targetLanguage } } },
  })

  if (!job || (session.user.role !== "admin" && job.createdById !== session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const task = job.tasks[0]
  if (!task || task.status !== "completed") {
    return NextResponse.json({ error: "Translation not completed yet" }, { status: 400 })
  }

  let meta: Record<string, unknown> = {}
  try { meta = JSON.parse(job.integrationMeta ?? "{}") } catch { /* */ }

  const contentId = meta.contentId as string | undefined
  if (!contentId) {
    return NextResponse.json({ error: "Job has no integration content ID" }, { status: 400 })
  }

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

  // Extract translated strings from XLIFF
  const xliff = task.xliffData ?? ""
  const translations: Record<string, string> = {}
  const unitRe = /<trans-unit[^>]+id="([^"]+)"[^>]*>[\s\S]*?<target[^>]*>([\s\S]*?)<\/target>/g
  let match
  while ((match = unitRe.exec(xliff)) !== null) {
    const id = match[1]
    const text = match[2].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim()
    translations[id] = text
  }

  if (Object.keys(translations).length === 0) {
    return NextResponse.json({ error: "No translated strings found in job" }, { status: 400 })
  }

  const targetLanguage = body.targetLanguage

  try {
    switch (connector) {
      case "pendo": {
        const guide = await Pendo.fetchGuide(creds.apiKey ?? "", contentId)
        await Pendo.pushTranslation(creds.apiKey ?? "", Pendo.mergeTranslationsIntoGuide(guide, translations))
        break
      }
      case "webflow": {
        const siteId = (meta.siteId as string | undefined) ?? config.siteId ?? ""
        const byItem: Record<string, Record<string, string>> = {}
        Object.entries(translations).forEach(([key, val]) => {
          const parts = key.match(/^item_([^_]+)_(.+)$/)
          if (parts) {
            const [, itemId, field] = parts
            byItem[itemId] = byItem[itemId] ?? {}
            byItem[itemId][field] = val
          }
        })
        for (const [itemId, fields] of Object.entries(byItem)) {
          await Webflow.patchItem(creds.apiKey ?? "", contentId, itemId, fields)
        }
        break
      }
      case "salesforce":
        await Salesforce.pushTranslation(creds.instanceUrl ?? config.instanceUrl ?? "", creds.accessToken ?? "", contentId, translations)
        break
      case "zendesk":
        await Zendesk.pushTranslation(creds.subdomain ?? "", creds.email ?? "", creds.apiToken ?? "", contentId, targetLanguage, translations)
        break
      case "contentful":
        await Contentful.pushTranslation(creds.spaceId ?? "", creds.accessToken ?? "", config.environmentId || "master", contentId, targetLanguage, translations)
        break
      case "wordpress":
        await WordPress.pushTranslation(creds.siteUrl ?? "", creds.username ?? "", creds.applicationPassword ?? "", contentId, targetLanguage, translations)
        break
      case "hubspot":
        await HubSpot.pushTranslation(creds.apiToken ?? "", targetLanguage, translations)
        break
      case "jira":
        await Jira.pushTranslation(creds.cloudUrl ?? "", creds.email ?? "", creds.apiToken ?? "", contentId, targetLanguage, translations)
        break
      case "slack": {
        const targetChannelId = config.channelId ?? contentId.split("::")?.[0] ?? contentId
        await Slack.pushTranslation(creds.botToken ?? "", targetChannelId, translations)
        break
      }
      case "qualtrics":
        await Qualtrics.pushTranslation(creds.apiToken ?? "", creds.dataCenter ?? "", contentId, targetLanguage, translations)
        break
      case "marketo":
        await Marketo.pushTranslation(creds.munchkinId ?? "", creds.clientId ?? "", creds.clientSecret ?? "", contentId, targetLanguage, translations)
        break
      case "googledrive":
        await GoogleDrive.pushTranslation(creds.accessToken ?? "", config.folderId || undefined, contentId, targetLanguage, translations)
        break
      case "sharepoint":
        await SharePoint.pushTranslation(creds.accessToken ?? "", contentId, targetLanguage, translations)
        break
      default:
        return NextResponse.json({ error: "Unknown connector" }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }

  return NextResponse.json({ ok: true, pushedStrings: Object.keys(translations).length })
}
