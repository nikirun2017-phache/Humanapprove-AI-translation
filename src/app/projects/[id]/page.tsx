import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { ReviewEditor } from "@/components/review-editor"
import { Navbar } from "@/components/navbar"
import { getLanguageName } from "@/lib/utils"

export const dynamic = "force-dynamic"

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params

  const project = await db.project.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      assignedReviewer: { select: { id: true, name: true } },
    },
  })

  if (!project) redirect("/dashboard")

  const { id: userId, role } = session.user
  if (
    role !== "admin" &&
    project.createdById !== userId &&
    project.assignedReviewerId !== userId
  ) {
    redirect("/dashboard")
  }

  const isReviewer =
    role === "admin" ||
    project.assignedReviewerId === userId ||
    project.createdById === userId

  const totalCount = await db.translationUnit.count({ where: { projectId: id } })
  const approvedCount = await db.translationUnit.count({
    where: { projectId: id, status: "approved" },
  })

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-gray-900">{project.name}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {getLanguageName(project.sourceLanguage)} → {getLanguageName(project.targetLanguage)}
              {project.assignedReviewer && (
                <> · Reviewer: {project.assignedReviewer.name}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">
              <span className="font-medium text-green-600">{approvedCount}</span>
              <span className="text-gray-400">/{totalCount} approved</span>
            </div>
            <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{
                  width: `${totalCount > 0 ? (approvedCount / totalCount) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-4">
        <ReviewEditor
          projectId={id}
          isReviewer={isReviewer}
          projectStatus={project.status}
          currentUserId={userId}
          totalCount={totalCount}
          approvedCount={approvedCount}
        />
      </div>
    </div>
  )
}
