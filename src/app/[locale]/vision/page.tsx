import { Link } from "@/i18n/navigation"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { getTranslations } from "next-intl/server"
import Image from "next/image"

export default async function VisionPage() {
  const t = await getTranslations("vision")
  const tNav = await getTranslations("nav")

  const pillars = [
    {
      num: "01",
      icon: "🧠",
      title: t("p1Title"),
      subtitle: t("p1Subtitle"),
      points: [t("p1Point1"), t("p1Point2"), t("p1Point3")],
      shift: { from: t("p1From"), to: t("p1To") },
    },
    {
      num: "02",
      icon: "⚡",
      title: t("p2Title"),
      subtitle: t("p2Subtitle"),
      points: [t("p2Point1"), t("p2Point2"), t("p2Point3")],
      shift: { from: t("p2From"), to: t("p2To") },
    },
    {
      num: "03",
      icon: "✅",
      title: t("p3Title"),
      subtitle: t("p3Subtitle"),
      points: [t("p3Point1"), t("p3Point2"), t("p3Point3"), t("p3Point4")],
      shift: { from: t("p3From"), to: t("p3To") },
    },
    {
      num: "04",
      icon: "👤",
      title: t("p4Title"),
      subtitle: t("p4Subtitle"),
      points: [t("p4Point1"), t("p4Point2"), t("p4Point3"), t("p4Point4")],
      shift: { from: t("p4From"), to: t("p4To") },
    },
    {
      num: "05",
      icon: "🔗",
      title: t("p5Title"),
      subtitle: t("p5Subtitle"),
      points: [t("p5Point1"), t("p5Point2"), t("p5Point3"), t("p5Point4")],
      shift: { from: t("p5From"), to: t("p5To") },
    },
  ]

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ── Nav (matches home page) ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-100 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Summon Translator" width={28} height={28} className="rounded-full" />
            <span className="font-bold text-indigo-600 text-lg tracking-tight hidden sm:block">{tNav("brand")}</span>
          </Link>
          <div className="flex items-center gap-4">
            <LocaleSwitcher />
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:block">
              {tNav("home")}
            </Link>
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              {tNav("signIn")}
            </Link>
            <Link
              href="/login?mode=signup"
              className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              {tNav("signUp")}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 pt-14 pb-10 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          {t("badge")}
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight mb-4">
          {t("h1Line1")}<br />
          <span className="text-indigo-600">{t("h1Line2")}</span>
        </h1>
        <p className="text-base text-gray-500 max-w-xl mx-auto leading-relaxed">
          {t("description")}
        </p>
      </section>

      {/* ── Pillars grid ─────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {pillars.map((pillar) => (
            <div key={pillar.num} className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-xl shrink-0">
                  {pillar.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-0.5">{pillar.num}</p>
                  <h2 className="text-base font-bold text-gray-900 leading-tight">{pillar.title}</h2>
                  <p className="text-xs text-indigo-500 font-medium mt-0.5">{pillar.subtitle}</p>
                </div>
              </div>

              {/* Points */}
              <ul className="space-y-2">
                {pillar.points.map((point, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600 leading-relaxed">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-300 shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>

              {/* Shift */}
              <div className="mt-auto pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {t("theShift")}
                </span>
                <span className="text-xs bg-gray-100 text-gray-400 px-2.5 py-1 rounded-full border border-gray-200 line-through">
                  {pillar.shift.from}
                </span>
                <span className="text-gray-300 text-xs">→</span>
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-200 font-medium">
                  {pillar.shift.to}
                </span>
              </div>
            </div>
          ))}

          {/* Filler card / CTA for the 5th item in a 2-col grid */}
          <div className="bg-indigo-600 rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <p className="text-indigo-200 text-xs font-semibold uppercase tracking-widest mb-3">Ready to try?</p>
              <h3 className="text-xl font-bold text-white mb-2">{t("ctaHeading")}</h3>
              <p className="text-indigo-200 text-sm leading-relaxed">{t("ctaBody")}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-6">
              <Link
                href="/login?mode=signup"
                className="bg-white text-indigo-600 hover:bg-indigo-50 font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors text-center"
              >
                {t("ctaPrimary")}
              </Link>
              <Link
                href="/"
                className="border border-indigo-400 hover:border-indigo-300 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-colors text-center"
              >
                {t("ctaSecondary")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
