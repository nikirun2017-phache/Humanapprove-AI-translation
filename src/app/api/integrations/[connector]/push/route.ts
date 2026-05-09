import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import * as Pendo from "@/lib/connectors/pendo"
import * as Webflow from "@/lib/connectors/webflow"
import * as Salesforce from "@/lib/connectors/salesforce"

interface PushBody {
  jobId: string
  targetLanguage: string // which translation task to push
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
    include: {
      tasks: { where: { targetLanguage: body.targetLanguage } },
    },
  })

  if (!job || (session.user.role !== "admin" && job.createdById !== session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const task = job.tasks[0]
  if (!task || task.status !== "completed") {
    return NextResponse.json({ error: "Translation not completed yet" }, { status: 400 })
  }

  // Parse integration meta to find the content ID
  let meta: Record<string, unknown> = {}
  try { meta = JSON.parse(job.integrationMeta ?? "{}") } catch { /* */ }

  const contentId = meta.contentId as string | undefined
  if (!contentId) {
    return NextResponse.json({ error: "Job has no integration content ID" }, { status: 400 })
  }

  // Fetch the integration credentials
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

  // Parse XLIFF data to extract translated strings
  // The XLIFF contains <target> elements with the translated text.
  // We rebuild the same key→text map as the original import.
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

  // ── Push to CMS ──────────────────────────────────────────────────────────
  try {
    if (connector === "pendo") {
      const guide = await Pendo.fetchGuide(creds.apiKey ?? "", contentId)
      const updated = Pendo.mergeTranslationsIntoGuide(guide, translations)
      await Pendo.pushTranslation(creds.apiKey ?? "", updated)
    } else if (connector === "webflow") {
      const siteId = (meta.siteId as string | undefined) ?? config.siteId ?? ""
      const collectionId = contentId
      // Group translations by item
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
        await Webflow.patchItem(creds.apiKey ?? "", collectionId, itemId, fields)
      }
    } else if (connector === "salesforce") {
      await Salesforce.pushTranslation(
        creds.instanceUrl ?? config.instanceUrl ?? "",
        creds.accessToken ?? "",
        contentId,
        translations
      )
    } else {
      return NextResponse.json({ error: "Unknown connector" }, { status: 400 })
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }

  return NextResponse.json({ ok: true, pushedStrings: Object.keys(translations).length })
}
