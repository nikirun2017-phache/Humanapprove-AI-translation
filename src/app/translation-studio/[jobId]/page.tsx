import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Navbar } from "@/components/navbar"
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
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-8">
        <JobProgress initialJob={job} />
      </main>
    </div>
  )
}
