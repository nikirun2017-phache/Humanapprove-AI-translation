import Link from "next/link"

export const metadata = {
  title: "Cookie Policy — Summon Translator",
  description: "How Summon Translator uses cookies and similar technologies.",
}

export default function CookiePolicyPage() {
  const updated = "April 1, 2026"
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-bold text-indigo-600 text-xl tracking-tight">Summon Translator</Link>
        <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">Sign in</Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Cookie Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: {updated}</p>

        <div className="prose prose-gray max-w-none space-y-8 text-sm leading-relaxed text-gray-700">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">What are cookies?</h2>
            <p>
              Cookies are small text files placed on your device when you visit a website. They are widely used
              to make websites work, or to work more efficiently, and to provide information to site operators.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Cookies we use</h2>
            <p>Summon Translator uses only the following cookies:</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Cookie name</th>
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Purpose</th>
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Duration</th>
                    <th className="border border-gray-200 px-3 py-2 text-left font-semibold text-gray-700">Type</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2 font-mono">next-auth.session-token</td>
                    <td className="border border-gray-200 px-3 py-2">Keeps you signed in. Contains an encrypted session identifier.</td>
                    <td className="border border-gray-200 px-3 py-2">Session / 30 days</td>
                    <td className="border border-gray-200 px-3 py-2">Strictly necessary</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2 font-mono">next-auth.csrf-token</td>
                    <td className="border border-gray-200 px-3 py-2">Prevents cross-site request forgery attacks on sign-in forms.</td>
                    <td className="border border-gray-200 px-3 py-2">Session</td>
                    <td className="border border-gray-200 px-3 py-2">Strictly necessary</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 px-3 py-2 font-mono">NEXT_LOCALE</td>
                    <td className="border border-gray-200 px-3 py-2">Remembers your preferred display language.</td>
                    <td className="border border-gray-200 px-3 py-2">1 year</td>
                    <td className="border border-gray-200 px-3 py-2">Functional</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Cookies we do NOT use</h2>
            <p>We do not use advertising cookies, tracking pixels, or third-party analytics cookies. We do not share cookie data with advertisers.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Managing cookies</h2>
            <p>
              You can control and/or delete cookies through your browser settings. Note that disabling strictly
              necessary cookies will prevent you from signing in to Summon Translator.
            </p>
            <p className="mt-3">
              For instructions on managing cookies in your browser, visit{" "}
              <a href="https://www.allaboutcookies.org" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                allaboutcookies.org
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Contact</h2>
            <p>
              Questions about this policy?{" "}
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
