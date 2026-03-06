import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

export async function GET() {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const usage = await prisma.usage.upsert({
    where: { userId: user.id },
    create: { userId: user.id, isPro: user.isPro },
    update: { isPro: user.isPro },
    select: { count: true },
  })

  return NextResponse.json({
    count: usage.count,
    isPro: Boolean(user.isPro),
  })
}
