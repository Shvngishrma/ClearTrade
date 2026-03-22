import Link from "next/link"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/authOptions"
import { getAdminDashboardStats, getGuestAdminStats, isAllowedAdminEmail } from "@/lib/adminDashboard"

function SegmentCard({
  title,
  description,
  href,
  value,
}: {
  title: string
  description: string
  href: string
  value: number
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-5 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
    >
      <p className="text-sm text-gray-500 dark:text-zinc-400">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-zinc-100">{value}</p>
      <p className="mt-3 text-sm text-gray-600 dark:text-zinc-300">{description}</p>
    </Link>
  )
}

export default async function UserSegmentsPage() {
  const session = await getServerSession(authOptions)

  if (!isAllowedAdminEmail(session?.user?.email)) {
    redirect("/")
  }

  const [memberStats, guestStats] = await Promise.all([
    getAdminDashboardStats(),
    getGuestAdminStats(),
  ])

  return (
    <main className="max-w-6xl mx-auto p-6 md:p-8 space-y-6 text-gray-900 dark:text-zinc-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">User Segments</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Choose which audience metrics to inspect</p>
        </div>
        <Link
          href="/admin"
          className="rounded-lg border border-gray-200 dark:border-zinc-700 px-3 py-2 text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800"
        >
          Back to Admin
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SegmentCard
          title="Members"
          value={memberStats.totalUsers}
          href="/admin/user-segments/member"
          description="Registered user metrics (existing member stats remain unchanged)."
        />
        <SegmentCard
          title="Guests"
          value={guestStats.totalGuests}
          href="/admin/user-segments/guest"
          description="Guest tracking metrics and guest activity details."
        />
      </div>
    </main>
  )
}
