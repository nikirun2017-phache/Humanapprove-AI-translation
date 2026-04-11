import Link from "next/link"

export const metadata = {
  title: "FAQ — Summon Translator",
  description: "Frequently asked questions about Summon Translator — pricing, supported formats, AI engines, data privacy, and more.",
}

const FAQS = [
  {
    q: "What file formats does Summon Translator support?",
    a: "We support PDF, Word (.docx), PowerPoint (.pptx), HTML, Markdown (.md), JSON, XLIFF, and plain text (.txt). More formats are added regularly.",
  },
  {
    q: "How is translation quality?",
    a: "Our AI translation uses state-of-the-art large language models (Anthropic Claude, OpenAI, Google Gemini, DeepSeek). For most content, quality is production-ready. For high-stakes content — legal, medical, financial, marketing — we recommend adding a human post-editor review.",
  },
  {
    q: "How much does it cost?",
    a: "Pricing is per translation job, based on the volume of content and the target languages selected. You see the price estimate before submitting — there are no surprise charges. Failed jobs are never billed.",
  },
  {
    q: "Can I add a human reviewer?",
    a: "Yes. When submitting a job, you can opt in to human LQA (Linguistic Quality Assurance) review. A professional post-editor from our reviewer network will review the AI output and make corrections before you receive the final file.",
  },
  {
    q: "What happens to my files after translation?",
    a: "Your uploaded files and translated output are automatically and permanently deleted 48 hours after job completion. We do not store your content beyond this window. Please download your translated files before the 48-hour window closes.",
  },
  {
    q: "Is my content used to train AI models?",
    a: "No. Your content is never used to train AI models. It is sent to the AI provider you select solely to perform the translation, under their data processing terms.",
  },
  {
    q: "Which AI engines can I choose from?",
    a: "You can select from Anthropic Claude, OpenAI GPT, Google Gemini, and DeepSeek — depending on your language pair and quality requirements.",
  },
  {
    q: "How do I get a refund?",
    a: "If a job fails to deliver due to a platform error, email support@summontranslator.com within 14 days for a full refund. Completed translations are non-refundable. See our Refund Policy for details.",
  },
  {
    q: "Can I get a promotional code or discount?",
    a: "Yes. Promotional codes can be applied at checkout to reduce the price of a single job. One code per job; codes cannot be combined.",
  },
  {
    q: "How do I become a reviewer?",
    a: "Apply through our Careers page or directly at /reviewer-signup. We're looking for professional translators and post-editors across 30+ language pairs.",
  },
]

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-bold text-indigo-600 text-xl tracking-tight">Summon Translator</Link>
        <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">Sign in</Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Frequently Asked Questions</h1>
        <p className="text-sm text-gray-400 mb-12">
          Can&apos;t find an answer?{" "}
          <Link href="/contact" className="text-indigo-600 hover:underline">Contact us</Link>.
        </p>

        <div className="space-y-0 divide-y divide-gray-100">
          {FAQS.map(({ q, a }) => (
            <div key={q} className="py-7">
              <h2 className="text-base font-semibold text-gray-900 mb-2">{q}</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </main>

      
    </div>
  )
}
