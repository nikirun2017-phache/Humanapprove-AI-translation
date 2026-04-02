import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.summontranslator.com"

  if (!token) {
    return NextResponse.redirect(`${appUrl}/login?verified=invalid`)
  }

  const record = await db.verificationToken.findUnique({ where: { token } })

  if (!record) {
    return NextResponse.redirect(`${appUrl}/login?verified=invalid`)
  }

  if (record.expires < new Date()) {
    await db.verificationToken.delete({ where: { token } })
    return NextResponse.redirect(`${appUrl}/login?verified=expired&email=${encodeURIComponent(record.identifier)}`)
  }

  // Delete the token — user is now verified
  await db.verificationToken.delete({ where: { token } })

  return NextResponse.redirect(`${appUrl}/login?verified=ok`)
}
