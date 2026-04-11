import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

// GET /api/reviewer-applications/[id]/cv — admin only, returns the uploaded CV file
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const application = await db.reviewerApplication.findUnique({
    where: { id },
    select: { cvData: true, cvFileName: true, cvMimeType: true },
  })

  if (!application?.cvData) {
    return NextResponse.json({ error: "CV not found" }, { status: 404 })
  }

  const buffer = Buffer.from(application.cvData, "base64")
  const filename = application.cvFileName ?? "cv"
  const mimeType = application.cvMimeType ?? "application/octet-stream"

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
    },
  })
}
