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
            <span className="font-bold text-indigo-600 text-lg tracking-tight hidden sm:block">{t("nav.brand")}</span>
          </div>
          <div className="flex items-center gap-4">
            <LocaleSwitcher />
            <Link href="/vision" className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:block">
              {t("nav.vision")}
            </Link>
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              {t("nav.signIn")}
            </Link>
            <Link
              href="/login?mode=signup"
              className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              {t("nav.signUp")}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
          🎁 First 10,000 words free — use code{" "}
          <span className="font-mono bg-green-100 text-green-800 px-1.5 py-0.5 rounded">1TIME</span>
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-gray-900 leading-tight mb-5">
          {t("hero.h1Line1")}<br />
          <span className="text-indigo-600">{t("hero.h1Line2")}</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-8 leading-relaxed">
          {t("hero.description")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/login?mode=signup"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-7 py-3 rounded-xl text-sm transition-colors shadow-sm"
          >
            Start free — 10,000 words on us
          </Link>
          <a
            href="#how-it-works"
            className="border border-gray-200 hover:border-gray-300 text-gray-700 font-medium px-7 py-3 rounded-xl text-sm transition-colors"
          >
            {t("hero.cta2")}
          </a>
        </div>
        <p className="text-xs text-gray-400 mt-3">No credit card required · Pay only for what you use</p>
      </section>

      {/* ── Product screenshot ───────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="rounded-2xl border border-gray-200 shadow-xl overflow-hidden bg-gray-50">
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
      <section id="how-it-works" className="bg-gray-50 border-y border-gray-100 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-10">{t("howItWorks.heading")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "1", title: t("howItWorks.step1Title"), body: t("howItWorks.step1Body") },
              { step: "2", title: t("howItWorks.step2Title"), body: t("howItWorks.step2Body") },
              { step: "3", title: t("howItWorks.step3Title"), body: t("howItWorks.step3Body") },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-9 h-9 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center mx-auto mb-3">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1.5">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Key capabilities ─────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-3">{t("features.heading")}</h2>
        <p className="text-center text-gray-500 text-sm mb-10 max-w-xl mx-auto">
          Everything you need to translate professional content at scale — from single files to multi-language campaigns.
        </p>

        {/* 3 studio cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {[
            {
              badge: "Translation Studio",
              badgeColor: "bg-indigo-50 text-indigo-700",
              icon: "📄",
              title: "Any file format",
              body: "JSON, PDF, XLIFF, Markdown, .strings, Android XML, and more. Upload once, download in every language.",
            },
            {
              badge: "LQA Studio",
              badgeColor: "bg-emerald-50 text-emerald-700",
              icon: "✅",
              title: "Quality assurance",
              body: "AI-powered LQA scores translations on Accuracy, Language, and Style — then auto-revises issues.",
            },
            {
              badge: "Media Studio",
              badgeColor: "bg-amber-50 text-amber-700",
              icon: "🎬",
              title: "Subtitle translation",
              body: "Upload .srt or .vtt subtitle files and get back a translated version with all timestamps intact.",
            },
          ].map((c) => (
            <div key={c.badge} className="bg-white border border-gray-200 rounded-xl p-5">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.badgeColor}`}>{c.badge}</span>
              <div className="text-2xl mt-3 mb-2">{c.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{c.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{c.body}</p>
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
            <span key={f} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full border border-gray-200">
              ✓ {f}
            </span>
          ))}
        </div>
      </section>

      {/* ── Portfolio preview ────────────────────────────────────────────────── */}
      <section className="bg-gray-50 border-y border-gray-100 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">See it in action</h2>
            <p className="text-sm text-gray-500 max-w-xl mx-auto">
              A real eLearning safety course translated from English to Simplified Chinese — layout, fonts, and interactions fully localised.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {[
              { label: "Original · English", lang: "EN", langColor: "bg-blue-100 text-blue-700", src: "/high-voltage-safety-course.html", title: "High Voltage Safety" },
              { label: "Translated · Simplified Chinese", lang: "ZH-CN", langColor: "bg-red-100 text-red-700", src: "/high-voltage-safety-course-zh-CN.html", title: "高压电气安全" },
            ].map((item) => (
              <div key={item.lang} className="rounded-xl border border-gray-200 shadow-sm overflow-hidden bg-white flex flex-col">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.langColor}`}>{item.lang}</span>
                    <span className="text-sm text-gray-600">{item.label}</span>
                  </div>
                  <a href={item.src} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">
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
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-2">{t("pricing.heading")}</h2>
        <p className="text-center text-gray-500 text-sm mb-10">{t("pricing.subheading")}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { scenario: t("pricing.scenario1"), detail: t("pricing.scenario1Detail"), charge: t("pricing.scenario1Charge"), note: t("pricing.scenario1Note"), highlight: false },
            { scenario: t("pricing.scenario2"), detail: t("pricing.scenario2Detail"), charge: t("pricing.scenario2Charge"), note: t("pricing.scenario2Note"), highlight: true },
            { scenario: t("pricing.scenario3"), detail: t("pricing.scenario3Detail"), charge: t("pricing.scenario3Charge"), note: t("pricing.scenario3Note"), highlight: false },
          ].map((ex) => (
            <div key={ex.scenario} className={`relative rounded-xl border p-5 bg-white ${ex.highlight ? "border-indigo-300 shadow-sm" : "border-gray-200"}`}>
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

        <CostEstimator />

        <div className="mt-6 flex items-center justify-center gap-2 bg-green-50 border border-green-200 text-green-800 text-sm font-medium px-4 py-3 rounded-xl">
          🎁 <span>First 10,000 words free — sign up and enter code <span className="font-mono font-bold">1TIME</span></span>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section className="bg-indigo-600 py-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-3">{t("cta.heading")}</h2>
          <p className="text-indigo-200 mb-8 text-sm leading-relaxed">{t("cta.body")}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login?mode=signup"
              className="bg-white text-indigo-600 hover:bg-indigo-50 font-semibold px-8 py-3 rounded-xl text-sm transition-colors shadow-sm"
            >
              Start free — use code 1TIME
            </Link>
            <Link
              href="/login"
              className="border border-indigo-400 hover:border-indigo-300 text-white font-medium px-8 py-3 rounded-xl text-sm transition-colors"
            >
              Sign in
            </Link>
          </div>
          <p className="text-indigo-300 text-xs mt-4">No credit card required · Cancel anytime</p>
        </div>
      </section>
    </div>
  )
}
