import Link from "next/link"
import { PublicFooter } from "@/components/public-footer"

export const metadata = {
  title: "Do Not Sell or Share My Personal Data — Summon Translator",
  description: "Exercise your CCPA rights to opt out of the sale or sharing of your personal information.",
}

export default function DoNotSellPage() {
  const updated = "April 1, 2026"
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-bold text-indigo-600 text-xl tracking-tight">Summon Translator</Link>
        <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">Sign in</Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Do Not Sell or Share My Personal Data</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: {updated}</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed text-gray-700">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Our commitment</h2>
            <p>
              <strong>Summon Translator does not sell or share your personal information with third parties for their
              own marketing or advertising purposes.</strong> This page is provided in compliance with the California
              Consumer Privacy Act (CCPA) and similar state privacy laws.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">What data we share and why</h2>
            <p>We share personal data only with service providers who help us operate the platform:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Stripe</strong> — to process your payments.</li>
              <li><strong>AI providers (Anthropic, OpenAI, Google, DeepSeek)</strong> — to perform translation of content you submit.</li>
              <li><strong>Resend</strong> — to send transactional emails (job completion, billing receipts).</li>
            </ul>
            <p className="mt-3">
              These are service providers, not data brokers. They may not use your data for their own purposes beyond
              providing the specific service to us.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Your rights under CCPA</h2>
            <p>California residents have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Know what personal information we collect, use, and disclose.</li>
              <li>Delete personal information we hold about you.</li>
              <li>Opt out of the sale or sharing of personal information.</li>
              <li>Non-discrimination for exercising your privacy rights.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">How to exercise your rights</h2>
            <p>
              To submit a CCPA request — including a request to know, delete, or opt out — email us at{" "}
              <a href="mailto:support@summontranslator.com" className="text-indigo-600 hover:underline">
                support@summontranslator.com
              </a>{" "}
              with the subject line <strong>&quot;CCPA Privacy Request&quot;</strong>. Include your name and the email address
              associated with your account.
            </p>
            <p className="mt-3">
              We will respond within <strong>45 days</strong> as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Authorized agents</h2>
            <p>
              You may designate an authorized agent to submit a request on your behalf. We will require written
              authorization and may verify your identity directly before processing the request.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">More information</h2>
            <p>
              For full details on how we handle your data, see our{" "}
              <Link href="/privacy" className="text-indigo-600 hover:underline">Privacy Policy</Link> and{" "}
              <Link href="/collection-notice" className="text-indigo-600 hover:underline">Notice at Collection</Link>.
            </p>
          </section>

        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
