// MVP: pricing page hidden — uncomment notFound() below to hide, comment it out to restore
import { notFound } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/navbar"

// Rates kept in sync with src/lib/stripe.ts
const PAYG_MARKUP = 5
const PLATFORM_FEE_PER_WORD = 0.007
const MIN_JOB_FEE = 5.00
const PLATFORM_REVIEW_RATE = 0.055
const LIGHT_REVIEW_RATE = 0.035
const FULL_LQA_RATE = 0.090

const AI_PROVIDERS = [
  { name: "Claude Haiku 3.5", provider: "Anthropic", inputPer1M: 0.80, outputPer1M: 4.00, speed: "Fastest" },
  { name: "Claude Sonnet 4", provider: "Anthropic", inputPer1M: 3.00, outputPer1M: 15.00, speed: "Recommended" },
  { name: "GPT-4o Mini", provider: "OpenAI", inputPer1M: 0.15, outputPer1M: 0.60, speed: "Fast" },
  { name: "GPT-4o", provider: "OpenAI", inputPer1M: 2.50, outputPer1M: 10.00, speed: "High quality" },
  { name: "Gemini 1.5 Flash", provider: "Google", inputPer1M: 0.075, outputPer1M: 0.30, speed: "Fastest" },
  { name: "DeepSeek V3", provider: "DeepSeek", inputPer1M: 0.27, outputPer1M: 1.10, speed: "Cost-efficient" },
]

// Real-world example: 2,000 words, Claude Haiku, 3 languages
// Raw API: ~(2000*5 chars / 4 tok/char) * 0.80/M in + 1.1× out * 4/M = ~$0.044 × 5 markup = ~$0.22
// Platform fee: 2000 * 3 lang * 0.007 = $0.042 per lang → 3 lang = $0.126 → total ~$0.35 (above $5 min × 3 = $15)
// Light review 2000 * 3 * 0.035 = $210 — wait, review is per translated language
// Small: 500 words, 1 lang, Haiku. API raw ≈ 500*5/4 tok = 625 in; 687 out. Cost = (625*0.8 + 687*4)/1M = $0.00325. ×5 = $0.016. Platform = max(5, 500*0.007) = max(5, 3.5) = $5. Total AI = $5.016
// Marketing: 2000 words, Sonnet, 1 lang. Raw ≈ (2500*3 + 2750*15)/1M = $0.0489. ×5 = $0.245. Platform = max(5, 2000*0.007) = max(5, 14) = $14. Total = $14.25. Light review 2000*0.035 = $70.
// Legal: 10000 words, GPT-4o, 1 lang. Raw ≈ (12500*2.5 + 13750*10)/1M = $0.169. ×5 = $0.845. Platform = max(5, 10000*0.007) = $70. Total AI = $70.85. Full LQA 10000*0.09 = $900.

const EXAMPLES = [
  {
    label: "Mobile app (500 strings, ~2K words, Haiku, 1 language)",
    ai: "$5.02", review: "$70.00 (light review)", total: "$75.02",
  },
  {
    label: "Marketing site (2,000 words, Sonnet, 1 language)",
    ai: "$14.25", review: "$110.00 (Jendee AI reviewer)", total: "$124.25",
  },
  {
    label: "Legal document (10,000 words, GPT-4o, 1 language)",
    ai: "$70.85", review: "$900.00 (full LQA)", total: "$970.85",
  },
]

const REVIEW_TIERS = [
  { name: "Light review / proofreading", rate: LIGHT_REVIEW_RATE, description: "Fluency check, minor edits. ~1,200 words/hour.", highlight: false },
  { name: "Full LQA", rate: FULL_LQA_RATE, description: "Thorough linguistic QA, error categorisation. ~800 words/hour.", highlight: false },
  { name: "Jendee AI — platform reviewer", rate: PLATFORM_REVIEW_RATE, description: "Native speaker sourced and managed by us. No freelancer setup needed.", highlight: true },
  { name: "Your own reviewer", rate: 0, description: "Invite a colleague or freelancer. They review in Jendee AI at no extra charge.", free: true },
]

