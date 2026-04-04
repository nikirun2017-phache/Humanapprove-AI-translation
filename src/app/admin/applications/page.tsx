import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Navbar } from "@/components/navbar"
import { ApplicationManager } from "@/components/application-manager"

export const dynamic = "force-dynamic"

export default async function AdminApplicationsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  if (session.user.role !== "admin") redirect("/translation-studio")

  const applications = await db.reviewerApplication.findMany({
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Reviewer applications</h1>
        <ApplicationManager initialApplications={applications} />
      </main>
    </div>
  )
}
