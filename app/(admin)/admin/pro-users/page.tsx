import Link from "next/link"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/authOptions"
import { isAllowedAdminEmail } from "@/lib/adminDashboard"
import { prisma } from "@/lib/db"

export default async function ProUsersPage() {
  const session = await getServerSession(authOptions)

  if (!isAllowedAdminEmail(session?.user?.email)) {
    redirect("/")
  }

  const users = await prisma.user.findMany({
    where: { isPro: true },
    select: {
      email: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  return (
    <main className="max-w-6xl mx-auto p-6 md:p-8 space-y-6 text-gray-900 dark:text-zinc-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pro Users</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">Total: {users.length}</p>
        </div>
        <Link
          href="/admin"
          className="rounded-lg border border-gray-200 dark:border-zinc-700 px-3 py-2 text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800"
        >
          Back to Admin
        </Link>
      </div>

      <section className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 overflow-hidden">
        {users.length === 0 ? (
          <p className="p-5 text-sm text-gray-500 dark:text-zinc-400">No Pro users found.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-zinc-700">
            {users.map((user) => (
              <li key={`${user.email}-${user.createdAt.toISOString()}`} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="font-medium text-gray-900 dark:text-zinc-100 break-all">{user.email}</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  {new Intl.DateTimeFormat("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(user.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
