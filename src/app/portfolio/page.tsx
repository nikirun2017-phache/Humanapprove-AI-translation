import Link from "next/link"

export const metadata = {
  title: "Portfolio — Summon Translator",
  description:
    "See real eLearning course translations produced by Summon Translator — English to Simplified Chinese, same layout and interactions, fully localised.",
}

const SAMPLES = [
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

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Translation sample
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
            eLearning course · EN → ZH-CN
          </h1>
          <p className="text-gray-500 max-w-2xl leading-relaxed">
            A high-voltage electrical safety training course translated from English to Simplified Chinese.
            Same layout, fonts, quiz logic, and interactions — fully localised by Summon Translator.
          </p>
        </div>

        {/* Side-by-side iframes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {SAMPLES.map((item) => (
            <div
              key={item.lang}
              className="rounded-2xl border border-gray-200 shadow-sm overflow-hidden bg-white flex flex-col"
            >
              {/* Card header */}
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
              {/* Iframe */}
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

        <p className="text-xs text-gray-400 text-center mb-12">
          Translated with Summon Translator · Claude claude-sonnet-4-6 · XLIFF source format
        </p>

        {/* CTA */}
        <div className="bg-indigo-50 rounded-2xl px-8 py-8 text-center">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Translate your own eLearning content</h2>
          <p className="text-sm text-gray-500 mb-5 max-w-md mx-auto">
            Upload XLIFF, JSON, CSV or HTML files and get AI-translated output in minutes — across 30+ languages.
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
