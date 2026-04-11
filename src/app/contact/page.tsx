import Link from "next/link"

export const metadata = {
  title: "Contact Us — Summon Translator",
  description: "Get in touch with the Summon Translator team for support, billing questions, or partnership inquiries.",
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-bold text-indigo-600 text-xl tracking-tight">Summon Translator</Link>
        <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">Sign in</Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Contact Us</h1>
        <p className="text-gray-500 mb-10 text-sm">We&apos;re here to help. Reach out and we&apos;ll get back to you within one business day.</p>

        <div className="grid sm:grid-cols-2 gap-8 mb-14">

          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-1">Support</h2>
            <p className="text-sm text-gray-500 mb-3">Translation issues, account access, or billing questions.</p>
            <a href="mailto:support@summontranslator.com" className="text-sm text-indigo-600 hover:underline font-medium">
              support@summontranslator.com
            </a>
          </div>

          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-1">Partnerships &amp; Sales</h2>
            <p className="text-sm text-gray-500 mb-3">Volume pricing, API integrations, or enterprise plans.</p>
            <a href="mailto:support@summontranslator.com" className="text-sm text-indigo-600 hover:underline font-medium">
              support@summontranslator.com
            </a>
          </div>

          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-1">Reviewer Applications</h2>
            <p className="text-sm text-gray-500 mb-3">Apply to join our network of freelance post-editors and LQA reviewers.</p>
            <Link href="/reviewer-signup" className="text-sm text-indigo-600 hover:underline font-medium">
              Apply here →
            </Link>
          </div>

          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-1">Press &amp; Media</h2>
            <p className="text-sm text-gray-500 mb-3">Coverage requests, interviews, or press kit access.</p>
            <a href="mailto:support@summontranslator.com" className="text-sm text-indigo-600 hover:underline font-medium">
              support@summontranslator.com
            </a>
          </div>

        </div>

        <div className="text-sm text-gray-400 text-center">
          Response time: within 1 business day · We&apos;re based in the United States
        </div>
      </main>

      
    </div>
  )
}
