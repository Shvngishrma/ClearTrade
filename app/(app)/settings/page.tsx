"use client"

import { useSession, signOut } from "next-auth/react"
import Link from "next/link"
import PrimaryButton from "../../../components/PrimaryButton"

export default function SettingsPage() {
  const { data: session } = useSession()
  const isPro = Boolean(session?.user?.isPro)

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto rounded-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-100">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
          Manage your account, appearance, and support options.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px,1fr] gap-6">
        <aside className="rounded-2xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 h-fit">
          <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wide mb-3">
            Preferences
          </p>
          <div className="space-y-1 text-sm">
            <a href="#account" className="block px-3 py-2 rounded-lg text-gray-700 dark:text-zinc-200 bg-gray-50 dark:bg-zinc-800">
              Account
            </a>
            <a href="#about" className="block px-3 py-2 rounded-lg text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800">
              About
            </a>
          </div>
        </aside>

        <div className="space-y-6">
          <section id="account" className="rounded-2xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
            <h2 className="text-lg font-medium text-gray-900 dark:text-zinc-100 mb-4">Account</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">Email</p>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">{session?.user?.email || "—"}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">Subscription</p>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">{isPro ? "Pro Plan" : "Free Plan"}</p>
                </div>
                {!isPro && (
                  <PrimaryButton
                    href="/pricing"
                    className="px-3 py-2 text-sm"
                  >
                    Upgrade
                  </PrimaryButton>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">Session</p>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">
                    {session?.user ? "Sign out from this account." : "Sign in to sync your account and history."}
                  </p>
                </div>
                {session?.user ? (
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-zinc-600 text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800"
                  >
                    Sign out
                  </button>
                ) : (
                  <PrimaryButton
                    href="/login"
                    className="px-3 py-2 text-sm"
                  >
                    Sign in
                  </PrimaryButton>
                )}
              </div>
            </div>
          </section>

          <section id="about" className="rounded-2xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5">
            <h2 className="text-lg font-medium text-gray-900 dark:text-zinc-100 mb-4">About</h2>

            <div className="space-y-3">
              <a
                href="mailto:support@exportsaas.com?subject=Bug%20Report"
                className="flex items-center justify-between border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">Report a bug</p>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">Send details to support.</p>
                </div>
                <span className="text-sm text-gray-500 dark:text-zinc-400">↗</span>
              </a>

              <Link
                href="/privacy"
                className="flex items-center justify-between border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">Privacy policy</p>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">Read how your data is handled.</p>
                </div>
                <span className="text-sm text-gray-500 dark:text-zinc-400">→</span>
              </Link>

              <Link
                href="/terms"
                className="flex items-center justify-between border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">Terms of service</p>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">Review the service terms and usage rules.</p>
                </div>
                <span className="text-sm text-gray-500 dark:text-zinc-400">→</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
