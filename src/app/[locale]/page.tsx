import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { Link } from "@/i18n/navigation"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { getTranslations } from "next-intl/server"
import Image from "next/image"
import { PLANS, formatWords } from "@/lib/plans"

const PAID_PLANS = [PLANS.starter, PLANS.growth, PLANS.business, PLANS.payg]

const COMPARISON_ROWS: { label: string; starter: string; growth: string; business: string; payg: string }[] = [
  { label: "Words / month",          starter: "50,000",   growth: "250,000",  business: "1,000,000", payg: "Unlimited" },
  { label: "File formats",           starter: "All 20+",  growth: "All 20+",  business: "All 20+",   payg: "All 20+"   },
  { label: "CMS integrations",       starter: "15+",      growth: "15+",      business: "15+",       payg: "15+"       },
  { label: "Translation Memory",     starter: "Yes",      growth: "Yes",      business: "Yes",       payg: "Yes"       },
  { label: "Glossary management",    starter: "Yes",      growth: "Yes",      business: "Yes",       payg: "Yes"       },
  { label: "LQA Studio",             starter: "Yes",      growth: "Yes",      business: "Yes",       payg: "Yes"       },
  { label: "Priority AI model access", starter: "—",      growth: "Yes",      business: "Yes",       payg: "—"         },
  { label: "Usage analytics",        starter: "—",        growth: "Yes",      business: "Yes",       payg: "—"         },
  { label: "REST API access",        starter: "—",        growth: "—",        business: "Yes",       payg: "—"         },
  { label: "Custom integrations",    starter: "—",        growth: "—",        business: "Yes",       payg: "—"         },
  { label: "Support",                starter: "Community",growth: "Email",    business: "Priority",  payg: "Community" },
]

const FAQS = [
  { q: "Can I change plans at any time?", a: "Yes. Upgrade or downgrade at any time from billing settings. Upgrades take effect immediately; downgrades apply at the next billing period." },
  { q: "What happens if I exceed my word quota?", a: "Translations pause once you hit your monthly limit. Upgrade to continue, or wait for your quota to reset at the start of your next billing period." },
  { q: "Does unused quota roll over?", a: "No. Word quotas reset each billing cycle and do not carry over. If you consistently have leftover quota, consider a smaller plan." },
  { q: "How does pay-as-you-go pricing work?", a: "You are charged per translated word based on actual usage, with no monthly commitment. Add a card and you will only be billed for what you use each month." },
  { q: "Is there a free trial?", a: "Yes. Every new account starts with a one-time 10,000-word free trial — no card required." },
  { q: "Do you offer annual billing?", a: "Annual billing with a 2-month discount is available — contact us and we will set it up for you." },
  { q: "Is my data secure?", a: "All data is encrypted in transit (TLS) and at rest. We never use your content to train AI models." },
]

