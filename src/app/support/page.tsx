"use client"

import { AppShell } from "@/components/app-shell"
import { useState } from "react"

const FAQS: { section: string; items: { q: string; a: string }[] }[] = [
  {
    section: "Getting Started",
    items: [
      {
        q: "How do I start my first translation?",
        a: "Go to Translation Studio, click the upload area to select your file (or drag and drop it), choose your source language, select one or more target languages, pick an AI model, then click Translate. Your translated files will be ready to download within minutes.",
      },
      {
        q: "What file formats does Translation Studio support?",
        a: "Translation Studio accepts JSON, CSV, Markdown (.md), plain text (.txt), PDF, XLIFF (.xliff/.xlf), Apple Strings (.strings), Apple Stringsdict (.stringsdict), Apple XCStrings (.xcstrings), GNU PO (.po), Android XML, Flutter ARB (.arb), and Java Properties (.properties).",
      },
      {
        q: "How many target languages can I translate into at once?",
        a: "You can select as many target languages as you need in a single job. Each language is processed in parallel, so translating into 10 languages takes roughly the same time as translating into 1.",
      },
      {
        q: "Is there a free trial?",
        a: "Yes — sign up and enter the promo code 1TIME at checkout in Translation Studio. This gives you 10,000 words translated at no cost. No credit card is required to explore the app.",
      },
      {
        q: "Do I need a credit card to sign up?",
        a: "No. You can sign up and explore the app without adding a payment method. A card is only required when you want to run an AI translation job (after your free trial words are used).",
      },
    ],
  },
  {
    section: "Translation Jobs",
    items: [
      {
        q: "What AI models are available?",
        a: "Translation Studio supports multiple Claude models (claude-sonnet-4-6 and others) via the Anthropic API. Admins can configure which provider keys are available. The model choice affects translation quality and speed — Sonnet is recommended for most professional content.",
      },
      {
        q: "How long does a translation take?",
        a: "Most files complete in under 5 minutes. Larger PDFs or files with thousands of segments may take 10–15 minutes. Translation Studio shows real-time progress so you can see each language as it completes.",
      },
      {
        q: "What is the maximum file size I can upload?",
        a: "Files up to 10 MB are supported for most formats. PDFs are processed page-by-page so very large PDFs may take longer but are still supported.",
      },
      {
        q: "Can I translate a file into multiple formats at once?",
        a: "Each job translates one source file into one or more target languages. The output format matches the input format — for example, a JSON file produces translated JSON files, one per language.",
      },
      {
        q: "Where can I find my past translation jobs?",
        a: "All your jobs are listed in My Jobs (the list icon in the sidebar). You can expand each job to see per-language status and download individual files, or download a ZIP of all completed languages at once.",
      },
    ],
  },
  {
    section: "LQA Studio",
    items: [
      {
        q: "What is LQA Studio?",
        a: "LQA Studio (Language Quality Assessment) analyses a bilingual translation file and scores its quality across three dimensions: Accuracy, Language fluency, and Style. It detects errors, generates an Excel report, and can automatically revise the source file to fix identified issues.",
      },
      {
        q: "What file formats does LQA Studio accept?",
        a: "LQA Studio accepts bilingual XLIFF (.xlf / .xliff) and TMX (.tmx) files. These are the standard formats produced by Translation Studio and most CAT tools.",
      },
      {
        q: "What does the quality score mean?",
        a: "Scores range from 0–100. 80+ is High quality, 60–79 is Medium, and below 60 is Low. The score is weighted by word count per segment so longer segments have more impact on the overall result.",
      },
      {
        q: "Can LQA automatically fix the errors it finds?",
        a: "Yes. After the LQA report is ready, click Review & Select to choose which findings to revise, then Apply Fixes. The AI revises the translation based on the identified issues and regenerates the file for download.",
      },
    ],
  },
  {
    section: "Media Studio",
    items: [
      {
        q: "What is Media Studio?",
        a: "Media Studio translates subtitle files (.srt and .vtt formats) using AI. Upload your subtitle file, choose a target language, and download a translated subtitle file with all timestamps preserved exactly as in the original.",
      },
      {
        q: "What subtitle formats are supported?",
        a: "Media Studio supports SubRip (.srt) and WebVTT (.vtt) subtitle formats. The output preserves cue numbers, timestamps, and formatting from the original file.",
      },
    ],
  },
  {
    section: "Billing & Pricing",
    items: [
      {
        q: "How does pricing work?",
        a: "Summon Translator is pay-as-you-go — you are charged per translation job based on word count and the AI model used. There is no monthly subscription fee. You can see a cost estimate before submitting any job.",
      },
      {
        q: "When am I charged?",
        a: "Your card is charged when a translation job completes successfully. Incomplete or failed jobs are not charged. Your monthly bill accumulates all completed jobs and can be reviewed on the Billing page.",
      },
      {
        q: "How do I add or change my payment method?",
        a: "Go to Billing in the sidebar. If you have no card on file, click Add card — this takes you to a Stripe-hosted card setup page. If you already have a card, click Manage card to update or remove it.",
      },
      {
        q: "Can I download an invoice?",
        a: "Yes. On the Billing page, click Download invoice PDF to generate a PDF invoice for the current month showing a breakdown of all completed jobs and charges.",
      },
    ],
  },
  {
    section: "Account & API",
    items: [
      {
        q: "How do I create an API key?",
        a: "Go to Account in the sidebar and scroll to the API Keys section. Enter a name for the key (e.g. 'OpenClaw integration'), click Create key, and copy the key immediately — it is only shown once. Use the key as a Bearer token in the Authorization header when calling /api/v1/ endpoints.",
      },
      {
        q: "How do I reset my password?",
        a: "On the sign-in page, click Forgot password? and enter your email address. You'll receive a reset link valid for 1 hour. Note: password reset is not available for accounts that sign in exclusively with Google.",
      },
      {
        q: "How do I apply to become a reviewer?",
        a: "Visit /reviewer-signup while signed in. Fill in your bio, language pairs, rates, and upload your CV. An admin will review your application and notify you by email when it is approved or if more information is needed.",
      },
      {
        q: "I need more help — how do I contact support?",
        a: "Email us at support@summontranslator.com and we'll get back to you within one business day.",
      },
    ],
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start justify-between gap-4 py-4 text-left"
      >
        <span className="text-sm font-medium text-gray-900">{q}</span>
        <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors ${open ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-400"}`}>
          <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {open && (
        <p className="pb-4 text-sm text-gray-500 leading-relaxed">{a}</p>
      )}
    </div>
  )
}

export default function SupportPage() {
  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Support & FAQ</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Common questions about using Summon Translator. Can&apos;t find your answer?{" "}
            <a href="mailto:support@summontranslator.com" className="text-indigo-600 hover:underline">
              Email us
            </a>
            .
          </p>
        </div>

        <div className="space-y-6">
          {FAQS.map(({ section, items }) => (
            <div key={section} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{section}</p>
              </div>
              <div className="px-5">
                {items.map(item => (
                  <FaqItem key={item.q} {...item} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-5 flex items-start gap-4">
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-indigo-900">Still need help?</p>
            <p className="text-sm text-indigo-700 mt-0.5">
              Email us at{" "}
              <a href="mailto:support@summontranslator.com" className="font-medium underline underline-offset-2">
                support@summontranslator.com
              </a>{" "}
              — we respond within one business day.
            </p>
          </div>
        </div>
      </main>
    </AppShell>
  )
}
