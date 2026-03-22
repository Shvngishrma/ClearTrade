import Link from "next/link"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/authOptions"
import { getGuestActivityRows, getGuestAdminStats, isAllowedAdminEmail } from "@/lib/adminDashboard"

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-5">
      <p className="text-sm text-gray-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-zinc-100">{value}</p>
    </div>
  )
}

export default async function GuestMetricsPage() {
  const session = await getServerSession(authOptions)

  if (!isAllowedAdminEmail(session?.user?.email)) {
    redirect("/")
  }

  const [stats, guests] = await Promise.all([
    getGuestAdminStats(),
    getGuestActivityRows(),
  ])

  return (
    <main className="max-w-6xl mx-auto p-6 md:p-8 space-y-6 text-gray-900 dark:text-zinc-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Guest Metrics</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Guest activity and tracked guest document counts</p>
        </div>
        <Link
          href="/admin/user-segments"
          className="rounded-lg border border-gray-200 dark:border-zinc-700 px-3 py-2 text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800"
        >
          Back to Segments
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total guests tracked" value={stats.totalGuests} />
        <StatCard label="Guests active today" value={stats.guestsActiveToday} />
        <StatCard label="Guest documents generated" value={stats.totalGuestDocuments} />
      </div>

      <section className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 overflow-hidden">
        {guests.length === 0 ? (
          <p className="p-5 text-sm text-gray-500 dark:text-zinc-400">No guest activity found yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-zinc-700">
            {guests.map((guest) => (
              <li key={guest.guestId} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900 dark:text-zinc-100 break-all">{guest.guestId}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">Documents generated: {guest.docsGenerated}</p>
                </div>
                <div className="text-sm text-gray-500 dark:text-zinc-400 space-y-1">
                  <p>
                    Created: {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(guest.createdAt)}
                  </p>
                  <p>
                    Last active: {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(guest.lastActiveAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
