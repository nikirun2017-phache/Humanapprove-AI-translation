import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { ProjectsTable } from "@/components/projects-table"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id: userId, role } = session.user

  const where =
    role === "admin"
      ? {}
      : role === "reviewer"
        ? { assignedReviewerId: userId }
        : { createdById: userId }

  const projects = await db.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      assignedReviewer: { select: { name: true } },
      _count: { select: { units: true } },
    },
  })

  const projectsWithProgress = await Promise.all(
    projects.map(async (p) => {
      const approvedCount = await db.translationUnit.count({
        where: { projectId: p.id, status: "approved" },
      })
      return { ...p, approvedCount }
    })
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {projectsWithProgress.length} project{projectsWithProgress.length !== 1 ? "s" : ""}
            </p>
          </div>
          {role !== "reviewer" && (
            <Link
              href="/projects/new"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              + Upload XLIFF
            </Link>
          )}
        </div>

        {projectsWithProgress.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm">No projects yet.</p>
            {role !== "reviewer" && (
              <Link
                href="/projects/new"
                className="inline-block mt-3 text-indigo-600 text-sm font-medium hover:underline"
              >
                Upload your first XLIFF →
              </Link>
            )}
          </div>
        ) : (
          <ProjectsTable
            initialProjects={projectsWithProgress}
            role={role}
            currentUserId={userId}
          />
        )}
      </main>
    </div>
  )
}
