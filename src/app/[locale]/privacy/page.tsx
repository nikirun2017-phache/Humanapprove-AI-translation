import Link from "next/link"

export const metadata = {
  title: "Privacy Policy — Jendee AI",
  description: "How Jendee AI collects, uses, and protects your personal information.",
}

export default function PrivacyPage() {
  const updated = "March 28, 2026"
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-bold text-indigo-600 text-xl tracking-tight">Jendee AI</Link>
        <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">Sign in</Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: {updated}</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed text-gray-700">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Who we are</h2>
            <p>
              Jendee AI (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) provides AI-powered translation and human review
              services at <strong>jendee.ai</strong>. This policy explains how we collect, use, and
              protect personal information when you use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Information we collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Account information:</strong> name and email address when you register.</li>
              <li><strong>Payment information:</strong> billing details are processed and stored by Stripe, Inc. We do not store full card numbers.</li>
              <li><strong>Translation content:</strong> files you upload for translation. This content is processed to deliver the service and is not used to train AI models.</li>
              <li><strong>Usage data:</strong> pages visited, job counts, and error logs for service improvement and billing.</li>
              <li><strong>Authentication tokens:</strong> session tokens stored in secure HTTP-only cookies.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. How we use your information</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To provide, operate, and improve the Jendee AI service.</li>
              <li>To process payments and send receipts.</li>
              <li>To send transactional emails (account confirmation, job completion, billing alerts).</li>
              <li>To respond to support requests.</li>
              <li>To detect and prevent fraud or abuse.</li>
            </ul>
            <p className="mt-3">We do not sell your personal information to third parties.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Third-party service providers</h2>
            <p>We share data with the following processors to deliver the service:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>Stripe</strong> — payment processing. Subject to <a href="https://stripe.com/privacy" className="text-indigo-600 hover:underline" target="_blank" rel="noreferrer">Stripe&apos;s Privacy Policy</a>.</li>
              <li><strong>Anthropic / OpenAI / Google / DeepSeek</strong> — AI translation providers. Translation content is sent to the provider selected for each job. Each provider&apos;s own data processing terms apply.</li>
              <li><strong>Resend</strong> — transactional email delivery.</li>
              <li><strong>Google / Apple</strong> — optional OAuth sign-in. Subject to their respective privacy policies.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Data retention</h2>
            <p>
              Account data is retained for as long as your account is active. Translation job data
              (uploaded files and translated output) is retained for 90 days after job completion,
              after which it is automatically deleted. You may request earlier deletion by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Your rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Access the personal data we hold about you.</li>
              <li>Correct inaccurate data.</li>
              <li>Request deletion of your data (&quot;right to be forgotten&quot;).</li>
              <li>Object to or restrict processing.</li>
              <li>Data portability.</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email us at{" "}
              <a href="mailto:support@summontranslator.com" className="text-indigo-600 hover:underline">support@summontranslator.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Cookies</h2>
            <p>
              We use only functional cookies necessary to operate the service (authentication session).
              We do not use advertising or tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Security</h2>
            <p>
              We use industry-standard security practices including HTTPS, hashed passwords (bcrypt),
              and rate limiting. No method of transmission over the internet is 100% secure.
              If you discover a security issue, please disclose it responsibly to{" "}
              <a href="mailto:support@summontranslator.com" className="text-indigo-600 hover:underline">support@summontranslator.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Children</h2>
            <p>
              Jendee AI is not directed at children under 16. We do not knowingly collect personal
              information from children.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. We will notify you by email or by posting
              a notice on the platform before changes take effect.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">11. Contact</h2>
            <p>
              Questions? Email{" "}
              <a href="mailto:support@summontranslator.com" className="text-indigo-600 hover:underline">support@summontranslator.com</a>.
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
