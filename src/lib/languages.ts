export interface Language {
  code: string
  name: string
  region: string
}

export const STUDIO_LANGUAGES: Language[] = [
  // European — Western
  { code: "en-GB", name: "English (UK)", region: "European" },
  { code: "fr-FR", name: "French", region: "European" },
  { code: "fr-CA", name: "French (Canada)", region: "European" },
  { code: "de-DE", name: "German", region: "European" },
  { code: "es-ES", name: "Spanish (Spain)", region: "European" },
  { code: "it-IT", name: "Italian", region: "European" },
  { code: "pt-PT", name: "Portuguese (Portugal)", region: "European" },
  { code: "nl-NL", name: "Dutch", region: "European" },
  { code: "sv-SE", name: "Swedish", region: "European" },
  { code: "da-DK", name: "Danish", region: "European" },
  { code: "fi-FI", name: "Finnish", region: "European" },
  { code: "nb-NO", name: "Norwegian (Bokmål)", region: "European" },
  { code: "pl-PL", name: "Polish", region: "European" },
  { code: "cs-CZ", name: "Czech", region: "European" },
  { code: "sk-SK", name: "Slovak", region: "European" },
  { code: "hu-HU", name: "Hungarian", region: "European" },
  { code: "ro-RO", name: "Romanian", region: "European" },
  { code: "hr-HR", name: "Croatian", region: "European" },
  { code: "sl-SI", name: "Slovenian", region: "European" },
  { code: "bg-BG", name: "Bulgarian", region: "European" },
  { code: "el-GR", name: "Greek", region: "European" },
  { code: "lt-LT", name: "Lithuanian", region: "European" },
  { code: "lv-LV", name: "Latvian", region: "European" },
  { code: "et-EE", name: "Estonian", region: "European" },
  { code: "is-IS", name: "Icelandic", region: "European" },
  { code: "mt-MT", name: "Maltese", region: "European" },
  { code: "ga-IE", name: "Irish", region: "European" },
  { code: "cy-GB", name: "Welsh", region: "European" },
  { code: "eu-ES", name: "Basque", region: "European" },
  { code: "ca-ES", name: "Catalan", region: "European" },
  { code: "gl-ES", name: "Galician", region: "European" },
  { code: "sq-AL", name: "Albanian", region: "European" },
  { code: "mk-MK", name: "Macedonian", region: "European" },
  { code: "sr-RS", name: "Serbian", region: "European" },
  { code: "bs-BA", name: "Bosnian", region: "European" },

  // Eastern European / Eurasian
  { code: "ru-RU", name: "Russian", region: "Eastern European" },
  { code: "uk-UA", name: "Ukrainian", region: "Eastern European" },
  { code: "be-BY", name: "Belarusian", region: "Eastern European" },

  // East Asian
  { code: "zh-CN", name: "Chinese (Simplified)", region: "East Asian" },
  { code: "zh-TW", name: "Chinese (Traditional)", region: "East Asian" },
  { code: "zh-HK", name: "Chinese (Hong Kong)", region: "East Asian" },
  { code: "ja-JP", name: "Japanese", region: "East Asian" },
  { code: "ko-KR", name: "Korean", region: "East Asian" },
  { code: "mn-MN", name: "Mongolian", region: "East Asian" },

  // Southeast Asian
  { code: "vi-VN", name: "Vietnamese", region: "Southeast Asian" },
  { code: "th-TH", name: "Thai", region: "Southeast Asian" },
  { code: "id-ID", name: "Indonesian", region: "Southeast Asian" },
  { code: "ms-MY", name: "Malay", region: "Southeast Asian" },
  { code: "tl-PH", name: "Filipino (Tagalog)", region: "Southeast Asian" },
  { code: "km-KH", name: "Khmer", region: "Southeast Asian" },
  { code: "lo-LA", name: "Lao", region: "Southeast Asian" },
  { code: "my-MM", name: "Burmese", region: "Southeast Asian" },

  // South Asian
  { code: "hi-IN", name: "Hindi", region: "South Asian" },
  { code: "bn-BD", name: "Bengali (Bangladesh)", region: "South Asian" },
  { code: "bn-IN", name: "Bengali (India)", region: "South Asian" },
  { code: "ta-IN", name: "Tamil", region: "South Asian" },
  { code: "te-IN", name: "Telugu", region: "South Asian" },
  { code: "mr-IN", name: "Marathi", region: "South Asian" },
  { code: "gu-IN", name: "Gujarati", region: "South Asian" },
  { code: "kn-IN", name: "Kannada", region: "South Asian" },
  { code: "ml-IN", name: "Malayalam", region: "South Asian" },
  { code: "pa-IN", name: "Punjabi", region: "South Asian" },
  { code: "ur-PK", name: "Urdu", region: "South Asian" },
  { code: "si-LK", name: "Sinhala", region: "South Asian" },
  { code: "ne-NP", name: "Nepali", region: "South Asian" },

  // Middle Eastern
  { code: "ar", name: "Arabic", region: "Middle Eastern" },
  { code: "ar-SA", name: "Arabic (Saudi Arabia)", region: "Middle Eastern" },
  { code: "ar-EG", name: "Arabic (Egypt)", region: "Middle Eastern" },
  { code: "he-IL", name: "Hebrew", region: "Middle Eastern" },
  { code: "fa-IR", name: "Persian (Farsi)", region: "Middle Eastern" },
  { code: "tr-TR", name: "Turkish", region: "Middle Eastern" },
  { code: "ku", name: "Kurdish", region: "Middle Eastern" },
  { code: "hy-AM", name: "Armenian", region: "Middle Eastern" },
  { code: "ka-GE", name: "Georgian", region: "Middle Eastern" },
  { code: "az-AZ", name: "Azerbaijani", region: "Middle Eastern" },

  // Central Asian
  { code: "kk-KZ", name: "Kazakh", region: "Central Asian" },
  { code: "uz-UZ", name: "Uzbek", region: "Central Asian" },
  { code: "ky-KG", name: "Kyrgyz", region: "Central Asian" },
  { code: "tk-TM", name: "Turkmen", region: "Central Asian" },
  { code: "tg-TJ", name: "Tajik", region: "Central Asian" },

  // African
  { code: "sw-KE", name: "Swahili", region: "African" },
  { code: "am-ET", name: "Amharic", region: "African" },
  { code: "yo-NG", name: "Yoruba", region: "African" },
  { code: "ig-NG", name: "Igbo", region: "African" },
  { code: "ha-NG", name: "Hausa", region: "African" },
  { code: "zu-ZA", name: "Zulu", region: "African" },
  { code: "af-ZA", name: "Afrikaans", region: "African" },
  { code: "xh-ZA", name: "Xhosa", region: "African" },
  { code: "sn-ZW", name: "Shona", region: "African" },
  { code: "so-SO", name: "Somali", region: "African" },
  { code: "om-ET", name: "Oromo", region: "African" },
  { code: "rw-RW", name: "Kinyarwanda", region: "African" },

  // Americas
  { code: "pt-BR", name: "Portuguese (Brazil)", region: "Americas" },
  { code: "es-MX", name: "Spanish (Mexico)", region: "Americas" },
  { code: "es-AR", name: "Spanish (Argentina)", region: "Americas" },
  { code: "es-CO", name: "Spanish (Colombia)", region: "Americas" },
  { code: "es-CL", name: "Spanish (Chile)", region: "Americas" },
  { code: "es-PE", name: "Spanish (Peru)", region: "Americas" },
  { code: "ht-HT", name: "Haitian Creole", region: "Americas" },
  { code: "qu-PE", name: "Quechua", region: "Americas" },

  // Other
  { code: "en-AU", name: "English (Australia)", region: "Other" },
  { code: "en-IN", name: "English (India)", region: "Other" },
  { code: "en-SG", name: "English (Singapore)", region: "Other" },
  { code: "en-ZA", name: "English (South Africa)", region: "Other" },
  { code: "mi-NZ", name: "Māori", region: "Other" },
]

export const STUDIO_LANGUAGE_REGIONS = Array.from(
  new Set(STUDIO_LANGUAGES.map((l) => l.region))
)

export function getStudioLanguageName(code: string): string {
  return STUDIO_LANGUAGES.find((l) => l.code === code)?.name ?? code
}
