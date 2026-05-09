import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { AppShell } from "@/components/app-shell"
import { LqaStudio } from "@/components/lqa-studio"

export const dynamic = "force-dynamic"

export default async function LqaStudioPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.role === "reviewer") redirect("/dashboard")

  const { id: userId, role } = session.user

  const initialRuns = await db.lqaRun.findMany({
    where: role === "admin" ? {} : { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileFormat: true,
      sourceLanguage: true,
      targetLanguage: true,
      status: true,
      totalUnits: true,
      totalWordCount: true,
      qualityScore: true,
      qualityBand: true,
      accuracyErrors: true,
      languageErrors: true,
      styleErrors: true,
      revisionStatus: true,
      errorMessage: true,
      createdAt: true,
    },
  })

  return (
    <AppShell>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">LQA Studio</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Upload a bilingual XLF, XLIFF, or TMX file to run Language Quality Assessment, download an
            Excel report, and auto-revise issues.
          </p>
        </div>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <LqaStudio initialRuns={initialRuns as any} />
      </main>
    </AppShell>
  )
}
