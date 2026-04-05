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
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          {t("hero.badge")}
        </div>
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 ml-2">
          🎁 Translate your first 10,000 words free — use code <span className="font-mono bg-green-100 px-1.5 py-0.5 rounded">1TIME</span>
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
            href="/login?mode=signup"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors shadow-sm"
          >
            Start free — 10,000 words on us
          </Link>
          <a
            href="#how-it-works"
            className="border border-gray-200 hover:border-gray-300 text-gray-700 font-medium px-6 py-3 rounded-xl text-sm transition-colors"
          >
            {t("hero.cta2")}
          </a>
        </div>
        <p className="text-xs text-gray-400 mt-3">No credit card required · Cancel anytime</p>
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
              summontranslator.com/translation-studio
            </span>
          </div>
          {/* Fake translation studio */}
          <div className="p-6 bg-white space-y-5">
            {/* Step indicator */}
            <div className="flex items-center gap-2 text-xs font-medium">
              {["Upload", "Configure", "Translate", "Download"].map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-400"}`}>{i + 1}</div>
                  <span className={i < 3 ? "text-gray-700" : "text-gray-400"}>{s}</span>
                  {i < 3 && <span className="text-gray-300">›</span>}
                </div>
              ))}
            </div>
            {/* Job in progress */}
            <div className="border border-gray-100 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-gray-900">app-strings.json</p>
                  <p className="text-xs text-gray-400 mt-0.5">Claude Sonnet · 5 languages · 500 strings</p>
                </div>
                <span className="bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full">Translating…</span>
              </div>
              <div className="space-y-2">
                {[
                  { lang: "Spanish", pct: 100, done: true },
                  { lang: "French", pct: 100, done: true },
                  { lang: "Japanese", pct: 68, done: false },
                  { lang: "German", pct: 0, done: false },
                  { lang: "Arabic", pct: 0, done: false },
                ].map((row) => (
                  <div key={row.lang} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-16 shrink-0">{row.lang}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${row.done ? "bg-green-500" : "bg-indigo-500"}`}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                    <span className="text-xs w-8 text-right text-gray-400">{row.done ? "✓" : row.pct > 0 ? `${row.pct}%` : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center">Files download automatically when each language finishes</p>
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
          <div className="mb-4">
            <CostEstimator />
          </div>
          <div className="flex items-center justify-center gap-2 bg-green-50 border border-green-200 text-green-800 text-sm font-medium px-4 py-3 rounded-xl mb-8">
            🎁 <span>Your first 10,000 words are free — sign up and enter code <span className="font-mono font-bold">1TIME</span> at checkout</span>
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
        <p className="text-gray-500 mb-6">{t("cta.body")}</p>
        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 text-sm font-medium px-4 py-2 rounded-lg mb-6">
          🎁 Your first 10,000 words are free — no credit card needed
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login?mode=signup"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3 rounded-xl text-sm transition-colors shadow-sm"
          >
            Start free — use code 1TIME at checkout
          </Link>
          <Link
            href="/login"
            className="inline-block border border-gray-200 hover:border-gray-300 text-gray-700 font-medium px-8 py-3 rounded-xl text-sm transition-colors"
          >
            Sign in
          </Link>
        </div>
        <p className="text-xs text-gray-400 mt-4">Cancel anytime · Pay only for what you translate</p>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-bold text-indigo-600 tracking-tight">{t("nav.brand")}</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Terms of Service
            </Link>
            <p className="text-xs text-gray-400">{t("footer.rights", { year: new Date().getFullYear() })}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