function PlanCheckIcon({ popular }: { popular?: boolean }) {
  return (
    <svg className={`h-4 w-4 shrink-0 mt-0.5 ${popular ? "text-indigo-200" : "text-indigo-600"}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  )
}

function TableCheck({ value }: { value: string }) {
  if (value === "Yes") return (
    <span className="flex justify-center">
      <svg className="h-4 w-4 text-indigo-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
      </svg>
    </span>
  )
  if (value === "—") return <span className="flex justify-center text-gray-300" aria-label="Not included">—</span>
  return <span className="flex justify-center text-xs text-gray-700">{value}</span>
}

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
            <a href="#pricing" className="text-sm text-gray-500 hover:text-gray-900 transition-colors hidden sm:block">
              Pricing
            </a>
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
      <section id="pricing" className="py-20 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">

          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Simple, transparent pricing</h2>
            <p className="text-gray-500 text-sm max-w-2xl mx-auto">
              Start for free, then scale as you grow. Every plan includes all file formats, CMS integrations, and LQA Studio.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
              Save 2 months with annual billing —{" "}
              <a href="mailto:hello@summontranslator.com" className="underline underline-offset-2 hover:text-indigo-900">contact us</a>
            </p>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {PAID_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={[
                  "relative flex flex-col rounded-2xl border p-8",
                  plan.popular
                    ? "border-indigo-600 bg-indigo-600 shadow-2xl text-white"
                    : "border-gray-200 bg-white shadow-sm text-gray-900",
                ].join(" ")}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-indigo-500 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-white ring-2 ring-white shadow">
                      Most popular
                    </span>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className={["text-lg font-semibold", plan.popular ? "text-white" : "text-gray-900"].join(" ")}>
                    {plan.name}
                  </h3>
                  {plan.price > 0 ? (
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className={["text-4xl font-bold tracking-tight", plan.popular ? "text-white" : "text-gray-900"].join(" ")}>
                        ${plan.price}
                      </span>
                      <span className={["text-sm", plan.popular ? "text-indigo-200" : "text-gray-500"].join(" ")}>/mo</span>
                    </div>
                  ) : plan.id === "payg" ? (
                    <div className="mt-2">
                      <span className={["text-4xl font-bold tracking-tight", plan.popular ? "text-white" : "text-gray-900"].join(" ")}>
                        Usage
                      </span>
                      <p className={["mt-1 text-sm", plan.popular ? "text-indigo-200" : "text-gray-500"].join(" ")}>billed monthly</p>
                    </div>
                  ) : null}
                  {plan.wordsPerMonth !== Infinity && (
                    <p className={["mt-2 text-sm font-medium", plan.popular ? "text-indigo-100" : "text-indigo-600"].join(" ")}>
                      {formatWords(plan.wordsPerMonth)} words / month
                    </p>
                  )}
                </div>
                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <PlanCheckIcon popular={plan.popular} />
                      <span className={["text-sm", plan.popular ? "text-indigo-100" : "text-gray-600"].join(" ")}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/login?plan=${plan.id}`}
                  className={[
                    "block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold transition-colors duration-150",
                    plan.popular
                      ? "bg-white text-indigo-600 hover:bg-indigo-50"
                      : "bg-indigo-600 text-white hover:bg-indigo-700",
                  ].join(" ")}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* Free trial note */}
          <p className="mt-8 text-center text-sm text-gray-500">
            Not ready to commit?{" "}
            <Link href="/login?plan=free" className="font-medium text-indigo-600 hover:text-indigo-500 underline underline-offset-2">
              Start with 10,000 free words
            </Link>{" "}
            — no card required.
          </p>

          {/* Comparison table */}
          <div className="mt-20">
            <h3 className="text-2xl font-bold tracking-tight text-gray-900 mb-8 text-center">Compare plans</h3>
            <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-white">
                    <th scope="col" className="py-4 pl-6 pr-3 text-left text-sm font-semibold text-gray-900 w-1/3">Feature</th>
                    {[PLANS.starter, PLANS.growth, PLANS.business, PLANS.payg].map((plan) => (
                      <th key={plan.id} scope="col" className={["px-4 py-4 text-center text-sm font-semibold", plan.popular ? "text-indigo-600" : "text-gray-900"].join(" ")}>
                        {plan.name}
                        {plan.popular && (
                          <span className="ml-1 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">Popular</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {COMPARISON_ROWS.map((row, idx) => (
                    <tr key={row.label} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                      <td className="py-3.5 pl-6 pr-3 text-sm font-medium text-gray-700">{row.label}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-600"><TableCheck value={row.starter} /></td>
                      <td className="px-4 py-3.5 text-sm text-indigo-600 font-medium"><TableCheck value={row.growth} /></td>
                      <td className="px-4 py-3.5 text-sm text-gray-600"><TableCheck value={row.business} /></td>
                      <td className="px-4 py-3.5 text-sm text-gray-600"><TableCheck value={row.payg} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td className="py-4 pl-6 pr-3" />
                    {[PLANS.starter, PLANS.growth, PLANS.business, PLANS.payg].map((plan) => (
                      <td key={plan.id} className="px-4 py-4 text-center">
                        <Link
                          href={`/login?plan=${plan.id}`}
                          className={[
                            "inline-block rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-150",
                            plan.popular
                              ? "bg-indigo-600 text-white hover:bg-indigo-700"
                              : "bg-white text-indigo-600 ring-1 ring-inset ring-indigo-300 hover:bg-indigo-50",
                          ].join(" ")}
                        >
                          {plan.cta}
                        </Link>
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-20 max-w-3xl mx-auto">
            <h3 className="text-2xl font-bold tracking-tight text-gray-900 mb-10 text-center">Frequently asked questions</h3>
            <dl className="space-y-4">
              {FAQS.map((faq) => (
                <div key={faq.q} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <dt className="text-base font-semibold text-gray-900">{faq.q}</dt>
                  <dd className="mt-2 text-sm text-gray-600 leading-relaxed">{faq.a}</dd>
                </div>
              ))}
            </dl>
          </div>

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
