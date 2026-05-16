import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { AppShell } from "@/components/app-shell"
import { JobProgress } from "@/components/job-progress"

export const dynamic = "force-dynamic"

export default async function JobProgressPage({
  params,
}: {
  params: Promise<{ jobId: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { jobId } = await params
  const { id: userId, role } = session.user

  const job = await db.translationJob.findUnique({
    where: { id: jobId },
    include: {
      createdBy: { select: { name: true } },
      tasks: { orderBy: { targetLanguage: "asc" } },
    },
  })

  if (!job) redirect("/translation-studio")
  if (role !== "admin" && job.createdById !== userId) redirect("/translation-studio")

  return (
    <AppShell>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <JobProgress initialJob={job} />
      </main>
    </AppShell>
  )
}
