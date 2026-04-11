import Link from "next/link"
import { PublicFooter } from "@/components/public-footer"

export const metadata = {
  title: "Blog — Summon Translator",
  description: "Translation tips, AI localization insights, and product updates from the Summon Translator team.",
}

const POSTS = [
  {
    date: "April 2026",
    tag: "Product",
    title: "Introducing HTML File Translation",
    excerpt:
      "Summon Translator now supports .html files — perfect for eLearning courses, web content, and localization of static sites. Translation preserves all markup and formatting automatically.",
    href: "#",
  },
  {
    date: "March 2026",
    tag: "Best Practices",
    title: "When to Add a Human Reviewer to Your AI Translation",
    excerpt:
      "AI translation is fast and accurate — but for legal contracts, medical instructions, and brand-critical copy, a human post-editor adds the last 5% that matters most. Here's how to decide.",
    href: "#",
  },
  {
    date: "March 2026",
    tag: "Product",
    title: "PDF Translation with Format Preservation",
    excerpt:
      "Our PDF translation pipeline now reproduces the original layout — headers, bullet points, bold text, and multi-column structure — in the target language. No reformatting required.",
    href: "#",
  },
  {
    date: "February 2026",
    tag: "Industry",
    title: "The State of Machine Translation in 2026",
    excerpt:
      "Large language models have fundamentally changed what MT can deliver. We explore benchmark results across 30 language pairs and what they mean for your localization strategy.",
    href: "#",
  },
]

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="font-bold text-indigo-600 text-xl tracking-tight">Summon Translator</Link>
        <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">Sign in</Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Blog</h1>
        <p className="text-sm text-gray-400 mb-12">Translation tips, AI insights, and product updates.</p>

        <div className="space-y-10">
          {POSTS.map((post) => (
            <article key={post.title} className="border-b border-gray-100 pb-10">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full font-medium">{post.tag}</span>
                <span className="text-xs text-gray-400">{post.date}</span>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2 hover:text-indigo-600 transition-colors">
                <a href={post.href}>{post.title}</a>
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">{post.excerpt}</p>
              <a href={post.href} className="inline-block mt-4 text-sm text-indigo-600 hover:underline font-medium">
                Read more →
              </a>
            </article>
          ))}
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
