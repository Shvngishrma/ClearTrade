import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const [totalDocs, inProgress, pending] = await Promise.all([
    prisma.document.count({ where: { userId: session.user.id } }),
    prisma.document.count({ where: { userId: session.user.id, status: "IN_PROGRESS" } }),
    prisma.document.count({ where: { userId: session.user.id, status: "PENDING" } }),
  ])

  return NextResponse.json({ totalDocs, inProgress, pending })
}
