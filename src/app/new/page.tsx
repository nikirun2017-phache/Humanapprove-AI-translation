"use client"

// Point 3: Unified "New project" entry — replaces 3 separate navbar links
// Users pick how they want to start; each card explains the use case clearly.

import Link from "next/link"
import { Navbar } from "@/components/navbar"

const sources = [
  {
    href: "/translation-studio",
    title: "AI Translation",
    badge: "Most popular",
    badgeColor: "bg-indigo-100 text-indigo-700",
    icon: "✦",
    iconBg: "bg-indigo-50",
    description:
      "Upload a JSON, CSV, Markdown, PDF, or XLIFF file. Claude, GPT-4o, or Gemini translates it in seconds — then a human reviewer approves every segment.",
    when: "Use when: you have a source file and need a translation from scratch.",
    cta: "Start AI translation →",
    color: "border-indigo-200 hover:border-indigo-400",
  },
  {
    href: "/file-pairer",
    title: "Pair source + target",
    badge: null,
    badgeColor: "",
    icon: "⇄",
    iconBg: "bg-teal-50",
    description:
      "Upload a source file (e.g. en.json) alongside an existing translation (e.g. ja.json). The app aligns them by key and generates a bilingual XLIFF for review.",
    when: "Use when: you already have a translation and want a human to review it.",
    cta: "Pair files →",
    color: "border-gray-200 hover:border-teal-400",
  },
  {
    href: "/projects/new",
    title: "Upload bilingual XLIFF",
    badge: null,
    badgeColor: "",
    icon: "↑",
    iconBg: "bg-gray-50",
    description:
      "Upload an XLIFF file that already contains both source and target segments. Reviewers can approve, reject, or edit each unit side-by-side.",
    when: "Use when: your CAT tool or TMS exported a bilingual XLIFF for review.",
    cta: "Upload XLIFF →",
    color: "border-gray-200 hover:border-gray-400",
  },
  {
    href: "/translation-studio?tab=github-pr",
    title: "From a GitHub PR",
    badge: "New",
    badgeColor: "bg-green-100 text-green-700",
    icon: "⌥",
    iconBg: "bg-green-50",
    description:
      "Paste a GitHub Pull Request URL. Jendee AI fetches the changed files, extracts translatable strings, and shows a word count and cost estimate before you commit.",
    when: "Use when: your i18n files live in a Git repo and change via PRs.",
    cta: "Analyze PR →",
    color: "border-gray-200 hover:border-green-400",
  },
]

export default function NewProjectPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900">New project</h1>
          <p className="text-gray-500 mt-2">
            Choose how you want to bring content in. You can always change workflow later.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sources.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={`group bg-white rounded-2xl border-2 p-6 flex flex-col gap-4 transition-all ${s.color}`}
            >
              <div className="flex items-start justify-between">
                <span className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center text-xl`}>
                  {s.icon}
                </span>
                {s.badge && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.badgeColor}`}>
                    {s.badge}
                  </span>
                )}
              </div>

              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-1">{s.title}</h2>
                <p className="text-sm text-gray-500 leading-relaxed">{s.description}</p>
              </div>

              <p className="text-xs text-gray-400 italic">{s.when}</p>

              <span className="text-sm font-medium text-indigo-600 group-hover:underline mt-auto">
                {s.cta}
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-8 bg-white border border-gray-200 rounded-xl p-5 flex items-start gap-4">
          <span className="text-2xl">💡</span>
          <div>
            <p className="text-sm font-medium text-gray-800">Not sure which to pick?</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Start with <strong>AI Translation</strong> if you have a raw source file. If a translator already
              produced a draft, use <strong>Pair source + target</strong> or <strong>Upload XLIFF</strong>.
              See{" "}
              <Link href="/pricing" className="text-indigo-600 hover:underline">
                pricing
              </Link>{" "}
              for cost estimates before you begin.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
