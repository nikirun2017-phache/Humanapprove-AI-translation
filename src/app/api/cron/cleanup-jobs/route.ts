import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export const maxDuration = 60

/**
 * POST /api/cron/cleanup-jobs
 * Deletes TranslationJob records (and their cascaded tasks) that are older than 7 days.
 * Only requester-created jobs are removed; admin-created jobs are kept.
 *
 * Secured by CRON_SECRET env var — set Authorization: Bearer <CRON_SECRET> in Cloud Scheduler.
 * Called daily by Google Cloud Scheduler at 03:00 UTC.
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[cleanup-jobs] CRON_SECRET not set")
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
  }
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // Only delete jobs created by requesters (role = "requester").
  // Admin jobs are retained indefinitely.
  const { count } = await db.translationJob.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      createdBy: {
        role: "requester",
      },
    },
  })

  console.log(`[cleanup-jobs] Deleted ${count} jobs older than 7 days (cutoff: ${cutoff.toISOString()})`)
  return NextResponse.json({ deleted: count, cutoff: cutoff.toISOString() })
}
