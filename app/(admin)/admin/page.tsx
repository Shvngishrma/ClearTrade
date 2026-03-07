import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { authOptions } from "@/lib/authOptions"
import { getAdminDashboardStats, isAllowedAdminEmail } from "@/lib/adminDashboard"

function StatCard({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const card = (
    <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-5">
      <p className="text-sm text-gray-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-zinc-100">{value}</p>
    </div>
  )

  if (!href) {
    return card
  }

  return (
    <Link href={href} className="block rounded-xl transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400">
      {card}
    </Link>
  )
}

export default async function AdminPage() {
  const session = await getServerSession(authOptions)

  if (!isAllowedAdminEmail(session?.user?.email)) {
    redirect("/")
  }

  const stats = await getAdminDashboardStats()
  const formattedRevenue = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(stats.totalRevenue)

  return (
    <main className="max-w-6xl mx-auto p-6 md:p-8 space-y-6 text-gray-900 dark:text-zinc-100">
      <div>
        <h1 className="text-2xl font-semibold">Internal Admin Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Private operational stats</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total users" value={stats.totalUsers} />
        <StatCard label="Total Pro users" value={stats.totalProUsers} href="/admin/pro-users" />
        <StatCard label="Total Free users" value={stats.totalFreeUsers} href="/admin/free-users" />
        <StatCard label="Total documents generated" value={stats.totalDocumentsGenerated} />
        <StatCard label="Total revenue (successful payments)" value={formattedRevenue} />
        <StatCard label="Users registered today" value={stats.usersRegisteredToday} />
        <StatCard label="Documents generated today" value={stats.documentsGeneratedToday} />
      </div>
    </main>
  )
}