import Link from "next/link"
import { PLANS, formatWords } from "@/lib/plans"

const PAID_PLANS = [PLANS.starter, PLANS.growth, PLANS.business, PLANS.payg]

const COMPARISON_ROWS: { label: string; starter: string; growth: string; business: string; payg: string }[] = [
  {
    label: "Words / month",
    starter: "50,000",
    growth: "250,000",
    business: "1,000,000",
    payg: "Unlimited",
  },
  {
    label: "File formats",
    starter: "All 20+",
    growth: "All 20+",
    business: "All 20+",
    payg: "All 20+",
  },
  {
    label: "CMS integrations",
    starter: "15+",
    growth: "15+",
    business: "15+",
    payg: "15+",
  },
  {
    label: "Translation Memory",
    starter: "Yes",
    growth: "Yes",
    business: "Yes",
    payg: "Yes",
  },
  {
    label: "Glossary management",
    starter: "Yes",
    growth: "Yes",
    business: "Yes",
    payg: "Yes",
  },
  {
    label: "LQA Studio",
    starter: "Yes",
    growth: "Yes",
    business: "Yes",
    payg: "Yes",
  },
  {
    label: "Priority AI model access",
    starter: "—",
    growth: "Yes",
    business: "Yes",
    payg: "—",
  },
  {
    label: "Usage analytics",
    starter: "—",
    growth: "Yes",
    business: "Yes",
    payg: "—",
  },
  {
    label: "REST API access",
    starter: "—",
    growth: "—",
    business: "Yes",
    payg: "—",
  },
  {
    label: "Custom integrations",
    starter: "—",
    growth: "—",
    business: "Yes",
    payg: "—",
  },
  {
    label: "Support",
    starter: "Community",
    growth: "Email",
    business: "Priority",
    payg: "Community",
  },
]

const FAQS: { q: string; a: string }[] = [
  {
    q: "Can I change plans at any time?",
    a: "Yes. You can upgrade or downgrade your plan at any time from the billing settings page. Upgrades take effect immediately; downgrades apply at the start of your next billing period.",
  },
  {
    q: "What happens if I exceed my word quota?",
    a: "Translations will be paused once you hit your monthly limit. You can upgrade your plan to continue, or wait for your quota to reset at the start of your next billing period.",
  },
  {
    q: "Does unused quota roll over?",
    a: "No. Word quotas reset at the start of each billing cycle and do not carry over. If you consistently have leftover quota, consider downgrading to a smaller plan.",
  },
  {
    q: "How does pay-as-you-go pricing work?",
    a: "With the Pay-as-you-go plan you are charged per translated word based on actual usage, with no monthly commitment. Add a card and you will only be billed for what you use each month.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes. Every new account starts with a one-time 10,000-word free trial — no card required. Once used, you can choose a paid plan or the pay-as-you-go option.",
  },
  {
    q: "Do you offer annual billing?",
    a: "Annual billing with a 2-month discount is available — contact us and we will set it up for you.",
  },
  {
    q: "Is my data secure?",
    a: "All data is encrypted in transit (TLS) and at rest. We never use your content to train AI models. For enterprise security requirements, please contact us.",
  },
]

