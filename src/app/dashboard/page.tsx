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

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [projects, reviewerUsers, totalUnits, approvedUnits, pendingProjects, recentSessions] = await Promise.all([
    db.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true } },
        assignedReviewer: { select: { id: true, name: true } },
        _count: { select: { units: true } },
        translationTask: { include: { job: { select: { sourceFormat: true } } } },
      },
    }),
    db.user.findMany({
      where: { role: "reviewer" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.translationUnit.count({ where: { project: where } }),
    db.translationUnit.count({ where: { project: where, status: "approved" } }),
    db.project.count({ where: { ...where, status: { in: ["pending_assignment", "in_review"] } } }),
    db.reviewSession.findMany({
      where: {
        ...(role !== "admin" ? { reviewerId: userId } : {}),
        submittedAt: { not: null, gte: thirtyDaysAgo },
      },
      select: { startedAt: true, submittedAt: true },
    }),
  ])

  const projectsWithProgress = await Promise.all(
    projects.map(async (p) => {
      const approvedCount = await db.translationUnit.count({
        where: { projectId: p.id, status: "approved" },
      })
      const sourceFormat =
        p.translationTask?.job?.sourceFormat ??
        (p.originalFormat !== "xliff" ? p.originalFormat : undefined)
      return { ...p, approvedCount, sourceFormat: sourceFormat ?? null }
    })
  )

  // Compute avg review time in hours from completed sessions
  const avgReviewHours =
    recentSessions.length > 0
      ? recentSessions.reduce((sum, s) => {
          const ms = new Date(s.submittedAt!).getTime() - new Date(s.startedAt).getTime()
          return sum + ms / 3_600_000
        }, 0) / recentSessions.length
      : null

  const approvalRate = totalUnits > 0 ? Math.round((approvedUnits / totalUnits) * 100) : null

  const kpis = [
    {
      label: "Total projects",
      value: String(projects.length),
      sub: role === "admin" ? "across all users" : role === "reviewer" ? "assigned to you" : "created by you",
      color: "bg-indigo-50 text-indigo-700",
      dot: "bg-indigo-400",
    },
    {
      label: "Approval rate",
      value: approvalRate !== null ? `${approvalRate}%` : "—",
      sub: `${approvedUnits.toLocaleString()} / ${totalUnits.toLocaleString()} units`,
      color: approvalRate !== null && approvalRate >= 80 ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700",
      dot: approvalRate !== null && approvalRate >= 80 ? "bg-green-400" : "bg-amber-400",
    },
    {
      label: "Needs attention",
      value: String(pendingProjects),
      sub: "projects pending or in review",
      color: pendingProjects > 0 ? "bg-red-50 text-red-700" : "bg-gray-50 text-gray-500",
      dot: pendingProjects > 0 ? "bg-red-400" : "bg-gray-300",
    },
    {
      label: "Avg review time",
      value: avgReviewHours !== null ? `${avgReviewHours.toFixed(1)}h` : "—",
      sub: recentSessions.length > 0 ? `based on ${recentSessions.length} completed session${recentSessions.length !== 1 ? "s" : ""}` : "no completed sessions yet",
      color: "bg-purple-50 text-purple-700",
      dot: "bg-purple-400",
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Dashboard</h1>

          {role !== "reviewer" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
              {/* Workflow A — AI Translation */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-indigo-900">No translation yet?</p>
                  <p className="text-xs text-indigo-700 mt-0.5 leading-relaxed">
                    Use <strong>AI Translation</strong> to translate your JSON, CSV, Markdown, or PDF files using Claude, GPT-4o, or Gemini — then send the result for human review.
                  </p>
                </div>
                <Link
                  href="/translation-studio"
                  className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                >
                  AI Translation →
                </Link>
              </div>

              {/* Workflow B — Upload bilingual XLIFF */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Already have a translation?</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    Upload a <strong>bilingual XLIFF</strong> file (source + target already filled) to start a human review project and approve, reject, or edit each segment.
                  </p>
                </div>
                <Link
                  href="/projects/new"
                  className="shrink-0 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                >
                  Upload XLIFF →
                </Link>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-500">
            {projects.length} review project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${kpi.dot}`} />
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{kpi.label}</p>
              </div>
              <p className={`text-3xl font-bold mb-1 ${kpi.color.split(" ")[1]}`}>{kpi.value}</p>
              <p className="text-xs text-gray-400">{kpi.sub}</p>
            </div>
          ))}
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
            reviewerUsers={reviewerUsers}
          />
        )}
      </main>
    </div>
  )
}
