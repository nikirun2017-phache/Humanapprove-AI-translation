import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { parseJsonSource } from "@/lib/source-parser"
import { resolveApiKey } from "@/lib/api-key-resolver"
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

interface ImportBody {
  contentId: string
  contentName: string
  targetLanguages: string[]
  sourceLanguage?: string
  provider: string
  model: string
  siteId?: string
}

// POST /api/integrations/[connector]/import — pull content from CMS and create a translation job
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ connector: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role === "reviewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { connector } = await params
  const body = await req.json() as ImportBody

  if (!body.contentId || !body.targetLanguages?.length || !body.provider || !body.model) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

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

  // ── Fetch content from CMS ───────────────────────────────────────────────
  let jsonContent: Record<string, string> = {}
  try {
    switch (connector) {
      case "pendo":
        jsonContent = Pendo.guideToJson(await Pendo.fetchGuide(creds.apiKey ?? "", body.contentId))
        break
      case "webflow": {
        const siteId = body.siteId ?? config.siteId ?? ""
        jsonContent = Webflow.itemsToJson(await Webflow.fetchCollectionItems(creds.apiKey ?? "", body.contentId))
        break
      }
      case "salesforce":
        jsonContent = await Salesforce.fetchContent(creds.instanceUrl ?? config.instanceUrl ?? "", creds.accessToken ?? "", body.contentId)
        break
      case "zendesk":
        jsonContent = await Zendesk.fetchContent(creds.subdomain ?? "", creds.email ?? "", creds.apiToken ?? "", body.contentId)
        break
      case "contentful":
        jsonContent = await Contentful.fetchContent(creds.spaceId ?? "", creds.accessToken ?? "", config.environmentId || "master", body.contentId)
        break
      case "wordpress":
        jsonContent = await WordPress.fetchContent(creds.siteUrl ?? "", creds.username ?? "", creds.applicationPassword ?? "", body.contentId)
        break
      case "hubspot":
        jsonContent = await HubSpot.fetchContent(creds.apiToken ?? "", body.contentId)
        break
      case "jira":
        jsonContent = await Jira.fetchContent(creds.cloudUrl ?? "", creds.email ?? "", creds.apiToken ?? "", body.contentId)
        break
      case "slack":
        jsonContent = await Slack.fetchContent(creds.botToken ?? "", body.contentId)
        break
      case "qualtrics":
        jsonContent = await Qualtrics.fetchContent(creds.apiToken ?? "", creds.dataCenter ?? "", body.contentId)
        break
      case "marketo":
        jsonContent = await Marketo.fetchContent(creds.munchkinId ?? "", creds.clientId ?? "", creds.clientSecret ?? "", body.contentId)
        break
      case "googledrive":
        jsonContent = await GoogleDrive.fetchContent(creds.accessToken ?? "", body.contentId)
        break
      case "sharepoint":
        jsonContent = await SharePoint.fetchContent(creds.accessToken ?? "", body.contentId)
        break
      default:
        return NextResponse.json({ error: "Unknown connector" }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ error: `Failed to fetch content: ${(err as Error).message}` }, { status: 502 })
  }

  if (Object.keys(jsonContent).length === 0) {
    return NextResponse.json({ error: "No translatable text found in this content item" }, { status: 400 })
  }

  // ── Parse into source units ──────────────────────────────────────────────
  const jsonStr = JSON.stringify(
    Object.entries(jsonContent).map(([id, text]) => ({ id, text }))
  )
  let units
  try {
    units = parseJsonSource(jsonStr)
  } catch (err) {
    return NextResponse.json({ error: `Parse error: ${(err as Error).message}` }, { status: 400 })
  }

  // ── Resolve provider API key ─────────────────────────────────────────────
  let apiKey: string
  try {
    apiKey = await resolveApiKey(body.provider, "")
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  const sourceLanguage = body.sourceLanguage ?? "en-US"
  const label = connector.charAt(0).toUpperCase() + connector.slice(1)
  const safeName = `[${label}] ${body.contentName}`.slice(0, 200)

  // ── Create TranslationJob + tasks ────────────────────────────────────────
  const job = await db.translationJob.create({
    data: {
      name: safeName,
      createdById: session.user.id,
      sourceFileUrl: "",
      unitsFileUrl: "",
      unitsData: JSON.stringify(units),
      sourceData: jsonStr,
      sourceFormat: "json",
      sourceLanguage,
      provider: body.provider,
      model: body.model,
      status: "pending",
      integrationId: integration.id,
      integrationMeta: JSON.stringify({
        connector,
        contentId: body.contentId,
        contentName: body.contentName,
        siteId: body.siteId ?? config.siteId ?? null,
        rawJson: jsonContent,
      }),
    },
  })

  await db.translationTask.createMany({
    data: body.targetLanguages.map((lang: string) => ({
      jobId: job.id,
      targetLanguage: lang,
      status: "pending",
      totalUnits: units.length,
      wordCount: units.reduce((s, u) => s + u.sourceText.split(/\s+/).filter(Boolean).length, 0),
    })),
  })

  await db.systemSetting.upsert({
    where: { key: `ai_job_key_${job.id}` },
    create: { key: `ai_job_key_${job.id}`, value: apiKey },
    update: { value: apiKey },
  })

  return NextResponse.json({ jobId: job.id })
}
