"use client"

import { useLocale, useTranslations } from "next-intl"
import { useRouter, usePathname } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"
import { useTransition } from "react"

const LOCALE_LABELS: Record<string, string> = {
  "en-US": "English (US)",
  "en-GB": "English (UK)",
  "en-AU": "English (AU)",
  "en-CA": "English (CA)",
  "en-IN": "English (IN)",
  "es-ES": "Español (ES)",
  "es-419": "Español (LA)",
  "pt-BR": "Português (BR)",
  "fr-FR": "Français (FR)",
  "fr-CA": "Français (CA)",
  "de-DE": "Deutsch",
  "it-IT": "Italiano",
  "nl-NL": "Nederlands",
  "sv-SE": "Svenska",
  "ja-JP": "日本語",
  "zh-CN": "中文（简体）",
  "zh-TW": "中文（繁體）",
  "ko-KR": "한국어",
  "th-TH": "ภาษาไทย",
}

export function LocaleSwitcher() {
  const t = useTranslations("langSwitcher")
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as (typeof routing.locales)[number]
    startTransition(() => {
      router.replace(pathname, { locale: next })
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-400 hidden sm:inline">{t("label")}</span>
      <select
        value={locale}
        onChange={handleChange}
        disabled={isPending}
        className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
        aria-label={t("label")}
      >
        {routing.locales.map((l: (typeof routing.locales)[number]) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l] ?? l}
          </option>
        ))}
      </select>
    </div>
  )
}
