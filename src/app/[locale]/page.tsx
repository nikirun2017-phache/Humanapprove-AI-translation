import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { Link } from "@/i18n/navigation"
import { CostEstimator } from "@/components/cost-estimator"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { getTranslations } from "next-intl/server"
import Image from "next/image"

export default async function Home() {
  const session = await auth()
  if (session?.user) redirect("/translation-studio")

  const t = await getTranslations()

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ── Nav ───────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-100 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Summon Translator" width={28} height={28} className="rounded-full" />
            <span className="font-semibold text-gray-900 text-base tracking-tight hidden sm:block">{t("nav.brand")}</span>
          </div>
          <div className="flex items-center gap-5">
            <LocaleSwitcher />
            <Link href="/vision" className="text-sm text-gray-400 hover:text-gray-700 transition-colors hidden sm:block">
              {t("nav.vision")}
            </Link>
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              {t("nav.signIn")}
            </Link>
            <Link
              href="/login?mode=signup"
              className="text-sm font-medium bg-gray-900 hover:bg-gray-700 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              {t("nav.signUp")}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <p className="text-sm text-indigo-600 font-medium tracking-wide mb-8 uppercase">
          {t("hero.badge")}
        </p>
        <h1 className="text-6xl sm:text-7xl font-bold tracking-tight text-gray-900 leading-[1.05] mb-6">
          {t("hero.h1Line1")}<br />
          <span className="text-indigo-600">{t("hero.h1Line2")}</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed font-light">
          {t("hero.description")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            href="/login?mode=signup"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3.5 rounded-full text-sm transition-colors shadow-sm"
          >
            {t("hero.cta1")}
          </Link>
          <a
            href="#how-it-works"
            className="text-gray-500 hover:text-gray-900 font-medium px-8 py-3.5 text-sm transition-colors"
          >
            {t("hero.cta2")} →
          </a>
        </div>
        <p className="text-xs text-gray-300 mt-5 tracking-wide">No card required · Pay only for what you use</p>
      </section>

      {/* ── Product screenshot ───────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="rounded-2xl border border-gray-100 shadow-2xl overflow-hidden bg-gray-50">
          <div className="bg-gray-100 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-300" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-300" />
            <span className="ml-3 flex-1 bg-white rounded px-3 py-0.5 text-xs text-gray-400 border border-gray-200">
              summontranslator.com/translation-studio
            </span>
          </div>
          <Image
            src="/screenshot-studio.png"
            alt="Translation Studio interface"
            width={1200}
            height={720}
            className="w-full h-auto block"
            priority
          />
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16 tracking-tight">{t("howItWorks.heading")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { step: "01", title: t("howItWorks.step1Title"), body: t("howItWorks.step1Body") },
              { step: "02", title: t("howItWorks.step2Title"), body: t("howItWorks.step2Body") },
              { step: "03", title: t("howItWorks.step3Title"), body: t("howItWorks.step3Body") },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <p className="text-xs font-semibold text-indigo-500 tracking-widest mb-4 uppercase">{item.step}</p>
                <h3 className="font-semibold text-gray-900 mb-3 text-base">{item.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Key capabilities ─────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-4 tracking-tight">{t("features.heading")}</h2>
          <p className="text-center text-gray-400 text-base mb-16 max-w-lg mx-auto font-light">
            From single files to multi-language campaigns — everything in one place.
          </p>

          {/* 3 studio cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            {[
              {
                badge: "Translation Studio",
                badgeColor: "bg-indigo-50 text-indigo-600",
                title: "Any file format",
                body: "JSON, PDF, XLIFF, Markdown, .strings, Android XML, and more. Upload once, download in every language.",
              },
              {
                badge: "LQA Studio",
                badgeColor: "bg-emerald-50 text-emerald-600",
                title: "Quality assurance",
                body: "AI-powered LQA scores translations on Accuracy, Language, and Style — then auto-revises issues in one click.",
              },
              {
                badge: "Media Studio",
                badgeColor: "bg-amber-50 text-amber-600",
                title: "Subtitle translation",
                body: "Upload .srt or .vtt subtitle files and receive a translated version with all timestamps intact.",
              },
            ].map((c) => (
              <div key={c.badge} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.badgeColor}`}>{c.badge}</span>
                <h3 className="font-semibold text-gray-900 mt-5 mb-2">{c.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              t("features.multiModel"),
              t("features.costTransparency"),
              t("features.languages"),
              t("features.auditTrail"),
              t("features.accessControl"),
              "API access",
              "Real-time progress",
            ].map((f) => (
              <span key={f} className="text-xs text-gray-500 px-3.5 py-1.5 rounded-full border border-gray-200 bg-white">
                {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Portfolio preview ────────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-3 tracking-tight">See it in action</h2>
            <p className="text-base text-gray-400 max-w-lg mx-auto font-light">
              A real eLearning safety course translated from English to Simplified Chinese — layout, fonts, and interactions fully localised.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {[
              { label: "Original · English", lang: "EN", langColor: "bg-blue-50 text-blue-600", src: "/high-voltage-safety-course.html", title: "High Voltage Safety" },
              { label: "Translated · Simplified Chinese", lang: "ZH-CN", langColor: "bg-red-50 text-red-600", src: "/high-voltage-safety-course-zh-CN.html", title: "高压电气安全" },
            ].map((item) => (
              <div key={item.lang} className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.langColor}`}>{item.lang}</span>
                    <span className="text-sm text-gray-500">{item.label}</span>
                  </div>
                  <a href={item.src} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
                    Open ↗
                  </a>
                </div>
                <div className="relative" style={{ paddingBottom: "56.25%" }}>
                  <iframe src={item.src} title={item.title} className="absolute inset-0 w-full h-full border-0" loading="lazy" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-24">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-3 tracking-tight">{t("pricing.heading")}</h2>
          <p className="text-center text-gray-400 text-base mb-16 font-light">{t("pricing.subheading")}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            {[
              { scenario: t("pricing.scenario1"), detail: t("pricing.scenario1Detail"), charge: t("pricing.scenario1Charge"), note: t("pricing.scenario1Note"), highlight: false },
              { scenario: t("pricing.scenario2"), detail: t("pricing.scenario2Detail"), charge: t("pricing.scenario2Charge"), note: t("pricing.scenario2Note"), highlight: true },
              { scenario: t("pricing.scenario3"), detail: t("pricing.scenario3Detail"), charge: t("pricing.scenario3Charge"), note: t("pricing.scenario3Note"), highlight: false },
            ].map((ex) => (
              <div key={ex.scenario} className={`relative rounded-2xl border p-6 bg-white ${ex.highlight ? "border-indigo-200 shadow-md" : "border-gray-100 shadow-sm"}`}>
                {ex.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-indigo-600 text-white text-xs font-medium px-3 py-1 rounded-full">{t("pricing.mostCommon")}</span>
                  </div>
                )}
                <p className="font-semibold text-gray-900 text-sm mb-1">{ex.scenario}</p>
                <p className="text-xs text-gray-400 mb-5 leading-relaxed">{ex.detail}</p>
                <div className="border-t border-gray-100 pt-4 text-right">
                  <p className="text-xs text-gray-300 uppercase tracking-wider mb-1">{t("pricing.estimatedCost")}</p>
                  <p className="text-3xl font-bold text-gray-900">{ex.charge}</p>
                </div>
                <p className="text-xs text-gray-300 mt-2">{ex.note}</p>
              </div>
            ))}
          </div>

          <CostEstimator />

          <p className="text-center text-sm text-gray-400 mt-8">
            First 10,000 words free — sign up and enter code{" "}
            <span className="font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">1TIME</span>{" "}
            at checkout
          </p>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section className="bg-gray-950 py-24">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">{t("cta.heading")}</h2>
          <p className="text-gray-400 mb-10 text-base leading-relaxed font-light">{t("cta.body")}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login?mode=signup"
              className="bg-white text-gray-900 hover:bg-gray-100 font-semibold px-8 py-3.5 rounded-full text-sm transition-colors"
            >
              Get started — code 1TIME
            </Link>
            <Link
              href="/login"
              className="text-gray-400 hover:text-white font-medium px-8 py-3.5 text-sm transition-colors"
            >
              Sign in →
            </Link>
          </div>
          <p className="text-gray-600 text-xs mt-6 tracking-wide">No card required · Cancel anytime</p>
        </div>
      </section>
    </div>
  )
}
