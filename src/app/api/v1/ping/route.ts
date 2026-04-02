import { NextRequest, NextResponse } from "next/server"
import { resolveAuth } from "@/lib/resolve-auth"

// GET /api/v1/ping — verify that an API key is valid without creating a job
export async function GET(req: NextRequest) {
  const auth = await resolveAuth(req)
  if (auth.kind === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized — provide a valid API key as Bearer token" }, { status: 401 })
  }

  return NextResponse.json({
    ok: true,
    version: "1",
    userId: auth.user.id,
    authKind: auth.kind,
  })
}
