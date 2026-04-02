// SERVER-ONLY — delivers signed webhook payloads to caller-supplied callback URLs
import { createHmac } from "crypto"

export interface WebhookPayload {
  event: "job.completed" | "job.failed"
  jobId: string
  name: string
  status: string
  tasks: Array<{
    taskId: string
    targetLanguage: string
    status: string
    downloadUrl: string
  }>
  timestamp: string
}

/**
 * Fire-and-forget: POST the payload to callbackUrl with an HMAC-SHA256 signature header.
 * Failures are logged but never throw — webhooks are best-effort.
 *
 * Consumers verify the signature:
 *   const sig = req.headers['x-summon-signature-256']  // "sha256=<hex>"
 *   const expected = 'sha256=' + createHmac('sha256', WEBHOOK_SIGNING_SECRET).update(body).digest('hex')
 *   if (sig !== expected) reject()
 */
export function fireWebhook(callbackUrl: string, payload: WebhookPayload): void {
  const secret = process.env.WEBHOOK_SIGNING_SECRET
  if (!secret) {
    console.warn("[webhook] WEBHOOK_SIGNING_SECRET not set — skipping callback to", callbackUrl)
    return
  }

  const body = JSON.stringify(payload)
  const signature = "sha256=" + createHmac("sha256", secret).update(body).digest("hex")

  void fetch(callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Summon-Signature-256": signature,
      "User-Agent": "SummonTranslator-Webhook/1.0",
    },
    body,
    signal: AbortSignal.timeout(10_000), // 10 s timeout
  })
    .then(res => {
      if (!res.ok) {
        console.warn(`[webhook] Callback to ${callbackUrl} returned ${res.status}`)
      }
    })
    .catch(err => {
      console.warn(`[webhook] Callback to ${callbackUrl} failed:`, (err as Error).message)
    })
}
