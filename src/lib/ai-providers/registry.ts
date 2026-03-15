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
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (Latest)", inputPricePer1M: 3.00, outputPricePer1M: 15.00 },
      { id: "claude-opus-4-5", label: "Claude Opus 4.5", inputPricePer1M: 15.00, outputPricePer1M: 75.00 },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (Fast)", inputPricePer1M: 0.80, outputPricePer1M: 4.00 },
    ],
  },
  {
    name: "openai",
    label: "OpenAI (GPT)",
    models: [
      { id: "gpt-4o", label: "GPT-4o", inputPricePer1M: 2.50, outputPricePer1M: 10.00 },
      { id: "gpt-4o-mini", label: "GPT-4o Mini (Fast)", inputPricePer1M: 0.15, outputPricePer1M: 0.60 },
    ],
  },
  {
    name: "deepseek",
    label: "DeepSeek",
    models: [
      { id: "deepseek-chat", label: "DeepSeek Chat (V3)", inputPricePer1M: 0.27, outputPricePer1M: 1.10 },
      { id: "deepseek-reasoner", label: "DeepSeek R1", inputPricePer1M: 0.55, outputPricePer1M: 2.19 },
    ],
  },
  {
    name: "gemini",
    label: "Google Gemini",
    models: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", inputPricePer1M: 0.10, outputPricePer1M: 0.40 },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", inputPricePer1M: 1.25, outputPricePer1M: 5.00 },
    ],
  },
]
