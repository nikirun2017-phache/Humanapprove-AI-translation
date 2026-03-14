import { anthropicProvider } from "./anthropic"
import { openaiProvider, deepseekProvider } from "./openai"
import { geminiProvider } from "./gemini"
import type { AIProvider, ProviderInfo, ProviderName } from "./types"

export type { ProviderName }

const PROVIDERS: Record<ProviderName, AIProvider> = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  deepseek: deepseekProvider,
  gemini: geminiProvider,
}

export function getProvider(name: ProviderName): AIProvider {
  const provider = PROVIDERS[name]
  if (!provider) throw new Error(`Unknown AI provider: ${name}`)
  return provider
}

// Client-safe: no API keys, no secrets
export const PROVIDER_INFO: ProviderInfo[] = [
  {
    name: "anthropic",
    label: "Anthropic (Claude)",
    models: [
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (Latest)" },
      { id: "claude-opus-4-5", label: "Claude Opus 4.5" },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (Fast)" },
    ],
  },
  {
    name: "openai",
    label: "OpenAI (GPT)",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini (Fast)" },
    ],
  },
  {
    name: "deepseek",
    label: "DeepSeek",
    models: [
      { id: "deepseek-chat", label: "DeepSeek Chat (V3)" },
      { id: "deepseek-reasoner", label: "DeepSeek R1" },
    ],
  },
  {
    name: "gemini",
    label: "Google Gemini",
    models: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    ],
  },
]
