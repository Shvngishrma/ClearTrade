import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  await prisma.user.update({
    where: { id: user.id },
    data: { isPro: true },
  })

  return new Response("Upgraded", { status: 200 })
}
