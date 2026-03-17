import Link from "next/link"
import { Navbar } from "@/components/navbar"

// Point 2: Standalone pricing page — transparent before the user commits to anything.

const AI_PROVIDERS = [
  { name: "Claude Haiku 3.5", provider: "Anthropic", inputPer1M: 0.80, outputPer1M: 4.00, speed: "Fastest" },
  { name: "Claude Sonnet 4", provider: "Anthropic", inputPer1M: 3.00, outputPer1M: 15.00, speed: "Recommended" },
  { name: "GPT-4o Mini", provider: "OpenAI", inputPer1M: 0.15, outputPer1M: 0.60, speed: "Fast" },
  { name: "GPT-4o", provider: "OpenAI", inputPer1M: 2.50, outputPer1M: 10.00, speed: "High quality" },
  { name: "Gemini 1.5 Flash", provider: "Google", inputPer1M: 0.075, outputPer1M: 0.30, speed: "Fastest" },
  { name: "DeepSeek V3", provider: "DeepSeek", inputPer1M: 0.27, outputPer1M: 1.10, speed: "Cost-efficient" },
]

const REVIEW_TIERS = [
  { name: "Light review", rate: 0.02, description: "Fluency check, minor edits. ~1,200 words/hour." },
  { name: "Full LQA", rate: 0.05, description: "Thorough linguistic QA, error flagging. ~800 words/hour." },
  { name: "Platform reviewer", rate: 0.03, description: "Jendee AI-sourced native reviewer. No setup needed.", highlight: true },
]

const EXAMPLES = [
  { label: "Small app (500 strings, Claude Haiku, 5 languages)", ai: "$0.48", review: "$7.50", total: "$7.98" },
  { label: "Marketing site (2,000 words, Claude Sonnet, 3 languages)", ai: "$2.70", review: "$18.00", total: "$20.70" },
  { label: "Legal document (10,000 words, GPT-4o, 1 language)", ai: "$3.75", review: "$100.00", total: "$103.75" },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Hero */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Simple, transparent pricing</h1>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto">
            You pay exactly what the AI model costs, plus a flat per-word rate for human review.
            No subscriptions. No monthly minimums. No surprises.
          </p>
        </div>

        {/* How it works */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
          <h2 className="font-semibold text-gray-900 mb-4">How billing works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-bold mb-3">1</div>
              <p className="font-medium text-gray-800 mb-1">AI translation cost</p>
              <p className="text-gray-500">
                Billed at the model&apos;s public API rate (input + output tokens). You see the exact estimate before confirming.
              </p>
            </div>
            <div>
              <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-bold mb-3">2</div>
              <p className="font-medium text-gray-800 mb-1">Human review cost</p>
              <p className="text-gray-500">
                Optional. Charged per word of target text reviewed. Bring your own reviewer (free) or use a Jendee AI reviewer ($0.03/word).
              </p>
            </div>
            <div>
              <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-bold mb-3">3</div>
              <p className="font-medium text-gray-800 mb-1">Monthly invoice</p>
              <p className="text-gray-500">
                All usage is totalled at end of month and charged to your card. No prepayment or credits required.
              </p>
            </div>
          </div>
        </div>

        {/* AI model pricing */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">AI translation — model rates</h2>
            <p className="text-xs text-gray-400 mt-0.5">Passed through at cost. No markup on AI tokens.</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-6 py-3">Model</th>
                <th className="text-left px-6 py-3">Provider</th>
                <th className="text-right px-6 py-3">Input / 1M tokens</th>
                <th className="text-right px-6 py-3">Output / 1M tokens</th>
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
        </div>

        {/* Human review pricing */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Human review — per word</h2>
            <p className="text-xs text-gray-400 mt-0.5">Words counted from target text. Bring your own reviewer for free.</p>
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
                <p className="text-xl font-bold text-gray-900 shrink-0">${t.rate.toFixed(2)}<span className="text-sm font-normal text-gray-400">/word</span></p>
              </div>
            ))}
            <div className="px-6 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Your own reviewer</p>
                <p className="text-xs text-gray-500 mt-0.5">Invite a colleague or freelancer. They review in Jendee AI at no extra charge.</p>
              </div>
              <p className="text-xl font-bold text-green-600 shrink-0">Free</p>
            </div>
          </div>
        </div>

        {/* Real-world examples */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Real-world examples</h2>
            <p className="text-xs text-gray-400 mt-0.5">AI cost + light review ($0.02/word). Actual costs vary by content and model.</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="text-left px-6 py-3">Scenario</th>
                <th className="text-right px-6 py-3">AI cost</th>
                <th className="text-right px-6 py-3">Review cost</th>
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
            { q: "Do I need to provide my own API key?", a: "No. Jendee AI uses its own API keys by default. You can optionally provide your own key to use your own quota or access custom models." },
            { q: "When am I charged?", a: "All usage is aggregated and invoiced at the end of each calendar month. There is no prepayment." },
            { q: "What if a translation fails or needs to be retried?", a: "Retries are charged at the same rate as the original call. Failed jobs that produce no usable output are not charged." },
            { q: "Can I use my own reviewer for free?", a: "Yes. Invite any colleague or freelancer as a reviewer. They access the review editor at no extra cost to you." },
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
