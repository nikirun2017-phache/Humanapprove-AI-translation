// SERVER-ONLY — never import this from a "use client" module
import { db } from "./db"

const PROVIDER_SETTING_KEYS: Record<string, string> = {
  anthropic: "ai_anthropic_key",
  openai: "ai_openai_key",
  deepseek: "ai_deepseek_key",
  gemini: "ai_gemini_key",
}

/**
 * Resolves the API key for a provider.
 * Priority: job-scoped session key → system-wide admin key.
 * Throws if no key is available.
 */
export async function resolveApiKey(
  provider: string,
  jobId: string
): Promise<string> {
  // 1. Job-scoped key (stored temporarily when job was created with user-provided key)
  const jobKeySetting = await db.systemSetting.findUnique({
    where: { key: `ai_job_key_${jobId}` },
  })
  if (jobKeySetting?.value) return jobKeySetting.value

  // 2. System-wide admin key
  const settingKey = PROVIDER_SETTING_KEYS[provider]
  if (settingKey) {
    const setting = await db.systemSetting.findUnique({ where: { key: settingKey } })
    if (setting?.value) return setting.value
  }

  throw new Error(
    `No API key configured for provider "${provider}". ` +
      `Please set one in Admin → Settings or provide it when creating the job.`
  )
}

/**
 * Returns a boolean map of which providers have a system key configured.
 */
export async function getProviderKeyStatus(): Promise<Record<string, boolean>> {
  const keys = Object.values(PROVIDER_SETTING_KEYS)
  const settings = await db.systemSetting.findMany({ where: { key: { in: keys } } })
  const set = new Set(settings.filter((s: (typeof settings)[number]) => s.value).map((s: (typeof settings)[number]) => s.key))
  return Object.fromEntries(
    Object.entries(PROVIDER_SETTING_KEYS).map(([provider, key]) => [provider, set.has(key)])
  )
}