export default function PricingPage() {
  notFound() // MVP: remove this line to re-enable the pricing page
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Hero */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Simple, transparent pricing</h1>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto">
            AI translation charged at {PAYG_MARKUP}× the raw model cost, plus a flat ${PLATFORM_FEE_PER_WORD}/word platform fee.
            Human review is optional and billed per word. No subscriptions. No surprises.
          </p>
        </div>

        {/* How it works */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
          <h2 className="font-semibold text-gray-900 mb-4">How billing works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-bold mb-3">1</div>
              <p className="font-medium text-gray-800 mb-1">AI translation</p>
              <p className="text-gray-500">
                Raw model token cost × {PAYG_MARKUP} plus ${PLATFORM_FEE_PER_WORD}/word platform fee (min ${MIN_JOB_FEE}/job).
                You see the exact estimate before confirming.
              </p>
            </div>
            <div>
              <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-bold mb-3">2</div>
              <p className="font-medium text-gray-800 mb-1">Human review (optional)</p>
              <p className="text-gray-500">
                Charged per word of target text reviewed. Light review from ${LIGHT_REVIEW_RATE}/word, full LQA ${FULL_LQA_RATE}/word, Jendee AI sourced reviewer ${PLATFORM_REVIEW_RATE}/word. Bring your own reviewer free.
              </p>
            </div>
            <div>
              <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-bold mb-3">3</div>
              <p className="font-medium text-gray-800 mb-1">Monthly invoice</p>
              <p className="text-gray-500">
                All usage totalled at end of month and charged to your card. No prepayment or credits required.
              </p>
            </div>
          </div>
        </div>

        {/* AI translation pricing */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">AI translation — what you pay</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Formula: (raw model cost × {PAYG_MARKUP}) + ${PLATFORM_FEE_PER_WORD}/word · minimum ${MIN_JOB_FEE} per job
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-6 py-3">Model</th>
                <th className="text-left px-6 py-3">Provider</th>
                <th className="text-right px-6 py-3">Raw input / 1M tokens</th>
                <th className="text-right px-6 py-3">Raw output / 1M tokens</th>
                <th className="text-right px-6 py-3">Typical use</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {AI_PROVIDERS.map((m) => (
                <tr key={m.name}>
                  <td className="px-6 py-3 font-medium text-gray-800">{m.name}</td>
                  <td className="px-6 py-3 text-gray-500">{m.provider}</td>
                  <td className="px-6 py-3 text-right text-gray-600">${m.inputPer1M.toFixed(2)}</td>
                  <td className="px-6 py-3 text-right text-gray-600">${m.outputPer1M.toFixed(2)}</td>
                  <td className="px-6 py-3 text-right">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{m.speed}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-3 bg-indigo-50 border-t border-indigo-100 text-xs text-indigo-700">
            Raw model costs multiplied by {PAYG_MARKUP} to cover infrastructure (hosting, database, Cloudflare CDN) and support.
            Platform fee of ${PLATFORM_FEE_PER_WORD}/word applies regardless of model chosen.
          </div>
        </div>

        {/* Human review pricing */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Human review — per word of target text</h2>
            <p className="text-xs text-gray-400 mt-0.5">All review tiers use the same in-app editor. Reviewer time is logged in the audit trail.</p>
          </div>
          <div className="divide-y divide-gray-100">
            {REVIEW_TIERS.map((t) => (
              <div key={t.name} className={`px-6 py-4 flex items-center justify-between gap-4 ${t.highlight ? "bg-indigo-50" : ""}`}>
                <div>
                  <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
                    {t.name}
                    {t.highlight && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Jendee AI sourced</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                </div>
                {t.free ? (
                  <p className="text-xl font-bold text-green-600 shrink-0">Free</p>
                ) : (
                  <p className="text-xl font-bold text-gray-900 shrink-0">
                    ${t.rate.toFixed(3)}<span className="text-sm font-normal text-gray-400">/word</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Real-world examples */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Real-world examples</h2>
            <p className="text-xs text-gray-400 mt-0.5">AI charge includes {PAYG_MARKUP}× markup + platform fee. Review cost shown separately.</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-6 py-3">Scenario</th>
                <th className="text-right px-6 py-3">AI charge</th>
                <th className="text-right px-6 py-3">Review</th>
                <th className="text-right px-6 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {EXAMPLES.map((e) => (
                <tr key={e.label}>
                  <td className="px-6 py-3 text-gray-700">{e.label}</td>
                  <td className="px-6 py-3 text-right text-gray-600">{e.ai}</td>
                  <td className="px-6 py-3 text-right text-gray-600">{e.review}</td>
                  <td className="px-6 py-3 text-right font-semibold text-gray-900">{e.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FAQ */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8 space-y-5">
          <h2 className="font-semibold text-gray-900">Frequently asked questions</h2>
          {[
            {
              q: "Why is the AI cost multiplied by 5?",
              a: `The ${PAYG_MARKUP}× markup covers Jendee AI's infrastructure — cloud hosting, database, Cloudflare CDN, storage, and support overhead. You get all of this built in without managing any API keys or infrastructure yourself.`,
            },
            {
              q: "What is the platform fee?",
              a: `A flat $${PLATFORM_FEE_PER_WORD}/word fee is charged on every word translated. This ensures smaller jobs still contribute to fixed costs. The minimum per job is $${MIN_JOB_FEE}.`,
            },
            {
              q: "Do I need to provide my own API key?",
              a: "No. Jendee AI uses its own API keys by default. You can optionally provide your own key to use your own quota or access custom models.",
            },
            {
              q: "When am I charged?",
              a: "All usage is aggregated and invoiced at the end of each calendar month. There is no prepayment.",
            },
            {
              q: "What if a translation fails or needs to be retried?",
              a: "Retries are charged at the same rate as the original call. Failed jobs that produce no usable output are not charged.",
            },
            {
              q: "Can I use my own reviewer for free?",
              a: "Yes. Invite any colleague or freelancer as a reviewer. They access the review editor at no extra cost to you.",
            },
          ].map(({ q, a }) => (
            <div key={q}>
              <p className="text-sm font-medium text-gray-800">{q}</p>
              <p className="text-sm text-gray-500 mt-1">{a}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/new"
            className="inline-block bg-indigo-600 text-white font-medium px-8 py-3 rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Start a project →
          </Link>
        </div>
      </div>
    </div>
  )
}
