export type ProviderName = "anthropic" | "openai" | "deepseek" | "gemini"

export interface SourceUnit {
  id: string
  sourceText: string
}

export interface TranslatedUnit {
  id: string
  translatedText: string
}

export interface GlossaryTerm {
  source: string
  target: string
}

export interface TranslationBatch {
  units: SourceUnit[]
  sourceLanguage: string
  targetLanguage: string
  glossaryTerms?: GlossaryTerm[]
}

export interface TranslationResult {
  units: TranslatedUnit[]
}

export interface AIProvider {
  name: ProviderName
  translate(batch: TranslationBatch, apiKey: string, model: string): Promise<TranslationResult>
}

export interface ModelOption {
  id: string
  label: string
  inputPricePer1M: number  // USD per million input tokens
  outputPricePer1M: number // USD per million output tokens
}

export interface ProviderInfo {
  name: ProviderName
  label: string
  models: ModelOption[]
}
