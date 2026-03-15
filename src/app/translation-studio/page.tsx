import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { TranslationWizard } from "@/components/translation-wizard"
import { PROVIDER_INFO } from "@/lib/ai-providers/registry"
export const dynamic = "force-dynamic"

export default async function TranslationStudioPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.role === "reviewer") redirect("/dashboard")

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Translation Studio</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Convert JSON or CSV files to XLIFF using AI, then import them for review.
          </p>
        </div>
        <TranslationWizard providers={PROVIDER_INFO} />
      </main>
    </div>
  )
}
