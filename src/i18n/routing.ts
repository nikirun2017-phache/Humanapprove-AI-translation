import { defineRouting } from "next-intl/routing"

export const routing = defineRouting({
  locales: [
    // Americas
    "en-US",
    "en-CA",
    "es-419",
    "pt-BR",
    "fr-CA",
    // EMEA
    "en-GB",
    "es-ES",
    "de-DE",
    "fr-FR",
    "it-IT",
    "nl-NL",
    "sv-SE",
    // APAC
    "en-AU",
    "en-IN",
    "ja-JP",
    "zh-CN",
    "zh-TW",
    "ko-KR",
    "th-TH",
  ],
  defaultLocale: "en-US",
})
