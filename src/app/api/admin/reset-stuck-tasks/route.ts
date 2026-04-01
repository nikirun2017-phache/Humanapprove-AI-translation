import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// POST /api/admin/reset-stuck-tasks
// Marks all pending/running tasks older than 15 minutes as failed
export async function POST() {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - 15 * 60 * 1000)

  const result = await db.translationTask.updateMany({
    where: {
      status: { in: ["pending", "running"] },
      updatedAt: { lt: cutoff },
    },
    data: { status: "failed", errorMessage: "Reset: task was stuck (auth issue before 2026-04-01 fix)" },
  })

  return NextResponse.json({ reset: result.count })
}
