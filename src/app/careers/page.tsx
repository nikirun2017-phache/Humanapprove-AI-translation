import Link from "next/link"

export const metadata = {
  title: "Careers — Summon Translator",
  description:
    "Join Summon Translator's network of freelance MT post-editors and LQA reviewers. Remote, flexible, project-based work across 30+ language pairs.",
}

const LANGUAGES = [
  { region: "European", pairs: ["German (DE)", "French (FR)", "Spanish (ES)", "Italian (IT)", "Portuguese BR (PT-BR)", "Dutch (NL)", "Polish (PL)", "Swedish (SV)"] },
  { region: "Asian", pairs: ["Japanese (JA)", "Simplified Chinese (ZH-Hans)", "Traditional Chinese (ZH-Hant)", "Korean (KO)", "Thai (TH)", "Indonesian (ID)"] },
  { region: "Middle Eastern", pairs: ["Arabic (AR)", "Hebrew (HE)", "Turkish (TR)"] },
]

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-bold text-indigo-600 text-xl tracking-tight">
          Summon Translator
        </Link>
        <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
          Sign in
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-full mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Now recruiting
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
            MT Post-Editor &amp; LQA Reviewer
          </h1>
          <p className="text-lg text-gray-500 leading-relaxed">
            Freelance · Remote · Project-based
          </p>
        </div>

        {/* About */}
        <section className="mb-10 space-y-4 text-gray-700 leading-relaxed">
          <p>
            Summon Translator is an AI-powered file translation platform that handles structured file
            formats — XLIFF, JSON, Markdown, CSV, and more. As we grow, we are building a network of
            professional linguists to review AI output, provide quality assessments, and support
            clients who require human verification of translated content.
          </p>
        </section>

        <hr className="border-gray-100 mb-10" />

        {/* The Role */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">The Role</h2>
          <p className="text-gray-700 leading-relaxed mb-5">
            We are looking for experienced translators and linguists to work as freelance MT
            Post-Editors and LQA Reviewers across multiple language pairs. Your work will involve
            reviewing AI-generated translations of structured content — software strings, eLearning
            course content, technical documentation, and similar material.
          </p>
          <ul className="space-y-3">
            {[
              { label: "Light post-editing", body: "Correcting fluency, terminology, and naturalness while preserving meaning." },
              { label: "Full post-editing", body: "Producing publication-ready translations from AI output." },
              { label: "LQA scoring", body: "Evaluating translation quality using MQM or similar error frameworks." },
              { label: "Terminology feedback", body: "Flagging domain-specific issues for model improvement." },
            ].map(({ label, body }) => (
              <li key={label} className="flex gap-3">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                <span className="text-gray-700 leading-relaxed">
                  <strong className="text-gray-900">{label}:</strong> {body}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <hr className="border-gray-100 mb-10" />

        {/* Requirements */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Requirements</h2>
          <ul className="space-y-3">
            {[
              "Native or near-native proficiency in target language",
              "Minimum 2 years of professional translation or post-editing experience",
              "Familiarity with at least one CAT tool (Trados, memoQ, Phrase, Memsource, or similar)",
              "Experience with MT post-editing preferred; willingness to learn if not",
              "Ability to work with structured file formats (XLIFF, JSON, etc.) is a plus",
              "Available for project-based work on a flexible schedule",
            ].map((req) => (
              <li key={req} className="flex gap-3">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                <span className="text-gray-700 leading-relaxed">{req}</span>
              </li>
            ))}
          </ul>
        </section>

        <hr className="border-gray-100 mb-10" />

        {/* Language pairs */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Language pairs currently prioritised</h2>
          <p className="text-sm text-gray-500 mb-6">
            Please apply regardless of your language pair — we are expanding across all markets.
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {LANGUAGES.map(({ region, pairs }) => (
              <div key={region} className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{region}</p>
                <ul className="space-y-1.5">
                  {pairs.map((p) => (
                    <li key={p} className="text-sm text-gray-700">{p}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <hr className="border-gray-100 mb-10" />

        {/* What we offer */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">What we offer</h2>
          <ul className="space-y-3">
            {[
              "Per-word or per-project rates, negotiated individually",
              "Flexible, remote, project-based work — no minimum commitment",
              "Exposure to AI translation workflows and structured file formats",
              "The chance to shape quality standards on a growing platform",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                <span className="text-gray-700 leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <hr className="border-gray-100 mb-10" />

        {/* How to apply */}
        <section className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-4">How to apply</h2>
          <p className="text-gray-700 leading-relaxed mb-5">
            Fill out our online application form — it takes about 5 minutes. We will ask about your
            language pairs, experience level, and background.
          </p>
          <p className="text-sm text-gray-400 mt-6">We review applications on a rolling basis and typically respond within 5 business days.</p>
        </section>

        {/* CTA */}
        <div className="bg-indigo-50 rounded-2xl px-8 py-8 text-center">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Ready to apply?</h3>
          <p className="text-sm text-gray-500 mb-5">
            Complete our short application form — we typically respond within 5 business days.
          </p>
          <Link
            href="/reviewer-signup"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Apply now →
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 mt-16">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
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
