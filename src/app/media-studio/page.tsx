import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { AppShell } from "@/components/app-shell"
import { MediaStudio } from "@/components/media-studio"

export const dynamic = "force-dynamic"

export default async function MediaStudioPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.role === "reviewer") redirect("/dashboard")

  const { id: userId, role } = session.user

  const initialRuns = await db.mediaRun.findMany({
    where: role === "admin" ? {} : { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      fileName: true,
      fileFormat: true,
      targetLanguage: true,
      status: true,
      totalEntries: true,
      previewData: true,
      errorMessage: true,
      createdAt: true,
    },
  })

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Media Studio</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Upload an <strong>.srt</strong> or <strong>.vtt</strong> subtitle file, choose a target
            language, and let AI translate it — timestamps preserved.
          </p>
        </div>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <MediaStudio initialRuns={initialRuns as any} />
      </main>
    </AppShell>
  )
}
