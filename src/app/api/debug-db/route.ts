import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const count = await db.user.count()
    const sample = await db.user.findFirst({ select: { email: true, role: true } })
    return NextResponse.json({ ok: true, userCount: count, sample, dbUrl: process.env.DATABASE_URL?.slice(0, 50) + "..." })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) })
  }
}
