"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"

const PAYG_MARKUP = 5           // matches src/lib/pricing.ts
const PLATFORM_FEE_PER_WORD = 0.007
const MIN_JOB_FEE = 5.00
const WORDS_PER_PAGE = 800      // average marketing/doc page
const CHARS_PER_WORD = 5
const CHARS_PER_STRING = 200    // average segment length
const BATCH_SIZE = 50
const BATCH_OVERHEAD_TOKENS = 150

const MODELS = [
  { id: "claude-sonnet-4-6",          label: "Claude Sonnet 4.6",   inputPricePer1M: 3.00,  outputPricePer1M: 15.00 },
  { id: "claude-haiku-4-5-20251001",  label: "Claude Haiku 4.5",    inputPricePer1M: 0.80,  outputPricePer1M: 4.00  },
  { id: "gpt-4o",                      label: "GPT-4o",              inputPricePer1M: 2.50,  outputPricePer1M: 10.00 },
  { id: "gpt-4o-mini",                 label: "GPT-4o Mini",         inputPricePer1M: 0.15,  outputPricePer1M: 0.60  },
  { id: "gemini-2.0-flash",            label: "Gemini 2.0 Flash",    inputPricePer1M: 0.10,  outputPricePer1M: 0.40  },
  { id: "deepseek-chat",               label: "DeepSeek Chat V3",    inputPricePer1M: 0.27,  outputPricePer1M: 1.10  },
]

function estimate(words: number, languages: number, modelId: string): number {
  const model = MODELS.find((m: (typeof MODELS)[number]) => m.id === modelId) ?? MODELS[0]
  const chars = words * CHARS_PER_WORD
  const strings = Math.max(1, Math.ceil(chars / CHARS_PER_STRING))
  const batches = Math.max(1, Math.ceil(strings / BATCH_SIZE))
  const inputTok = Math.ceil(chars / 4) + batches * BATCH_OVERHEAD_TOKENS
  const outputTok = Math.ceil(inputTok * 1.1)
  const aiCost = (inputTok * model.inputPricePer1M + outputTok * model.outputPricePer1M) / 1_000_000
  const raw = aiCost * PAYG_MARKUP * languages + words * PLATFORM_FEE_PER_WORD * languages
  return Math.max(MIN_JOB_FEE, raw)
}

function fmt(n: number): string {
  if (n < 0.01) return "< $0.01"
  if (n < 1) return `$${n.toFixed(2)}`
  if (n < 100) return `$${n.toFixed(2)}`
  return `$${Math.round(n).toLocaleString("en-US")}`
}

export function CostEstimator() {
  const t = useTranslations("estimator")
  const [mode, setMode] = useState<"pages" | "words">("pages")
  const [pages, setPages] = useState(10)
  const [words, setWords] = useState(8000)
  const [languages, setLanguages] = useState(5)
  const [modelId, setModelId] = useState(MODELS[0].id)

  const totalWords = mode === "pages" ? pages * WORDS_PER_PAGE : words
  const cost = useMemo(() => estimate(totalWords, languages, modelId), [totalWords, languages, modelId])

  const model = MODELS.find((m: (typeof MODELS)[number]) => m.id === modelId)!

  return (
    <div className="bg-white border border-indigo-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-indigo-600 px-6 py-4">
        <p className="text-xs font-semibold text-indigo-200 uppercase tracking-widest mb-0.5">{t("title")}</p>
        <p className="text-white text-sm">{t("subtitle")}</p>
      </div>

      <div className="p-6 space-y-5">
        {/* Mode toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
          <button
            onClick={() => setMode("pages")}
            className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${
              mode === "pages" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t("byPages")}
          </button>
          <button
            onClick={() => setMode("words")}
            className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${
              mode === "words" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t("byWords")}
          </button>
        </div>

        {/* Content input */}
        {mode === "pages" ? (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">{t("pagesLabel")}</label>
            <p className="text-3xl font-extrabold text-indigo-600 text-center mb-2">{pages.toLocaleString()}</p>
            <input
              type="range"
              min={1} max={500} step={1}
              value={pages}
              onChange={(e) => setPages(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1 page</span>
              <span className="text-gray-500 italic">≈ {(pages * WORDS_PER_PAGE).toLocaleString()} words</span>
              <span>500 pages</span>
            </div>
          </div>
        ) : (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">{t("wordsLabel")}</label>
            <p className="text-3xl font-extrabold text-indigo-600 text-center mb-2">{words.toLocaleString()}</p>
            <input
              type="range"
              min={500} max={500000} step={500}
              value={words}
              onChange={(e) => setWords(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>500</span>
              <span className="text-gray-500 italic">≈ {Math.round(words / WORDS_PER_PAGE)} pages</span>
              <span>500k</span>
            </div>
          </div>
        )}

        {/* Languages */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">{t("langLabel")}</label>
          <p className="text-3xl font-extrabold text-indigo-600 text-center mb-2">{languages}</p>
          <div>
          <input
            type="range"
            min={1} max={50} step={1}
            value={languages}
            onChange={(e) => setLanguages(Number(e.target.value))}
            className="w-full accent-indigo-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>1</span>
            <span>50</span>
          </div>
          </div>
        </div>

        {/* Model */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">{t("modelLabel")}</label>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700"
          >
            {MODELS.map((m: (typeof MODELS)[number]) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Result */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-indigo-400 font-medium uppercase tracking-wide mb-0.5">{t("estimatedCost")}</p>
            <p className="text-3xl font-extrabold text-indigo-600">{fmt(cost)}</p>
            <p className="text-xs text-indigo-400 mt-0.5">
              {totalWords.toLocaleString()} words · {languages} language{languages !== 1 ? "s" : ""} · {model.label}
            </p>
          </div>
          <Link
            href="/login"
            className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            {t("startFree")}
          </Link>
        </div>

        <p className="text-xs text-gray-400 text-center">
          {t("disclaimer")}
        </p>
      </div>
    </div>
  )
}
