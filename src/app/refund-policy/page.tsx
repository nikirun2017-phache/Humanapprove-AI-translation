import Link from "next/link"

export const metadata = {
  title: "Refund Policy — Summon Translator",
  description: "Summon Translator's refund policy for translation jobs.",
}

export default function RefundPolicyPage() {
  const updated = "April 1, 2026"
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-bold text-indigo-600 text-xl tracking-tight">Summon Translator</Link>
        <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">Sign in</Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Refund Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: {updated}</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed text-gray-700">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">When you are eligible for a refund</h2>
            <p>
              You may request a full refund within <strong>14 days of the job completion date</strong> if the
              Summon Translator platform failed to deliver a translation due to a platform error. Examples include:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>The job completed but the output file is empty or corrupted.</li>
              <li>The translated file cannot be downloaded due to a platform error.</li>
              <li>You were charged for a job that failed to process.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">When refunds are not available</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You received the translated output but chose not to use it.</li>
              <li>The translation quality did not meet your expectations (AI translation is provided as-is; consider adding a human reviewer for quality-critical content).</li>
              <li>The refund request is made more than 14 days after job completion.</li>
              <li>The job was cancelled by you after processing began.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">How to request a refund</h2>
            <p>
              Email{" "}
              <a href="mailto:support@summontranslator.com" className="text-indigo-600 hover:underline">
                support@summontranslator.com
              </a>{" "}
              with:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Your account email address</li>
              <li>The Job ID (found in My Jobs)</li>
              <li>A brief description of the issue</li>
            </ul>
            <p className="mt-3">
              We aim to process all refund requests within 3–5 business days. Refunds are returned to the
              original payment method.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Failed jobs</h2>
            <p>
              Jobs that fail before completion are <strong>never charged</strong>. If a job fails mid-processing,
              you will not be billed for that job.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Questions</h2>
            <p>
              <a href="mailto:support@summontranslator.com" className="text-indigo-600 hover:underline">
                support@summontranslator.com
              </a>
            </p>
          </section>

        </div>
      </main>

      
    </div>
  )
}
