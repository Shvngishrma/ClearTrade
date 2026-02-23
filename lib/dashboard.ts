import { prisma } from "@/lib/db"

export async function getDashboardData(userId: string) {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)

  const [
    totalThisMonth,
    inProgress,
    pending,
    recentActivity,
  ] = await Promise.all([
    prisma.document.count({
      where: {
        userId,
        status: "GENERATED",
        createdAt: { gte: startOfMonth },
      },
    }),

    prisma.document.count({
      where: {
        userId,
        status: "IN_PROGRESS",
      },
    }),

    prisma.document.count({
      where: {
        userId,
        status: "FAILED",
      },
    }),

    prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ])

  return {
    stats: {
      totalThisMonth,
      inProgress,
      pending,
    },
    recentActivity,
  }
}
