"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import ProfileDropdown from "./ProfileDropdown"

export default function Navbar() {
  const pathname = usePathname()

  const isAppPage =
    pathname.startsWith("/documents") || pathname.startsWith("/dashboard") || pathname.startsWith("/settings")

  return (
    <header className="h-14 border-b border-gray-200 dark:border-zinc-700 flex items-center px-6 justify-between bg-white dark:bg-zinc-900">
      {/* LEFT - Home icon (only on app pages) */}
      <div>
        {isAppPage && (
          <Link href="/" className="text-xl text-gray-700 dark:text-zinc-200">
            🏠
          </Link>
        )}
      </div>

      {/* RIGHT - Navigation links and Profile */}
      <div className="flex gap-8 items-center text-sm font-medium text-gray-700 dark:text-zinc-200">
        <Link href="/pricing" className="hover:text-gray-900 dark:hover:text-white">Pricing</Link>
        <Link href="/features" className="hover:text-gray-900 dark:hover:text-white">Features</Link>
        <ProfileDropdown />
      </div>
    </header>
  )
}
