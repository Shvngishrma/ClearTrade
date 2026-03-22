import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { authOptions } from "@/lib/authOptions"
import { isAllowedAdminEmail } from "@/lib/adminDashboard"

export default async function AdminPage() {
  const session = await getServerSession(authOptions)

  if (!isAllowedAdminEmail(session?.user?.email)) {
    redirect("/")
  }

  return (
    <main className="min-h-screen md:pl-16 lg:pl-24 p-8 text-gray-900 dark:text-zinc-100 flex items-center justify-center">
      <div className="w-full max-w-[1100px] mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold">Select Metrics View</h1>
          <p className="text-base text-gray-500 dark:text-zinc-400">Choose one category to view detailed metrics.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/admin/member"
            className="group rounded-2xl border border-gray-300 dark:border-zinc-600 bg-white/70 dark:bg-zinc-800/80 p-10 min-h-[220px] flex flex-col justify-center transition-all duration-200 hover:scale-[1.01] hover:border-gray-500 dark:hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            <p className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">Member Metrics</p>
            <p className="mt-3 text-sm text-gray-600 dark:text-zinc-300">View registered member stats, Pro/Free splits, and member document activity.</p>
          </Link>

          <Link
            href="/admin/guest"
            className="group rounded-2xl border border-gray-300 dark:border-zinc-600 bg-white/70 dark:bg-zinc-800/80 p-10 min-h-[220px] flex flex-col justify-center transition-all duration-200 hover:scale-[1.01] hover:border-gray-500 dark:hover:border-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            <p className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">Guest Metrics</p>
            <p className="mt-3 text-sm text-gray-600 dark:text-zinc-300">View guest tracking totals, active guests, and guest document generation stats.</p>
          </Link>
        </div>
      </div>
    </main>
  )
}