function CheckIcon() {
  return (
    <svg className="h-5 w-5 text-indigo-600 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function TableCheck({ value }: { value: string }) {
  if (value === "Yes") {
    return (
      <span className="flex justify-center">
        <svg className="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
        <span className="sr-only">Included</span>
      </span>
    )
  }
  if (value === "—") {
    return <span className="flex justify-center text-gray-400" aria-label="Not included">—</span>
  }
  return <span className="flex justify-center text-sm text-gray-700">{value}</span>
}

export default function PricingPage() {
  return (
    <div className="bg-white">
      {/* Header */}
      <div className="mx-auto max-w-7xl px-6 pt-16 pb-10 text-center lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
          Start for free, then scale as you grow. Every plan includes all file formats, CMS integrations, and LQA Studio.
        </p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
          Save 2 months with annual billing —{" "}
          <Link href="mailto:hello@summontranslator.com" className="underline underline-offset-2 hover:text-indigo-900">
            contact us
          </Link>
        </p>
      </div>

      {/* Plan cards */}
      <div className="mx-auto max-w-7xl px-6 pb-16 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {PAID_PLANS.map((plan) => {
            const ctaHref =
              plan.id === "payg"
                ? "/login?plan=payg"
                : `/login?plan=${plan.id}`

            return (
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
                  <h2 className={["text-lg font-semibold", plan.popular ? "text-white" : "text-gray-900"].join(" ")}>
                    {plan.name}
                  </h2>

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
                      <p className={["mt-1 text-sm", plan.popular ? "text-indigo-200" : "text-gray-500"].join(" ")}>
                        billed monthly
                      </p>
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
                      {plan.popular ? (
                        <svg className="h-5 w-5 text-indigo-200 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path
                            fillRule="evenodd"
                            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <CheckIcon />
                      )}
                      <span className={["text-sm", plan.popular ? "text-indigo-100" : "text-gray-600"].join(" ")}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={ctaHref}
                  className={[
                    "block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                    plan.popular
                      ? "bg-white text-indigo-600 hover:bg-indigo-50 focus-visible:outline-white"
                      : "bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:outline-indigo-600",
                  ].join(" ")}
                >
                  {plan.cta}
                </Link>
              </div>
            )
          })}
        </div>

        {/* Free trial note */}
        <p className="mt-8 text-center text-sm text-gray-500">
          Not ready to commit?{" "}
          <Link href="/login?plan=free" className="font-medium text-indigo-600 hover:text-indigo-500 underline underline-offset-2">
            Start with 10,000 free words
          </Link>{" "}
          — no card required.
        </p>
      </div>

      {/* Comparison table */}
      <div className="mx-auto max-w-7xl px-6 pb-20 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-8 text-center">Compare plans</h2>
        <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th
                  scope="col"
                  className="py-4 pl-6 pr-3 text-left text-sm font-semibold text-gray-900 w-1/3"
                >
                  Feature
                </th>
                {[PLANS.starter, PLANS.growth, PLANS.business, PLANS.payg].map((plan) => (
                  <th
                    key={plan.id}
                    scope="col"
                    className={[
                      "px-4 py-4 text-center text-sm font-semibold",
                      plan.popular ? "text-indigo-600" : "text-gray-900",
                    ].join(" ")}
                  >
                    {plan.name}
                    {plan.popular && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        Popular
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {COMPARISON_ROWS.map((row, idx) => (
                <tr key={row.label} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="py-3.5 pl-6 pr-3 text-sm font-medium text-gray-700">{row.label}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-600">
                    <TableCheck value={row.starter} />
                  </td>
                  <td className="px-4 py-3.5 text-sm text-indigo-600 font-medium">
                    <TableCheck value={row.growth} />
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-600">
                    <TableCheck value={row.business} />
                  </td>
                  <td className="px-4 py-3.5 text-sm text-gray-600">
                    <TableCheck value={row.payg} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td className="py-4 pl-6 pr-3"></td>
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
      <div className="mx-auto max-w-3xl px-6 pb-24 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-10 text-center">
          Frequently asked questions
        </h2>
        <dl className="space-y-6">
          {FAQS.map((faq) => (
            <div key={faq.q} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <dt className="text-base font-semibold text-gray-900">{faq.q}</dt>
              <dd className="mt-2 text-sm text-gray-600 leading-relaxed">{faq.a}</dd>
            </div>
          ))}
        </dl>

        {/* CTA footer */}
        <div className="mt-16 rounded-2xl bg-indigo-600 px-8 py-10 text-center shadow-lg">
          <h3 className="text-xl font-bold text-white">Ready to get started?</h3>
          <p className="mt-2 text-indigo-200 text-sm">
            Join thousands of teams translating faster with Summon Translator.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login?plan=free"
              className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors duration-150"
            >
              Start free trial
            </Link>
            <Link
              href="/login?plan=growth"
              className="rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white ring-1 ring-inset ring-indigo-400 hover:bg-indigo-400 transition-colors duration-150"
            >
              Start Growth plan
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
