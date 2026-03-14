import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getProviderKeyStatus } from "@/lib/api-key-resolver"

const PROVIDER_SETTING_KEYS: Record<string, string> = {
  anthropic: "ai_anthropic_key",
  openai: "ai_openai_key",
  deepseek: "ai_deepseek_key",
  gemini: "ai_gemini_key",
}

// GET /api/admin/settings — returns boolean map, never raw keys
export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const status = await getProviderKeyStatus()
  return NextResponse.json(status)
}

// PUT /api/admin/settings — upsert a single provider key
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { provider, key } = await req.json() as { provider: string; key: string }

  if (!provider || !key?.trim()) {
    return NextResponse.json({ error: "provider and key are required" }, { status: 400 })
  }

  const settingKey = PROVIDER_SETTING_KEYS[provider]
  if (!settingKey) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 })
  }

  await db.systemSetting.upsert({
    where: { key: settingKey },
    create: { key: settingKey, value: key.trim() },
    update: { value: key.trim() },
  })

  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/settings — remove a provider key
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { provider } = await req.json() as { provider: string }
  const settingKey = PROVIDER_SETTING_KEYS[provider]
  if (!settingKey) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 })
  }

  await db.systemSetting.deleteMany({ where: { key: settingKey } })
  return NextResponse.json({ ok: true })
}
