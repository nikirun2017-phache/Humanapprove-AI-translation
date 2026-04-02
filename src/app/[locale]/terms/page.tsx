import Link from "next/link"

export const metadata = {
  title: "Terms of Service — Jendee AI",
  description: "Terms and conditions for using the Jendee AI translation platform.",
}

export default function TermsPage() {
  const updated = "March 28, 2026"
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-bold text-indigo-600 text-xl tracking-tight">Jendee AI</Link>
        <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">Sign in</Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: {updated}</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed text-gray-700">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Acceptance of terms</h2>
            <p>
              By creating an account or using the Jendee AI platform (&quot;Service&quot;), you agree to
              these Terms of Service (&quot;Terms&quot;). If you do not agree, do not use the Service.
              These Terms form a binding agreement between you and Jendee AI.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Description of service</h2>
            <p>
              Jendee AI provides AI-powered translation and human review services. Users can upload
              content files, select target languages, and receive translated output. The Service
              also offers optional human linguistic quality assurance review.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Account registration</h2>
            <p>
              You must provide accurate and complete information when creating an account.
              You are responsible for maintaining the security of your credentials and for all
              activity under your account. Notify us immediately at{" "}
              <a href="mailto:support@summontranslator.com" className="text-indigo-600 hover:underline">support@summontranslator.com</a>{" "}
              if you suspect unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Payment and billing</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>The Service is billed <strong>per translation job</strong> upon successful completion.</li>
              <li>Pricing is displayed before you submit a job. By submitting, you authorize the charge.</li>
              <li>Failed jobs are not charged. If a job fails after partial processing, you will not be billed.</li>
              <li>All prices are in USD. Taxes may apply depending on your jurisdiction.</li>
              <li>Promotional codes may reduce the price of a single job; one code per job, cannot be combined.</li>
              <li>We reserve the right to change pricing with 30 days notice.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Refunds</h2>
            <p>
              If the Service fails to deliver a translation due to a platform error, you may request
              a full refund within 14 days by emailing{" "}
              <a href="mailto:support@summontranslator.com" className="text-indigo-600 hover:underline">support@summontranslator.com</a>.
              Refunds are not available for completed translations where you simply did not use the output.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Your content</h2>
            <p>
              You retain all rights to the content you upload (&quot;Your Content&quot;). By using the Service,
              you grant Jendee AI a limited license to process Your Content solely to provide the Service.
              You represent that you have the right to upload and translate Your Content and that doing
              so does not violate any third-party rights.
            </p>
            <p className="mt-3">
              Your Content is not used to train AI models. It is processed by AI provider(s) you select
              under their own terms and data processing agreements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Acceptable use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Translate content that is illegal, defamatory, or violates third-party rights.</li>
              <li>Attempt to reverse-engineer, scrape, or abuse the platform.</li>
              <li>Circumvent rate limiting or access controls.</li>
              <li>Resell or sublicense the Service without written permission.</li>
            </ul>
            <p className="mt-3">
              We reserve the right to suspend or terminate accounts that violate these terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Translation quality</h2>
            <p>
              AI translations are provided as-is. Machine translation can contain errors. Jendee AI
              does not guarantee that translations are accurate, complete, or suitable for any particular
              purpose. For critical use cases (legal, medical, financial), we recommend professional
              human review. Jendee AI is not liable for decisions made based on machine-translated content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Intellectual property</h2>
            <p>
              The Jendee AI platform, including its software, design, and brand, is owned by Jendee AI
              and protected by intellectual property law. You may not copy, modify, or distribute any
              part of the platform without written permission.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, Jendee AI shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, or any loss of profits or revenues,
              arising out of your use of the Service. Our total liability for any claim arising out of
              or relating to these Terms shall not exceed the amount you paid us in the 3 months
              preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">11. Disclaimer of warranties</h2>
            <p>
              The Service is provided &quot;as is&quot; without warranty of any kind. We disclaim all warranties,
              express or implied, including merchantability, fitness for a particular purpose, and
              non-infringement. We do not warrant that the Service will be uninterrupted or error-free.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">12. Termination</h2>
            <p>
              You may close your account at any time by contacting{" "}
              <a href="mailto:support@summontranslator.com" className="text-indigo-600 hover:underline">support@summontranslator.com</a>.
              We may suspend or terminate your account immediately if you breach these Terms.
              Upon termination, your access ends and data is deleted per our retention policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">13. Governing law</h2>
            <p>
              These Terms are governed by the laws of the State of Delaware, United States, without
              regard to conflict of law principles. Any disputes shall be resolved in the courts of
              Delaware.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">14. Changes to these terms</h2>
            <p>
              We may update these Terms. We will notify you by email at least 14 days before changes
              affecting your rights take effect. Continued use of the Service after changes constitutes
              acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">15. Contact</h2>
            <p>
              Questions about these Terms?{" "}
              <a href="mailto:support@summontranslator.com" className="text-indigo-600 hover:underline">support@summontranslator.com</a>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-100 py-8 mt-16">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between">
          <span className="font-bold text-indigo-600 tracking-tight">Jendee AI</span>
          <div className="flex gap-4 text-xs text-gray-400">
            <Link href="/privacy" className="hover:text-gray-600">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-600">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
