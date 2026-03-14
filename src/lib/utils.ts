import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const LANGUAGE_NAMES: Record<string, string> = {
  "en": "English",
  "en-US": "English (US)",
  "en-GB": "English (UK)",
  "ja": "Japanese",
  "ja-JP": "Japanese",
  "zh": "Chinese",
  "zh-CN": "Chinese (Simplified)",
  "zh-TW": "Chinese (Traditional)",
  "ko": "Korean",
  "ko-KR": "Korean",
  "fr": "French",
  "fr-FR": "French",
  "de": "German",
  "de-DE": "German",
  "es": "Spanish",
  "es-ES": "Spanish",
  "pt": "Portuguese",
  "pt-BR": "Portuguese (Brazil)",
  "it": "Italian",
  "nl": "Dutch",
  "ru": "Russian",
  "ar": "Arabic",
  "he": "Hebrew",
  "th": "Thai",
  "vi": "Vietnamese",
  "id": "Indonesian",
  "ms": "Malay",
  "tr": "Turkish",
  "pl": "Polish",
  "sv": "Swedish",
  "da": "Danish",
  "fi": "Finnish",
  "no": "Norwegian",
  "cs": "Czech",
  "hu": "Hungarian",
  "ro": "Romanian",
  "uk": "Ukrainian",
}

export function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || code
}

export const STATUS_COLORS: Record<string, string> = {
  pending_assignment: "bg-yellow-100 text-yellow-800",
  in_review: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  exported: "bg-gray-100 text-gray-800",
}

export const UNIT_STATUS_COLORS: Record<string, string> = {
  pending: "text-gray-400",
  commented: "text-yellow-500",
  approved: "text-green-500",
  rejected: "text-red-500",
}
