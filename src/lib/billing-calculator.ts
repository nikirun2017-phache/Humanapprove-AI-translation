// SERVER-ONLY — shared charge calculation used by billing routes and the monthly charge cron
import { PAYG_MARKUP, PLATFORM_FEE_PER_WORD, MIN_JOB_FEE, AVG_WORDS_PER_UNIT } from "./pricing"
import { PROVIDER_INFO } from "./ai-providers/registry"

const ALL_MODELS = PROVIDER_INFO.flatMap((p: (typeof PROVIDER_INFO)[number]) => p.models)
const CHARS_PER_WORD = 5
const COST_PER_WORD_FALLBACK = (3 / 1_000_000 / 4) * 5

export interface BillingTask {
  totalUnits: number
  wordCount: number
  model: string // job's model — passed in denormalized
}

function taskWords(task: BillingTask): number {
  return task.wordCount > 0 ? task.wordCount : task.totalUnits * AVG_WORDS_PER_UNIT
}

function estimateApiCostForTask(task: BillingTask): number {
  const model = ALL_MODELS.find((m: (typeof ALL_MODELS)[number]) => m.id === task.model)
  const words = taskWords(task)
  const inputTokens = Math.ceil((words * CHARS_PER_WORD) / 4)
  const outputTokens = Math.ceil(inputTokens * 1.1)
  return model
    ? (inputTokens * model.inputPricePer1M + outputTokens * model.outputPricePer1M) / 1_000_000
    : words * COST_PER_WORD_FALLBACK
}

export interface JobChargeResult {
  totalWords: number
  apiCost: number
  platformFee: number
  gross: number      // before discount
  discountAmt: number
  net: number        // what the user is charged
  netCents: number   // integer cents for Stripe
}

/**
 * Compute the charge for a single translation job.
 * tasks must already be filtered to completed/imported only.
 */
export function computeJobCharge(
  tasks: BillingTask[],
  discountPct: number
): JobChargeResult {
  const totalWords = tasks.reduce((s, t) => s + taskWords(t), 0)
  const apiCost = tasks.reduce((s, t) => s + estimateApiCostForTask(t), 0)
  const platformFee = Math.max(MIN_JOB_FEE, totalWords * PLATFORM_FEE_PER_WORD)
  const gross = apiCost * PAYG_MARKUP + platformFee
  const discountAmt = discountPct > 0 ? gross * (discountPct / 100) : 0
  const net = Math.max(0, gross - discountAmt)
  return {
    totalWords,
    apiCost: Math.round(apiCost * 100000) / 100000,
    platformFee: Math.round(platformFee * 100) / 100,
    gross: Math.round(gross * 100) / 100,
    discountAmt: Math.round(discountAmt * 100) / 100,
    net: Math.round(net * 100) / 100,
    netCents: Math.round(net * 100),
  }
}
