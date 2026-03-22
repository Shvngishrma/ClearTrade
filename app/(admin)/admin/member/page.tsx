import Link from "next/link"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
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

export default async function MemberMetricsPage() {
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
    <main className="md:pl-16 lg:pl-24 p-8 text-gray-900 dark:text-zinc-100">
      <div className="max-w-[1100px] mx-auto space-y-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Member Metrics</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Current registered user metrics (unchanged baseline)</p>
          </div>
          <Link
            href="/admin"
            className="rounded-lg border border-gray-200 dark:border-zinc-700 px-3 py-2 text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800"
          >
            Back
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard label="Total members" value={stats.totalUsers} />
          <StatCard label="Total Pro members" value={stats.totalProUsers} href="/admin/pro-users" />
          <StatCard label="Total Free members" value={stats.totalFreeUsers} href="/admin/free-users" />
          <StatCard label="Total member documents generated" value={stats.totalDocumentsGenerated} />
          <StatCard label="Total revenue (successful payments)" value={formattedRevenue} />
          <StatCard label="Members registered today" value={stats.usersRegisteredToday} />
          <StatCard label="Member documents generated today" value={stats.documentsGeneratedToday} />
        </div>
      </div>
    </main>
  )
}
