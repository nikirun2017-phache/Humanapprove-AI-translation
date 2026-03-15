import Link from "next/link"

const PILLARS = [
  {
    num: "01",
    title: "Context Intelligence",
    subtitle: "Not just translation memory",
    points: [
      "Understands why a string exists — UI label, legal disclaimer, or marketing copy — not just what it says",
      "Infers context from surrounding strings, file structure, screenshots, and product metadata",
      "Replaces static TM with a living semantic context graph that gets smarter per project",
    ],
    shift: {
      from: '"have I seen this before?"',
      to: '"do I understand what this means here?"',
    },
  },
  {
    num: "02",
    title: "Zero-Config Workflow Automation",
    subtitle: "Describe your goal. The system figures it out.",
    points: [
      "Auto-detects content type — UI string, doc, marketing, legal — and routes accordingly",
      "Self-configures quality thresholds, MT engine selection, and review triggers",
      "Agents monitor repos and CMS and act without human pipeline management",
    ],
    shift: {
      from: '"configure your workflow"',
      to: '"describe your goal, the system figures it out"',
    },
  },
  {
    num: "03",
    title: "Quality That Learns Your Brand",
    subtitle: "Not a generic rubric",
    points: [
      "Learns brand voice, tone, and terminology from approved translations automatically",
      "Scores quality against your standards — not industry averages or MQM checklists",
      "Flags cultural misfires, not just grammar errors",
      "Generates explainable quality scores: why it was flagged, not just a number",
    ],
    shift: {
      from: '"does it pass a checklist?"',
      to: '"does it sound like us, in that market?"',
    },
  },
  {
    num: "04",
    title: "Human-in-the-Loop as a Feature",
    subtitle: "Not a fallback safety net",
    points: [
      "Predicts which segments actually need human review using confidence scoring",
      "Routes only ambiguous, high-risk, or brand-critical content to linguists",
      "Gives reviewers AI-generated context, alternatives, and reasoning — not a blank CAT editor",
      "Tracks linguist corrections and feeds them back into the model",
    ],
    shift: {
      from: '"humans review everything"',
      to: '"humans review what matters, AI explains why"',
    },
  },
  {
    num: "05",
    title: "Developer & Creator-Native Integration",
    subtitle: "Translation as a function call",
    points: [
      "API-first and SDK-first — translation as a function call, not a platform login",
      "Native to GitHub Actions, Figma plugins, Contentful webhooks, and CI/CD pipelines",
      "Headless TMS mode — all logic accessible programmatically, no UI required for power users",
      "Supports XLIFF, JSON, PO, ARB, and Android XML with round-trip fidelity",
    ],
    shift: {
      from: '"here\'s a portal to manage translations"',
      to: '"translation is embedded in your existing tools"',
    },
  },
]

export default function VisionPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="font-bold text-indigo-600 text-xl tracking-tight">
          Reviso
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            Home
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Get started →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          The five pillars of next-generation translation
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 leading-tight mb-5">
          What AI translation<br />
          <span className="text-indigo-600">should actually do.</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
          Most translation tools bolt AI onto an existing workflow. We built the workflow around what AI makes possible.
          Here are the five shifts that define it.
        </p>
      </section>

      {/* Pillars */}
      <section className="max-w-4xl mx-auto px-6 pb-24 space-y-0 divide-y divide-gray-100">
        {PILLARS.map((pillar) => (
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
                  The shift
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
            Ready to build on these pillars?
          </h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Reviso is the platform where these ideas run in production today.
            Start with AI translation, human review, and a full audit trail — free.
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/login"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors shadow-sm"
            >
              Get started free
            </Link>
            <Link
              href="/"
              className="border border-gray-200 hover:border-gray-300 text-gray-700 font-medium px-6 py-3 rounded-xl text-sm transition-colors"
            >
              See the product →
            </Link>
          </div>
        </div>
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
