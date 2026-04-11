import { Link } from "@/i18n/navigation"
import NextLink from "next/link"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { getTranslations } from "next-intl/server"
import { PublicFooter } from "@/components/public-footer"

export default async function VisionPage() {
  const t = await getTranslations("vision")
  const tNav = await getTranslations("nav")

  const pillars = [
    {
      num: "01",
      title: t("p1Title"),
      subtitle: t("p1Subtitle"),
      points: [t("p1Point1"), t("p1Point2"), t("p1Point3")],
      shift: { from: t("p1From"), to: t("p1To") },
    },
    {
      num: "02",
      title: t("p2Title"),
      subtitle: t("p2Subtitle"),
      points: [t("p2Point1"), t("p2Point2"), t("p2Point3")],
      shift: { from: t("p2From"), to: t("p2To") },
    },
    {
      num: "03",
      title: t("p3Title"),
      subtitle: t("p3Subtitle"),
      points: [t("p3Point1"), t("p3Point2"), t("p3Point3"), t("p3Point4")],
      shift: { from: t("p3From"), to: t("p3To") },
    },
    {
      num: "04",
      title: t("p4Title"),
      subtitle: t("p4Subtitle"),
      points: [t("p4Point1"), t("p4Point2"), t("p4Point3"), t("p4Point4")],
      shift: { from: t("p4From"), to: t("p4To") },
    },
    {
      num: "05",
      title: t("p5Title"),
      subtitle: t("p5Subtitle"),
      points: [t("p5Point1"), t("p5Point2"), t("p5Point3"), t("p5Point4")],
      shift: { from: t("p5From"), to: t("p5To") },
    },
  ]

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="font-bold text-indigo-600 text-xl tracking-tight">
          {tNav("brand")}
        </Link>
        <div className="flex items-center gap-4">
          <LocaleSwitcher />
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            {tNav("home")}
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            {tNav("getStarted")}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          {t("badge")}
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 leading-tight mb-5">
          {t("h1Line1")}<br />
          <span className="text-indigo-600">{t("h1Line2")}</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
          {t("description")}
        </p>
      </section>

      {/* Pillars */}
      <section className="max-w-4xl mx-auto px-6 pb-24 space-y-0 divide-y divide-gray-100">
        {pillars.map((pillar) => (
          <div key={pillar.num} className="py-14 flex gap-10 items-start">
            {/* Number */}
            <span className="shrink-0 text-5xl font-black text-gray-100 leading-none select-none w-16 text-right pt-1">
              {pillar.num}
            </span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{pillar.title}</h2>
              <p className="text-sm font-medium text-indigo-500 mb-5">{pillar.subtitle}</p>

              <ul className="space-y-3 mb-8">
                {pillar.points.map((point, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-600 leading-relaxed">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>

              {/* Shift */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest mr-1">
                  {t("theShift")}
                </span>
                <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full border border-gray-200 line-through decoration-gray-400">
                  {pillar.shift.from}
                </span>
                <span className="text-gray-300 text-sm">→</span>
                <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full border border-indigo-200 font-medium">
                  {pillar.shift.to}
                </span>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="bg-gray-50 border-t border-gray-100 py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {t("ctaHeading")}
          </h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            {t("ctaBody")}
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/login"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors shadow-sm"
            >
              {t("ctaPrimary")}
            </Link>
            <Link
              href="/"
              className="border border-gray-200 hover:border-gray-300 text-gray-700 font-medium px-6 py-3 rounded-xl text-sm transition-colors"
            >
              {t("ctaSecondary")}
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter showLocale LocaleSwitcherComponent={<LocaleSwitcher />} />
    </div>
  )
}
