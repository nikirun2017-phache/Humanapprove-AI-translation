import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { Link } from "@/i18n/navigation"
import { CostEstimator } from "@/components/cost-estimator"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { getTranslations } from "next-intl/server"

export default async function Home() {
  const session = await auth()
  if (session?.user) redirect("/translation-studio")

  const t = await getTranslations()

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <span className="font-bold text-indigo-600 text-xl tracking-tight">{t("nav.brand")}</span>
        <div className="flex items-center gap-4">
          <LocaleSwitcher />
          <Link
            href="/vision"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            {t("nav.vision")}
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            {t("nav.signIn")}
          </Link>
          <Link
            href="/login?mode=signup"
            className="text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg transition-colors"
          >
            {t("nav.signUp")}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          {t("hero.badge")}
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 leading-tight mb-6">
          {t("hero.h1Line1")}<br />
          <span className="text-indigo-600">{t("hero.h1Line2")}</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          {t("hero.description")}
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/login"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors shadow-sm"
          >
            {t("hero.cta1")}
          </Link>
          <a
            href="#how-it-works"
            className="border border-gray-200 hover:border-gray-300 text-gray-700 font-medium px-6 py-3 rounded-xl text-sm transition-colors"
          >
            {t("hero.cta2")}
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
              app.jendee.ai/projects/demo
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
        <p className="text-center text-xs text-gray-400 mt-3">{t("mockPreview.caption")}</p>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-gray-50 border-y border-gray-100 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">{t("howItWorks.heading")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "1", title: t("howItWorks.step1Title"), body: t("howItWorks.step1Body") },
              { step: "2", title: t("howItWorks.step2Title"), body: t("howItWorks.step2Body") },
              { step: "3", title: t("howItWorks.step3Title"), body: t("howItWorks.step3Body") },
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
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">{t("features.heading")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: "⚡", title: t("features.multiModel"), body: t("features.multiModelBody") },
            { icon: "🧾", title: t("features.costTransparency"), body: t("features.costTransparencyBody") },
            { icon: "📄", title: t("features.pdfSupport"), body: t("features.pdfSupportBody") },
            { icon: "🔍", title: t("features.auditTrail"), body: t("features.auditTrailBody") },
            { icon: "🌍", title: t("features.languages"), body: t("features.languagesBody") },
            { icon: "🔒", title: t("features.accessControl"), body: t("features.accessControlBody") },
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
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-3">{t("pricing.heading")}</h2>
          <p className="text-center text-gray-500 text-sm mb-12">{t("pricing.subheading")}</p>

          {/* Examples */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center mb-4">{t("pricing.examplesLabel")}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[
              {
                scenario: t("pricing.scenario1"),
                detail: t("pricing.scenario1Detail"),
                charge: t("pricing.scenario1Charge"),
                note: t("pricing.scenario1Note"),
                highlight: false,
              },
              {
                scenario: t("pricing.scenario2"),
                detail: t("pricing.scenario2Detail"),
                charge: t("pricing.scenario2Charge"),
                note: t("pricing.scenario2Note"),
                highlight: true,
              },
              {
                scenario: t("pricing.scenario3"),
                detail: t("pricing.scenario3Detail"),
                charge: t("pricing.scenario3Charge"),
                note: t("pricing.scenario3Note"),
                highlight: false,
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
                    <span className="bg-indigo-600 text-white text-xs font-medium px-3 py-1 rounded-full">{t("pricing.mostCommon")}</span>
                  </div>
                )}
                <p className="font-semibold text-gray-900 text-sm mb-1">{ex.scenario}</p>
                <p className="text-xs text-gray-400 mb-4 leading-relaxed">{ex.detail}</p>
                <div className="border-t border-gray-100 pt-3 text-right">
                  <p className="text-xs text-gray-400">{t("pricing.estimatedCost")}</p>
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
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">{t("pricing.includedHeading")}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {(["included1","included2","included3","included4","included5","included6","included7","included8","included9"] as const).map((key) => (
                <div key={key} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                  {t(`pricing.${key}`)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">{t("cta.heading")}</h2>
        <p className="text-gray-500 mb-8">{t("cta.body")}</p>
        <Link
          href="/login"
          className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors shadow-sm"
        >
          {t("cta.button")}
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <span className="font-bold text-indigo-600 tracking-tight">{t("nav.brand")}</span>
          <p className="text-xs text-gray-400">{t("footer.rights", { year: new Date().getFullYear() })}</p>
        </div>
      </footer>
    </div>
  )
}
