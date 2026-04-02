/**
 * Email utility — supports two providers in priority order:
 *   1. Resend (RESEND_API_KEY) — preferred for custom domains
 *   2. Gmail SMTP (GMAIL_USER + GMAIL_APP_PASSWORD) — fallback, works with any Gmail
 *
 * Required env vars (at least one set):
 *   RESEND_API_KEY        — Resend API key (re_...)
 *   RESEND_FROM           — sender address, defaults to "Summon Translator <noreply@jendee.ai>"
 *   GMAIL_USER            — Gmail address (e.g. you@gmail.com)
 *   GMAIL_APP_PASSWORD    — Gmail App Password (16 chars, no spaces)
 *
 * If neither is configured, all functions silently return — safe for local dev.
 */

const RESEND_API = "https://api.resend.com/emails"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "https://summontranslator.com"
const BRAND = "Summon Translator"
const SUPPORT_EMAIL = "support@summontranslator.com"

function from(): string {
  return process.env.RESEND_FROM ?? `${BRAND} <${SUPPORT_EMAIL}>`
}

async function sendViaGmail(to: string, subject: string, html: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodemailer = require("nodemailer") as typeof import("nodemailer")
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, ""),
    },
  })
  await transporter.sendMail({
    from: `${BRAND} <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  })
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY
  const gmailUser = process.env.GMAIL_USER
  const gmailPass = process.env.GMAIL_APP_PASSWORD

  // Try Resend first
  if (resendKey) {
    try {
      const res = await fetch(RESEND_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({ from: from(), to, subject, html }),
      })
      if (!res.ok) {
        console.error("[email] Resend error", res.status, await res.text())
      }
      return
    } catch (err) {
      console.error("[email] Resend failed, trying Gmail fallback:", err)
    }
  }

  // Fall back to Gmail SMTP
  if (gmailUser && gmailPass) {
    try {
      await sendViaGmail(to, subject, html)
      return
    } catch (err) {
      console.error("[email] Gmail SMTP failed to send to", to, err)
    }
    return
  }

  // Neither configured — skip silently (local dev)
  console.warn("[email] No email provider configured — skipping send to", to)
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

function layout(body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
        <tr>
          <td style="background:#4f46e5;padding:20px 32px">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.5px">${BRAND}</span>
          </td>
        </tr>
        <tr><td style="padding:32px">${body}</td></tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px">
            <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5">
              ${BRAND} · AI-powered translation<br>
              <a href="${APP_URL}/privacy" style="color:#9ca3af">Privacy Policy</a> ·
              <a href="${APP_URL}/terms" style="color:#9ca3af">Terms of Service</a> ·
              <a href="mailto:${SUPPORT_EMAIL}" style="color:#9ca3af">${SUPPORT_EMAIL}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function btn(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;margin:20px 0">${text}</a>`
}

// ---------------------------------------------------------------------------
// Exported send functions
// ---------------------------------------------------------------------------

export async function sendWelcomeEmail(name: string, email: string): Promise<void> {
  const html = layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">Welcome, ${name}!</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6">
      Your Summon Translator account is ready. Upload a file, pick your target languages, and get
      AI-translated results in minutes — no setup required.
    </p>
    ${btn("Go to Translation Studio", `${APP_URL}/translation-studio`)}
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;line-height:1.6">
      Use code <strong>1TIME</strong> at checkout to translate your first 1,000 words free.
    </p>
  `)
  await send(email, "Welcome to Summon Translator", html)
}

export async function sendJobCompleteEmail(
  name: string,
  email: string,
  jobName: string,
  languages: string[],
  jobId: string,
  durationSecs?: number
): Promise<void> {
  const jobUrl = `${APP_URL}/translation-studio/${jobId}`

  // Format the list of target languages
  const langRows = languages
    .map(
      (l) =>
        `<tr>
          <td style="padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:14px;color:#374151">
            <span style="display:inline-block;width:8px;height:8px;background:#4f46e5;border-radius:50%;margin-right:10px;vertical-align:middle"></span>${l}
          </td>
          <td style="padding:6px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#059669;text-align:right;white-space:nowrap">
            ✓ Ready
          </td>
        </tr>`
    )
    .join("")

  const durationNote =
    durationSecs && durationSecs >= 60
      ? `<p style="margin:0 0 20px;font-size:13px;color:#6b7280;line-height:1.6">
           Translation completed in approximately <strong>${Math.round(durationSecs / 60)} minute${Math.round(durationSecs / 60) !== 1 ? "s" : ""}</strong>.
           Large or complex files may take longer — thank you for your patience.
         </p>`
      : ""

  const html = layout(`
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111827">Your translation is ready</h1>
    <p style="margin:0 0 20px;font-size:15px;color:#6b7280">Job completed successfully</p>

    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6">
      Hi <strong>${name}</strong>, your translation job <strong>&ldquo;${jobName}&rdquo;</strong> has
      finished processing. The files below are ready for download in your Translation Studio.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;border-spacing:0">
      <thead>
        <tr style="background:#f9fafb">
          <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#6b7280;text-align:left;text-transform:uppercase;letter-spacing:0.05em">Target language</th>
          <th style="padding:8px 12px;font-size:11px;font-weight:600;color:#6b7280;text-align:right;text-transform:uppercase;letter-spacing:0.05em">Status</th>
        </tr>
      </thead>
      <tbody style="padding:0 12px">${langRows}</tbody>
    </table>

    ${durationNote}

    ${btn("View &amp; Download Files", jobUrl)}

    <p style="margin:20px 0 0;font-size:13px;color:#6b7280;line-height:1.6">
      You can also access your files anytime from the
      <a href="${APP_URL}/translation-studio" style="color:#4f46e5;text-decoration:none;font-weight:500">Translation Studio dashboard</a>.
      Sign in is required to download translated files.
    </p>
    <p style="margin:12px 0 0;font-size:12px;color:#9ca3af">
      Job reference: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">${jobId}</code>
    </p>
  `)
  await send(email, `Translation ready: ${jobName}`, html)
}

export async function sendVerificationEmail(email: string, verifyUrl: string): Promise<void> {
  const html = layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">Verify your email</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6">
      Thanks for signing up for Summon Translator! Click the button below to verify your email address
      and activate your account. This link expires in <strong>24 hours</strong>.
    </p>
    ${btn("Verify my email", verifyUrl)}
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;line-height:1.6">
      If you didn't create an account with Summon Translator, you can safely ignore this email.
    </p>
  `)
  await send(email, "Verify your Summon Translator email address", html)
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  const html = layout(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827">Reset your password</h1>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6">
      We received a request to reset the password for your Summon Translator account.
      Click the button below — this link expires in <strong>1 hour</strong>.
    </p>
    ${btn("Reset password", resetUrl)}
    <p style="margin:16px 0 0;font-size:13px;color:#6b7280;line-height:1.6">
      If you didn't request this, you can safely ignore this email.
      Your password will not change.
    </p>
  `)
  await send(email, "Reset your Summon Translator password", html)
}
