import Link from "next/link"

export const metadata = {
  title: "Portfolio — Summon Translator",
  description:
    "See real translations produced by Summon Translator — eLearning courses and PDF technical reports, English to Simplified Chinese.",
}

const ELEARNING_SAMPLES = [
  {
    lang: "EN",
    langColor: "bg-blue-100 text-blue-700",
    label: "Original · English",
    title: "High Voltage Electrical Safety",
    src: "/high-voltage-safety-course.html",
  },
  {
    lang: "ZH-CN",
    langColor: "bg-red-100 text-red-700",
    label: "Translated · Simplified Chinese",
    title: "高压电气安全",
    src: "/high-voltage-safety-course-zh-CN.html",
  },
]

const PDF_SAMPLES = [
  {
    lang: "EN",
    langColor: "bg-blue-100 text-blue-700",
    label: "Original · English",
    filename: "Lessons Learnt Report No. 2",
    src: "/rio-tinto-yarwun-en.pdf",
  },
  {
    lang: "ZH-CN",
    langColor: "bg-red-100 text-red-700",
    label: "Translated · Simplified Chinese",
    filename: "经验教训报告第2号",
    src: "/rio-tinto-yarwun-zh-CN.pdf",
  },
]

export default function PortfolioPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="font-bold text-indigo-600 text-xl tracking-tight">
          Summon Translator
        </Link>
        <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
          Sign in
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-20">

        {/* ── Section 1: eLearning course ── */}
        <section>
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              Sample 1 · eLearning course
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-2">
              High Voltage Safety Training · EN → ZH-CN
            </h2>
            <p className="text-gray-500 max-w-2xl leading-relaxed">
              An interactive HSE eLearning course with quizzes, translated from English to Simplified Chinese.
              Same layout, fonts, quiz logic, and interactions — fully localised.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {ELEARNING_SAMPLES.map((item) => (
              <div
                key={item.lang}
                className="rounded-2xl border border-gray-200 shadow-sm overflow-hidden bg-white flex flex-col"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.langColor}`}>
                      {item.lang}
                    </span>
                    <span className="text-sm font-medium text-gray-700">{item.label}</span>
                  </div>
                  <a
                    href={item.src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Open full screen ↗
                  </a>
                </div>
                <div className="relative" style={{ paddingBottom: "65%" }}>
                  <iframe
                    src={item.src}
                    title={item.title}
                    className="absolute inset-0 w-full h-full border-0"
                    loading="lazy"
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Translated with Summon Translator · Claude claude-sonnet-4-6 · HTML source format
          </p>
        </section>

        {/* ── Section 2: PDF technical report ── */}
        <section>
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Sample 2 · PDF technical report
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-2">
              Rio Tinto / Sumitomo Yarwun Hydrogen Calcination · EN → ZH-CN
            </h2>
            <p className="text-gray-500 max-w-2xl leading-relaxed">
              A 4-page government-funded lessons-learnt report covering hydrogen calcination safety,
              metering, and subcontractor management — translated to Simplified Chinese.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {PDF_SAMPLES.map((item) => (
              <div
                key={item.lang}
                className="rounded-2xl border border-gray-200 shadow-sm overflow-hidden bg-white flex flex-col"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.langColor}`}>
                      {item.lang}
                    </span>
                    <span className="text-sm font-medium text-gray-700">{item.label}</span>
                  </div>
                  <a
                    href={item.src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    Download PDF ↗
                  </a>
                </div>
                {/* PDF embed */}
                <div className="relative bg-gray-50" style={{ paddingBottom: "75%" }}>
                  <iframe
                    src={item.src + "#toolbar=0&navpanes=0"}
                    title={item.filename}
                    className="absolute inset-0 w-full h-full border-0"
                    loading="lazy"
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Translated with Summon Translator · Claude claude-sonnet-4-6 · PDF source format
          </p>
        </section>

        {/* ── CTA ── */}
        <div className="bg-indigo-50 rounded-2xl px-8 py-8 text-center">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Translate your own documents</h2>
          <p className="text-sm text-gray-500 mb-5 max-w-md mx-auto">
            Upload PDF, XLIFF, JSON, CSV or HTML files and get AI-translated output in minutes — across 30+ languages.
          </p>
          <Link
            href="/login?mode=signup"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Start free — 1,000 words on us →
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 mt-16">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-bold text-indigo-600 tracking-tight">Summon Translator</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Terms of Service</Link>
            <Link href="/careers" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Careers</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
