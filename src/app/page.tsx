import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import Link from "next/link"
import { CostEstimator } from "@/components/cost-estimator"

export default async function Home() {
  const session = await auth()
  if (session?.user) redirect("/dashboard")

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <span className="font-bold text-indigo-600 text-xl tracking-tight">Reviso</span>
        <div className="flex items-center gap-6">
          <Link
            href="/vision"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            Our vision
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Sign in →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          AI translation · Human review · Full audit trail
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 leading-tight mb-6">
          Translate at AI speed.<br />
          <span className="text-indigo-600">Review with human precision.</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Reviso combines Claude, GPT-4o, and Gemini to translate your content in seconds,
          then routes it to qualified human reviewers for final sign-off — all in one auditable workflow.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/login"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors shadow-sm"
          >
            Get started free
          </Link>
          <a
            href="#how-it-works"
            className="border border-gray-200 hover:border-gray-300 text-gray-700 font-medium px-6 py-3 rounded-xl text-sm transition-colors"
          >
            See how it works
          </a>
        </div>
      </section>

      {/* Mock UI preview */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="rounded-2xl border border-gray-200 shadow-xl overflow-hidden bg-gray-50">
          {/* Fake browser chrome */}
          <div className="bg-gray-100 border-b border-gray-200 px-4 py-3 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-300" />
            <span className="w-3 h-3 rounded-full bg-yellow-300" />
            <span className="w-3 h-3 rounded-full bg-green-300" />
            <span className="ml-4 flex-1 bg-white rounded px-3 py-1 text-xs text-gray-400 border border-gray-200">
              app.reviso.io/projects/demo
            </span>
          </div>
          {/* Fake review editor */}
          <div className="grid grid-cols-3 divide-x divide-gray-200 min-h-64">
            {/* Unit list */}
            <div className="p-4 space-y-2 bg-white">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">Units</p>
              {[
                { id: "nav.home", status: "approved", src: "Home" },
                { id: "nav.about", status: "approved", src: "About" },
                { id: "dashboard.welcome", status: "pending", src: "Welcome back, {name}!" },
                { id: "errors.required", status: "rejected", src: "This field is required" },
                { id: "buttons.save", status: "pending", src: "Save" },
              ].map((u) => (
                <div
                  key={u.id}
                  className={`px-3 py-2 rounded-lg text-xs flex items-center justify-between ${
                    u.id === "dashboard.welcome" ? "bg-indigo-50 border border-indigo-200" : "bg-gray-50"
                  }`}
                >
                  <span className="text-gray-500 font-mono truncate">{u.id}</span>
                  <span className={
                    u.status === "approved" ? "text-green-500" :
                    u.status === "rejected" ? "text-red-500" : "text-gray-300"
                  }>
                    {u.status === "approved" ? "✓" : u.status === "rejected" ? "✗" : "○"}
                  </span>
                </div>
              ))}
            </div>
            {/* Editor */}
            <div className="col-span-2 p-5 space-y-4 bg-white">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Source</p>
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">Welcome back, {"{name}"}!</div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Target · Japanese</p>
                <div className="bg-white border-2 border-indigo-300 rounded-lg p-3 text-sm text-gray-800">
                  お帰りなさい、{"{name}"}さん！
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <div className="flex-1 bg-green-600 text-white text-xs font-medium py-2 rounded-lg text-center">✓ Approve</div>
                <div className="flex-1 border border-red-200 text-red-600 text-xs font-medium py-2 rounded-lg text-center">✗ Reject</div>
              </div>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-3">Reviso review editor — approve, reject, or revise in one click</p>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-gray-50 border-y border-gray-100 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Upload your content",
                body: "Drop a JSON, CSV, Markdown, XLIFF, or PDF file. Reviso parses it and extracts every translatable string automatically.",
              },
              {
                step: "2",
                title: "AI translates instantly",
                body: "Choose Claude, GPT-4o, DeepSeek, or Gemini. Get a cost estimate per language before committing. Translation runs in parallel across all targets.",
              },
              {
                step: "3",
                title: "Humans review & approve",
                body: "Reviewers see source and target side-by-side, edit in-place, approve or reject with one click. Every action is logged in the audit trail.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-10 h-10 rounded-full bg-indigo-600 text-white text-lg font-bold flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Built for translation teams</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: "⚡", title: "Multi-model AI", body: "Claude, GPT-4o, Gemini, DeepSeek — pick the best model for each language pair." },
            { icon: "🧾", title: "Cost transparency", body: "See a per-language cost breakdown before every job. No surprise API bills." },
            { icon: "📄", title: "PDF & Vision support", body: "Scanned PDFs are automatically processed with Claude Vision. No manual extraction needed." },
            { icon: "🔍", title: "Full audit trail", body: "Every approval, rejection, and edit is timestamped and attributed to a reviewer." },
            { icon: "🌍", title: "105+ languages", body: "Presets for EMEA, LATAM, APAC, and All English variants. Search by region or BCP-47 code." },
            { icon: "🔒", title: "Role-based access", body: "Admins, requesters, and reviewers each see only what they need. Enterprise SSO available." },
          ].map((f) => (
            <div key={f.title} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-gray-50 border-y border-gray-100 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-3">Pay as you go</h2>
          <p className="text-center text-gray-500 text-sm mb-12">No subscription. No seat fees. Pay only for what you translate.</p>

          {/* Examples */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center mb-4">Real-world examples</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[
              {
                scenario: "Small app localization",
                detail: "500 strings · Claude Sonnet · 5 languages",
                charge: "$2.40",
                note: "Typical mobile app update",
              },
              {
                scenario: "Patient consent forms",
                detail: "12 documents · Claude Sonnet · 4 languages",
                charge: "$31.00",
                note: "Hospital onboarding packet",
                highlight: true,
              },
              {
                scenario: "Scanned PDF manual",
                detail: "40-page PDF · Vision extraction · 2 languages",
                charge: "$54.00",
                note: "Includes Vision AI extraction",
              },
            ].map((ex) => (
              <div
                key={ex.scenario}
                className={`relative rounded-xl border p-5 bg-white ${
                  ex.highlight ? "border-indigo-300 shadow-sm" : "border-gray-200"
                }`}
              >
                {ex.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-indigo-600 text-white text-xs font-medium px-3 py-1 rounded-full">Most common</span>
                  </div>
                )}
                <p className="font-semibold text-gray-900 text-sm mb-1">{ex.scenario}</p>
                <p className="text-xs text-gray-400 mb-4 leading-relaxed">{ex.detail}</p>
                <div className="border-t border-gray-100 pt-3 text-right">
                  <p className="text-xs text-gray-400">Estimated cost</p>
                  <p className="text-2xl font-bold text-indigo-600">{ex.charge}</p>
                </div>
                <p className="text-xs text-gray-400 mt-2 italic">{ex.note}</p>
              </div>
            ))}
          </div>

          {/* Estimator */}
          <div className="mb-8">
            <CostEstimator />
          </div>

          {/* Included */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Everything included — no tiers</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                "Unlimited projects & languages",
                "All AI models (Claude, GPT-4o, Gemini, DeepSeek)",
                "Human review workflow",
                "PDF & Vision AI extraction",
                "Full audit trail",
                "XLIFF, JSON, CSV, Markdown support",
                "Role-based access (admin, reviewer, requester)",
                "Download in original format",
                "Email support",
              ].map((f) => (
                <div key={f} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                  {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to ship better translations?</h2>
        <p className="text-gray-500 mb-8">Join teams that trust Reviso to get accurate translations reviewed and approved faster.</p>
        <Link
          href="/login"
          className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors shadow-sm"
        >
          Get started free →
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <span className="font-bold text-indigo-600 tracking-tight">Reviso</span>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} Reviso. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
