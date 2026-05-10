/**
 * Slack connector — channel messages and announcements.
 *
 * Auth: Bot token (xoxb-…).
 * Flow: list channels → import pinned/recent messages → push translated
 *       message to a designated locale-specific channel.
 * Docs: https://api.slack.com/web
 */

export interface ContentItem {
  id: string
  name: string
  state: string
  itemCount: number
}

const BASE = "https://slack.com/api"

function headers(botToken: string): Record<string, string> {
  return { Authorization: `Bearer ${botToken}`, "Content-Type": "application/json; charset=utf-8" }
}

export async function testConnection(botToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE}/auth.test`, {
      method: "POST",
      headers: headers(botToken),
      signal: AbortSignal.timeout(10_000),
    })
    const data = await res.json() as { ok: boolean; error?: string; team?: string }
    if (data.ok) return { ok: true }
    return { ok: false, error: data.error ?? "Invalid bot token" }
  } catch (err) {
    return { ok: false, error: `Connection failed: ${(err as Error).message}` }
  }
}

async function listChannels(botToken: string): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch(`${BASE}/conversations.list?types=public_channel,private_channel&limit=200`, {
    headers: headers(botToken),
    signal: AbortSignal.timeout(15_000),
  })
  const data = await res.json() as { ok: boolean; channels: Array<{ id: string; name: string; is_member: boolean }> }
  return (data.channels ?? []).filter((c) => c.is_member)
}

export async function listContent(botToken: string, channelId?: string): Promise<ContentItem[]> {
  const channels = await listChannels(botToken)
  if (channels.length === 0) throw new Error("Bot is not a member of any channels — invite the bot to at least one channel first")

  // If a specific channel is configured, fetch its recent messages
  if (channelId) {
    const res = await fetch(`${BASE}/conversations.history?channel=${channelId}&limit=20`, {
      headers: headers(botToken),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await res.json() as { ok: boolean; messages: Array<{ ts: string; text: string; subtype?: string }> }
    const msgs = (data.messages ?? []).filter((m) => !m.subtype && m.text?.trim())
    return msgs.map((m, i) => ({
      id: `${channelId}::${m.ts}`,
      name: m.text.slice(0, 80),
      state: "message",
      itemCount: 1,
    }))
  }

  // Otherwise list channels as content items so user can pick one
  return channels.map((c) => ({
    id: `channel::${c.id}`,
    name: `#${c.name}`,
    state: "channel",
    itemCount: 0,
  }))
}

export async function fetchContent(botToken: string, contentId: string): Promise<Record<string, string>> {
  // contentId can be "channel::C123" (show messages) or "channelId::ts" (one message)
  const [type, ...rest] = contentId.split("::")
  if (type === "channel") {
    const channelId = rest[0]
    const res = await fetch(`${BASE}/conversations.history?channel=${channelId}&limit=10`, {
      headers: headers(botToken),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await res.json() as { ok: boolean; messages: Array<{ ts: string; text: string; subtype?: string }> }
    const msgs = (data.messages ?? []).filter((m) => !m.subtype && m.text?.trim())
    const result: Record<string, string> = {}
    msgs.forEach((m, i) => { result[`message_${i + 1}`] = m.text.trim() })
    return result
  }
  // Single message: channelId::ts
  const [channelId, ts] = rest
  const res = await fetch(`${BASE}/conversations.history?channel=${channelId}&latest=${ts}&limit=1&inclusive=true`, {
    headers: headers(botToken),
    signal: AbortSignal.timeout(15_000),
  })
  const data = await res.json() as { messages: Array<{ text: string }> }
  return { message: data.messages?.[0]?.text ?? "" }
}

export async function pushTranslation(botToken: string, channelId: string, translations: Record<string, string>): Promise<void> {
  const text = Object.values(translations).join("\n\n")
  const body = { channel: channelId, text }
  const res = await fetch(`${BASE}/chat.postMessage`, {
    method: "POST",
    headers: headers(botToken),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  const data = await res.json() as { ok: boolean; error?: string }
  if (!data.ok) throw new Error(`Slack post message failed: ${data.error}`)
}
