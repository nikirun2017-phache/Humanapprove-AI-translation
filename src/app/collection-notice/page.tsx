import Link from "next/link"

export const metadata = {
  title: "Notice at Collection — Summon Translator",
  description: "CCPA Notice at Collection — what personal information Summon Translator collects and how it is used.",
}

export default function CollectionNoticePage() {
  const updated = "April 1, 2026"
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-bold text-indigo-600 text-xl tracking-tight">Summon Translator</Link>
        <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">Sign in</Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Notice at Collection</h1>
        <p className="text-sm text-gray-400 mb-2">For California Residents — California Consumer Privacy Act (CCPA)</p>
        <p className="text-sm text-gray-400 mb-10">Last updated: {updated}</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed text-gray-700">

          <section>
            <p>
              At or before the time we collect your personal information, California law requires us to disclose
              what we collect and how we use it. This Notice at Collection supplements our{" "}
              <Link href="/privacy" className="text-indigo-600 hover:underline">Privacy Policy</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Categories of personal information collected</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Category</th>
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Examples</th>
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Purpose</th>
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Retention</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">Identifiers</td>
                    <td className="border border-gray-200 px-3 py-2">Name, email address</td>
                    <td className="border border-gray-200 px-3 py-2">Account creation, authentication, communication</td>
                    <td className="border border-gray-200 px-3 py-2">While account is active</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2">Commercial information</td>
                    <td className="border border-gray-200 px-3 py-2">Job history, payment records</td>
                    <td className="border border-gray-200 px-3 py-2">Billing, receipts, dispute resolution</td>
                    <td className="border border-gray-200 px-3 py-2">7 years (tax/legal)</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2">Internet activity</td>
                    <td className="border border-gray-200 px-3 py-2">Pages visited, error logs</td>
                    <td className="border border-gray-200 px-3 py-2">Platform operation, fraud prevention</td>
                    <td className="border border-gray-200 px-3 py-2">90 days</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2">Customer content</td>
                    <td className="border border-gray-200 px-3 py-2">Uploaded files, translation output</td>
                    <td className="border border-gray-200 px-3 py-2">Providing the translation service</td>
                    <td className="border border-gray-200 px-3 py-2">Deleted 48 hours after job completion</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Sale or sharing of personal information</h2>
            <p>
              Summon Translator does <strong>not sell</strong> your personal information. We do not share your
              personal information with third parties for cross-context behavioral advertising.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Sensitive personal information</h2>
            <p>
              We do not intentionally collect sensitive personal information (e.g., government IDs, financial
              account numbers, health data, biometric data). If you upload files containing such information
              for translation, it is processed solely to deliver the translation and deleted per our retention policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Your rights</h2>
            <p>
              You have the right to know, delete, correct, and opt out of the sale of your personal information.
              To exercise these rights, see our{" "}
              <Link href="/do-not-sell" className="text-indigo-600 hover:underline">Do Not Sell page</Link>{" "}
              or email{" "}
              <a href="mailto:support@summontranslator.com" className="text-indigo-600 hover:underline">
                support@summontranslator.com
              </a>.
            </p>
          </section>

        </div>
      </main>

      
    </div>
  )
}
