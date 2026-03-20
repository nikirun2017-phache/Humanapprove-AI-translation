export interface Language {
  code: string
  name: string
  region: string
}

export const STUDIO_LANGUAGES: Language[] = [
  // European — Western
  { code: "en-GB", name: "English (United Kingdom)", region: "European" },
  { code: "fr-FR", name: "French (France)", region: "European" },
  { code: "fr-BE", name: "French (Belgium)", region: "European" },
  { code: "fr-CH", name: "French (Switzerland)", region: "European" },
  { code: "fr-LU", name: "French (Luxembourg)", region: "European" },
  { code: "fr-CA", name: "French (Canada)", region: "European" },
  { code: "de-DE", name: "German (Germany)", region: "European" },
  { code: "de-AT", name: "German (Austria)", region: "European" },
  { code: "de-CH", name: "German (Switzerland)", region: "European" },
  { code: "es-ES", name: "Spanish (Spain)", region: "European" },
  { code: "it-IT", name: "Italian (Italy)", region: "European" },
  { code: "pt-PT", name: "Portuguese (Portugal)", region: "European" },
  { code: "nl-NL", name: "Dutch (Netherlands)", region: "European" },
  { code: "nl-BE", name: "Dutch (Belgium)", region: "European" },
  { code: "sv-SE", name: "Swedish (Sweden)", region: "European" },
  { code: "da-DK", name: "Danish (Denmark)", region: "European" },
  { code: "fi-FI", name: "Finnish (Finland)", region: "European" },
  { code: "nb-NO", name: "Norwegian (Norway)", region: "European" },
  { code: "pl-PL", name: "Polish (Poland)", region: "European" },
  { code: "cs-CZ", name: "Czech (Czech Republic)", region: "European" },
  { code: "sk-SK", name: "Slovak (Slovakia)", region: "European" },
  { code: "hu-HU", name: "Hungarian (Hungary)", region: "European" },
  { code: "ro-RO", name: "Romanian (Romania)", region: "European" },
  { code: "hr-HR", name: "Croatian (Croatia)", region: "European" },
  { code: "hr-BA", name: "Croatian (Bosnia and Herzegovina)", region: "European" },
  { code: "sl-SI", name: "Slovenian (Slovenia)", region: "European" },
  { code: "bg-BG", name: "Bulgarian (Bulgaria)", region: "European" },
  { code: "el-GR", name: "Greek (Greece)", region: "European" },
  { code: "lt-LT", name: "Lithuanian (Lithuania)", region: "European" },
  { code: "lv-LV", name: "Latvian (Latvia)", region: "European" },
  { code: "et-EE", name: "Estonian (Estonia)", region: "European" },
  { code: "is-IS", name: "Icelandic (Iceland)", region: "European" },
  { code: "mt-MT", name: "Maltese (Malta)", region: "European" },
  { code: "ga-IE", name: "Irish (Ireland)", region: "European" },
  { code: "cy-GB", name: "Welsh (Wales)", region: "European" },
  { code: "eu-ES", name: "Basque (Spain)", region: "European" },
  { code: "ca-ES", name: "Catalan (Spain)", region: "European" },
  { code: "gl-ES", name: "Galician (Spain)", region: "European" },
  { code: "sq-AL", name: "Albanian (Albania)", region: "European" },
  { code: "mk-MK", name: "Macedonian (North Macedonia)", region: "European" },
  { code: "sr-RS", name: "Serbian (Serbia)", region: "European" },
  { code: "sr-Latn-RS", name: "Serbian Latin (Serbia)", region: "European" },
  { code: "bs-BA", name: "Bosnian (Bosnia)", region: "European" },

  // Eastern European / Eurasian
  { code: "ru-RU", name: "Russian (Russia)", region: "Eastern European" },
  { code: "ru-KZ", name: "Russian (Kazakhstan)", region: "Eastern European" },
  { code: "uk-UA", name: "Ukrainian (Ukraine)", region: "Eastern European" },
  { code: "be-BY", name: "Belarusian (Belarus)", region: "Eastern European" },

  // East Asian
  { code: "zh-CN", name: "Chinese Simplified (China)", region: "East Asian" },
  { code: "zh-TW", name: "Chinese Traditional (Taiwan)", region: "East Asian" },
  { code: "zh-HK", name: "Chinese Traditional (Hong Kong)", region: "East Asian" },
  { code: "ja-JP", name: "Japanese (Japan)", region: "East Asian" },
  { code: "ko-KR", name: "Korean (South Korea)", region: "East Asian" },
  { code: "mn-MN", name: "Mongolian (Mongolia)", region: "East Asian" },

  // Southeast Asian
  { code: "vi-VN", name: "Vietnamese (Vietnam)", region: "Southeast Asian" },
  { code: "th-TH", name: "Thai (Thailand)", region: "Southeast Asian" },
  { code: "id-ID", name: "Indonesian (Indonesia)", region: "Southeast Asian" },
  { code: "ms-MY", name: "Malay (Malaysia)", region: "Southeast Asian" },
  { code: "tl-PH", name: "Filipino / Tagalog (Philippines)", region: "Southeast Asian" },
  { code: "km-KH", name: "Khmer (Cambodia)", region: "Southeast Asian" },
  { code: "lo-LA", name: "Lao (Laos)", region: "Southeast Asian" },
  { code: "my-MM", name: "Burmese (Myanmar)", region: "Southeast Asian" },

  // South Asian
  { code: "hi-IN", name: "Hindi (India)", region: "South Asian" },
  { code: "bn-BD", name: "Bengali (Bangladesh)", region: "South Asian" },
  { code: "bn-IN", name: "Bengali (India)", region: "South Asian" },
  { code: "ta-IN", name: "Tamil (India)", region: "South Asian" },
  { code: "te-IN", name: "Telugu (India)", region: "South Asian" },
  { code: "mr-IN", name: "Marathi (India)", region: "South Asian" },
  { code: "gu-IN", name: "Gujarati (India)", region: "South Asian" },
  { code: "kn-IN", name: "Kannada (India)", region: "South Asian" },
  { code: "ml-IN", name: "Malayalam (India)", region: "South Asian" },
  { code: "pa-IN", name: "Punjabi (India)", region: "South Asian" },
  { code: "ur-PK", name: "Urdu (Pakistan)", region: "South Asian" },
  { code: "si-LK", name: "Sinhala (Sri Lanka)", region: "South Asian" },
  { code: "ne-NP", name: "Nepali (Nepal)", region: "South Asian" },

  // Middle Eastern
  { code: "ar", name: "Arabic (Standard)", region: "Middle Eastern" },
  { code: "ar-AE", name: "Arabic (UAE)", region: "Middle Eastern" },
  { code: "ar-EG", name: "Arabic (Egypt)", region: "Middle Eastern" },
  { code: "ar-SA", name: "Arabic (Saudi Arabia)", region: "Middle Eastern" },
  { code: "he-IL", name: "Hebrew (Israel)", region: "Middle Eastern" },
  { code: "fa-IR", name: "Persian / Farsi (Iran)", region: "Middle Eastern" },
  { code: "tr-TR", name: "Turkish (Turkey)", region: "Middle Eastern" },
  { code: "ku", name: "Kurdish (Standard)", region: "Middle Eastern" },
  { code: "hy-AM", name: "Armenian (Armenia)", region: "Middle Eastern" },
  { code: "ka-GE", name: "Georgian (Georgia)", region: "Middle Eastern" },
  { code: "az-AZ", name: "Azerbaijani (Azerbaijan)", region: "Middle Eastern" },

  // Central Asian
  { code: "kk-KZ", name: "Kazakh (Kazakhstan)", region: "Central Asian" },
  { code: "uz-UZ", name: "Uzbek (Uzbekistan)", region: "Central Asian" },
  { code: "ky-KG", name: "Kyrgyz (Kyrgyzstan)", region: "Central Asian" },
  { code: "tk-TM", name: "Turkmen (Turkmenistan)", region: "Central Asian" },
  { code: "tg-TJ", name: "Tajik (Tajikistan)", region: "Central Asian" },

  // African
  { code: "fr-DZ", name: "French (Algeria)", region: "African" },
  { code: "fr-MA", name: "French (Morocco)", region: "African" },
  { code: "fr-TN", name: "French (Tunisia)", region: "African" },
  { code: "sw-KE", name: "Swahili (Kenya)", region: "African" },
  { code: "am-ET", name: "Amharic (Ethiopia)", region: "African" },
  { code: "yo-NG", name: "Yoruba (Nigeria)", region: "African" },
  { code: "ig-NG", name: "Igbo (Nigeria)", region: "African" },
  { code: "ha-NG", name: "Hausa (Nigeria)", region: "African" },
  { code: "zu-ZA", name: "Zulu (South Africa)", region: "African" },
  { code: "af-ZA", name: "Afrikaans (South Africa)", region: "African" },
  { code: "xh-ZA", name: "Xhosa (South Africa)", region: "African" },
  { code: "sn-ZW", name: "Shona (Zimbabwe)", region: "African" },
  { code: "so-SO", name: "Somali (Somalia)", region: "African" },
  { code: "om-ET", name: "Oromo (Ethiopia)", region: "African" },
  { code: "rw-RW", name: "Kinyarwanda (Rwanda)", region: "African" },

  // Americas
  { code: "pt-BR", name: "Portuguese (Brazil)", region: "Americas" },
  { code: "es-MX", name: "Spanish (Mexico)", region: "Americas" },
  { code: "es-AR", name: "Spanish (Argentina)", region: "Americas" },
  { code: "es-BO", name: "Spanish (Bolivia)", region: "Americas" },
  { code: "es-CL", name: "Spanish (Chile)", region: "Americas" },
  { code: "es-CO", name: "Spanish (Colombia)", region: "Americas" },
  { code: "es-CR", name: "Spanish (Costa Rica)", region: "Americas" },
  { code: "es-DO", name: "Spanish (Dominican Republic)", region: "Americas" },
  { code: "es-EC", name: "Spanish (Ecuador)", region: "Americas" },
  { code: "es-GT", name: "Spanish (Guatemala)", region: "Americas" },
  { code: "es-PA", name: "Spanish (Panama)", region: "Americas" },
  { code: "es-PE", name: "Spanish (Peru)", region: "Americas" },
  { code: "es-PR", name: "Spanish (Puerto Rico)", region: "Americas" },
  { code: "es-PY", name: "Spanish (Paraguay)", region: "Americas" },
  { code: "es-SV", name: "Spanish (El Salvador)", region: "Americas" },
  { code: "es-US", name: "Spanish (United States)", region: "Americas" },
  { code: "es-UY", name: "Spanish (Uruguay)", region: "Americas" },
  { code: "es-VE", name: "Spanish (Venezuela)", region: "Americas" },
  { code: "ht-HT", name: "Haitian Creole (Haiti)", region: "Americas" },
  { code: "qu-PE", name: "Quechua (Peru)", region: "Americas" },

  // Other
  { code: "en-AU", name: "English (Australia)", region: "Other" },
  { code: "en-CA", name: "English (Canada)", region: "Other" },
  { code: "en-HK", name: "English (Hong Kong SAR)", region: "Other" },
  { code: "en-IE", name: "English (Ireland)", region: "Other" },
  { code: "en-IN", name: "English (India)", region: "Other" },
  { code: "en-MY", name: "English (Malaysia)", region: "Other" },
  { code: "en-NZ", name: "English (New Zealand)", region: "Other" },
  { code: "en-PH", name: "English (Philippines)", region: "Other" },
  { code: "en-SG", name: "English (Singapore)", region: "Other" },
  { code: "en-US", name: "English (United States)", region: "Other" },
  { code: "en-ZA", name: "English (South Africa)", region: "Other" },
  { code: "mi-NZ", name: "Māori (New Zealand)", region: "Other" },
]

