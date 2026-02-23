import { prisma } from "@/lib/db"
import { getCurrentUser } from "./auth"

export async function checkUsage() {
  const user = await getCurrentUser()
  if (!user) throw new Error("UNAUTHORIZED")

  const usage = await prisma.usage.findFirst({
    where: { userId: user.id },
  })

  if (!usage) {
    await prisma.usage.create({
      data: { userId: user.id },
    })
    return { isPro: user.isPro }
  }

  if (!user.isPro && usage.count >= 7) {
    throw new Error("FREE_LIMIT_EXCEEDED")
  }

  return { isPro: user.isPro }
}

export async function incrementUsage() {
  const user = await getCurrentUser()
  if (!user) return

  await prisma.usage.updateMany({
    where: { userId: user.id },
    data: { count: { increment: 1 } },
  })
}
