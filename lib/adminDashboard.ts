import { prisma } from "@/lib/db"

const ADMIN_ALLOWED_EMAILS = new Set([
  "knownconstant@gmail.com",
  "gamingstation35@gmail.com",
])

export type AdminDashboardStats = {
  totalUsers: number
  totalProUsers: number
  totalFreeUsers: number
  totalDocumentsGenerated: number
  totalRevenue: number
  usersRegisteredToday: number
  documentsGeneratedToday: number
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value
  }

  if (typeof value === "bigint") {
    return Number(value)
  }

  if (value && typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber()
  }

  return Number(value || 0)
}

export function isAllowedAdminEmail(email?: string | null): boolean {
  const normalizedEmail = String(email || "").trim().toLowerCase()
  return ADMIN_ALLOWED_EMAILS.has(normalizedEmail)
}

function getTodayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(start.getDate() + 1)

  return { start, end }
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const { start, end } = getTodayRange()

  const [
    totalUsers,
    totalProUsers,
    totalFreeUsers,
    totalDocumentsGenerated,
    usersRegisteredToday,
    documentsGeneratedToday,
    successfulPayments,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isPro: true } }),
    prisma.user.count({ where: { isPro: false } }),
    prisma.document.count(),
    prisma.user.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.document.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.payment.aggregate({
      where: { status: { in: ["successful", "completed"] } },
      _sum: { amount: true },
    }),
  ])

  return {
    totalUsers,
    totalProUsers,
    totalFreeUsers,
    totalDocumentsGenerated,
    totalRevenue: toNumber(successfulPayments._sum.amount),
    usersRegisteredToday,
    documentsGeneratedToday,
  }
}