export const STUDIO_LANGUAGE_REGIONS = Array.from(
  new Set(STUDIO_LANGUAGES.map((l: (typeof STUDIO_LANGUAGES)[number]) => l.region))
)

export interface LanguagePreset {
  id: string
  label: string
  description: string
  codes: string[]
}

export const LANGUAGE_PRESETS: LanguagePreset[] = [
  {
    id: "global30",
    label: "🌐 Global 30",
    description: "Primary languages of the top 30 economies by GDP",
    codes: [
      "zh-CN",   // China
      "de-DE",   // Germany
      "ja-JP",   // Japan
      "hi-IN",   // India
      "en-GB",   // UK
      "fr-FR",   // France
      "it-IT",   // Italy
      "fr-CA",   // Canada
      "pt-BR",   // Brazil
      "ru-RU",   // Russia
      "ko-KR",   // South Korea
      "en-AU",   // Australia
      "es-MX",   // Mexico
      "es-ES",   // Spain
      "id-ID",   // Indonesia
      "nl-NL",   // Netherlands
      "ar-SA",   // Saudi Arabia
      "tr-TR",   // Turkey
      "es-AR",   // Argentina
      "sv-SE",   // Sweden
      "pl-PL",   // Poland
      "th-TH",   // Thailand
      "nb-NO",   // Norway
      "he-IL",   // Israel
      "ga-IE",   // Ireland
    ],
  },
  {
    id: "g7",
    label: "🏛️ G7",
    description: "G7 nations: USA, UK, Germany, France, Japan, Italy, Canada",
    codes: [
      "en-GB",   // UK
      "de-DE",   // Germany
      "fr-FR",   // France
      "ja-JP",   // Japan
      "it-IT",   // Italy
      "fr-CA",   // Canada
    ],
  },
  {
    id: "apac",
    label: "🌏 APAC",
    description: "Asia-Pacific key markets",
    codes: [
      "zh-CN", "zh-TW", "ja-JP", "ko-KR",
      "vi-VN", "th-TH", "id-ID", "ms-MY",
      "tl-PH", "hi-IN", "en-AU", "en-SG",
    ],
  },
  {
    id: "emea",
    label: "🌍 EMEA",
    description: "Europe, Middle East & Africa",
    codes: [
      // Western Europe
      "en-GB", "fr-FR", "de-DE", "it-IT", "es-ES", "pt-PT",
      "nl-NL", "sv-SE", "da-DK", "fi-FI", "nb-NO", "pl-PL",
      "cs-CZ", "hu-HU", "ro-RO", "el-GR", "bg-BG",
      // Middle East
      "ar-SA", "ar-AE", "ar-EG", "he-IL", "tr-TR", "fa-IR",
      // Africa
      "fr-DZ", "fr-MA", "fr-TN",
      "sw-KE", "am-ET", "ha-NG", "yo-NG", "af-ZA",
    ],
  },
  {
    id: "latam",
    label: "🌎 LATAM",
    description: "Latin America — Spanish & Portuguese variants",
    codes: [
      "es-MX", "es-AR", "es-BO", "es-CL", "es-CO", "es-CR",
      "es-DO", "es-EC", "es-GT", "es-PA", "es-PE", "es-PR",
      "es-PY", "es-SV", "es-UY", "es-VE",
      "pt-BR", "pt-PT",
    ],
  },
  {
    id: "english",
    label: "🇬🇧 All English",
    description: "All English regional variants",
    codes: [
      "en-GB", "en-US", "en-AU", "en-CA", "en-HK",
      "en-IE", "en-IN", "en-MY", "en-NZ", "en-PH",
      "en-SG", "en-ZA",
    ],
  },
  {
    id: "brics",
    label: "🔷 BRICS+",
    description: "Brazil, Russia, India, China, South Africa + Egypt, Ethiopia, UAE",
    codes: [
      "pt-BR", "ru-RU", "hi-IN", "zh-CN",
      "af-ZA", "ar-EG", "am-ET", "ar-SA",
    ],
  },
]

export function getStudioLanguageName(code: string): string {
  return STUDIO_LANGUAGES.find((l: (typeof STUDIO_LANGUAGES)[number]) => l.code === code)?.name ?? code
}
