import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// DELETE /api/account/api-keys/[keyId] — revoke an API key
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { keyId } = await params

  const apiKey = await db.apiKey.findUnique({ where: { id: keyId } })
  if (!apiKey) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (apiKey.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (apiKey.revokedAt !== null) return NextResponse.json({ error: "Key already revoked" }, { status: 409 })

  await db.apiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  })

  return new NextResponse(null, { status: 204 })
}
