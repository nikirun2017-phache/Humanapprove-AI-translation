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
        assignedReviewer: { select: { id: true, name: true, isPlatformReviewer: true } },
        _count: { select: { units: true } },
        translationTask: { include: { job: { select: { sourceFormat: true } } } },
      },
    }),
    db.user.findMany({
      where: { role: "reviewer" },
      select: { id: true, name: true, isPlatformReviewer: true },
      orderBy: [{ isPlatformReviewer: "asc" }, { name: "asc" }],
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

  // Point 4: fetch latest reviewer audit activity per project
  const projectIds = projects.map((p: (typeof projects)[number]) => p.id)
  const latestAuditLogs = await db.auditLog.findMany({
    where: { projectId: { in: projectIds } },
    orderBy: { createdAt: "desc" },
    distinct: ["projectId"],
    select: { projectId: true, createdAt: true, action: true, user: { select: { name: true } } },
  })
  const auditByProject = new Map(latestAuditLogs.map((l: (typeof latestAuditLogs)[number]) => [l.projectId, l]))

  const projectsWithProgress = await Promise.all(
    projects.map(async (p: (typeof projects)[number]) => {
      const approvedCount = await db.translationUnit.count({
        where: { projectId: p.id, status: "approved" },
      })
      const sourceFormat =
        p.translationTask?.job?.sourceFormat ??
        (p.originalFormat !== "xliff" ? p.originalFormat : undefined)
      const lastActivity = auditByProject.get(p.id) ?? null
      return {
        ...p,
        approvedCount,
        sourceFormat: sourceFormat ?? null,
        reviewerType: p.reviewerType ?? "own",
        lastActivity,
      }
    })
  )

  const avgReviewHours =
    recentSessions.length > 0
      ? recentSessions.reduce((sum: number, s: (typeof recentSessions)[number]) => {
          const ms = new Date(s.submittedAt!).getTime() - new Date(s.startedAt).getTime()
          return sum + ms / 3_600_000
        }, 0) / recentSessions.length
      : null

  const approvalRate = totalUnits > 0 ? Math.round((approvedUnits / totalUnits) * 100) : null
  const isFirstTime = projects.length === 0 && role !== "reviewer"

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
      sub: recentSessions.length > 0 ? `based on ${recentSessions.length} session${recentSessions.length !== 1 ? "s" : ""}` : "no completed sessions yet",
      color: "bg-purple-50 text-purple-700",
      dot: "bg-purple-400",
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Point 5: persistent value-prop identity strip */}
      <div className="bg-indigo-700 text-white text-center text-xs py-1.5 px-4 tracking-wide">
        Jendee AI — AI translation at speed, human-reviewed for accuracy. Every segment auditable.
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8">

        {/* Point 1: Onboarding empty state for first-time users */}
        {isFirstTime ? (
          <div className="mb-10">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Welcome to Jendee AI{session.user.name ? `, ${session.user.name.split(" ")[0]}` : ""}
            </h1>
            <p className="text-gray-500 text-sm mb-8">Here&apos;s how to get your first translation reviewed and approved.</p>

            {/* 3-step guide */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[
                {
                  step: "1",
                  title: "Bring your content",
                  body: "Upload a JSON, CSV, Markdown, PDF, or XLIFF file — or paste a GitHub PR link. If you already have a translation, pair your source and target files.",
                  icon: "📄",
                },
                {
                  step: "2",
                  title: "AI translates in seconds",
                  body: "Choose Claude, GPT-4o, or Gemini. The model translates every segment. You see a cost estimate before anything runs.",
                  icon: "✦",
                },
                {
                  step: "3",
                  title: "A human reviews & approves",
                  body: "A reviewer checks each segment side-by-side, edits where needed, and approves. You download the clean, audited translation.",
                  icon: "✓",
                },
              ].map(({ step, title, body, icon }) => (
                <div key={step} className="bg-white rounded-2xl border border-gray-200 p-6 relative">
                  <div className="absolute top-4 right-4 text-2xl opacity-20">{icon}</div>
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold mb-4">
                    {step}
                  </span>
                  <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/new"
                className="bg-indigo-600 text-white font-medium px-6 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
              >
                Start your first project →
              </Link>
              {/* <Link href="/pricing" className="text-sm text-indigo-600 hover:underline">See pricing first</Link> */}
            </div>
          </div>
        ) : (
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {projects.length} project{projects.length !== 1 ? "s" : ""}
                {pendingProjects > 0 && (
                  <span className="ml-2 text-amber-600 font-medium">· {pendingProjects} need attention</span>
                )}
              </p>
            </div>
            {role !== "reviewer" && (
              <Link
                href="/new"
                className="bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                + New project
              </Link>
            )}
          </div>
        )}

        {/* KPI Cards — hidden on first-time empty state to avoid noise */}
        {!isFirstTime && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {kpis.map((kpi: (typeof kpis)[number]) => (
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
        )}

        {/* Projects table or reviewer empty state */}
        {projectsWithProgress.length === 0 && role === "reviewer" ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-400 text-sm">No projects assigned to you yet.</p>
            <p className="text-xs text-gray-400 mt-1">Your manager will assign a project when a translation is ready for review.</p>
          </div>
        ) : !isFirstTime && projectsWithProgress.length > 0 ? (
          <ProjectsTable
            initialProjects={projectsWithProgress}
            role={role}
            currentUserId={userId}
            reviewerUsers={reviewerUsers}
          />
        ) : null}
      </main>
    </div>
  )
}
