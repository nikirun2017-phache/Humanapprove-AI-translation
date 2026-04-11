import Link from "next/link"
import { PublicFooter } from "@/components/public-footer"

export const metadata = {
  title: "About Us — Summon Translator",
  description: "Learn about Summon Translator, our mission to make professional-quality translation accessible, and the team behind the platform.",
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-bold text-indigo-600 text-xl tracking-tight">Summon Translator</Link>
        <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">Sign in</Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">About Summon Translator</h1>
        <p className="text-sm text-gray-400 mb-10">AI-powered translation with human oversight</p>

        <div className="space-y-10 text-sm leading-relaxed text-gray-700">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Our Mission</h2>
            <p>
              Summon Translator exists to make professional-quality translation accessible to every team, at every scale.
              We combine the speed and cost-efficiency of AI translation with optional human linguistic quality assurance —
              so you get fast, accurate output without sacrificing precision on content that matters.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">What We Do</h2>
            <p>
              We provide an end-to-end translation platform for businesses, eLearning developers, technical writers,
              and anyone who needs reliable multilingual content. Upload a file — PDF, Word, HTML, JSON, XLIFF, Markdown,
              PowerPoint, and more — select your target languages, and receive a translated file in the same format.
              No copy-pasting. No reformatting.
            </p>
            <p className="mt-3">
              For content where accuracy is critical, our network of professional post-editors and LQA reviewers can
              review and refine every translation before delivery.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Why Summon Translator?</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Format-preserving:</strong> Translated files come back with the same layout, styling, and structure as the original.</li>
              <li><strong>Multi-engine:</strong> Choose from leading AI providers — Anthropic Claude, OpenAI, Google Gemini, and more.</li>
              <li><strong>Human-in-the-loop:</strong> Add a human review step for legal, medical, marketing, or other high-stakes content.</li>
              <li><strong>Privacy-first:</strong> Your content is never used to train AI models and is permanently deleted 48 hours after job completion.</li>
              <li><strong>Transparent pricing:</strong> Pay per job. No subscriptions, no surprise fees.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Contact</h2>
            <p>
              Questions, partnerships, or press inquiries? Reach us at{" "}
              <a href="mailto:support@summontranslator.com" className="text-indigo-600 hover:underline">
                support@summontranslator.com
              </a>
              {" "}or visit our{" "}
              <Link href="/contact" className="text-indigo-600 hover:underline">contact page</Link>.
            </p>
          </section>

        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
