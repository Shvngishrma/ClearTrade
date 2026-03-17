"use client"

import Link from "next/link"
import Image from "next/image"
import ProfileDropdown from "./ProfileDropdown"

export default function Navbar() {
  return (
    <header className="h-16 border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      <div className="w-full pl-4 pr-5 md:pl-6 md:pr-8 lg:pl-8 lg:pr-10 h-full flex items-center justify-between">
        {/* LEFT - Brand lockup */}
        <Link
          href="/"
          className="flex items-center min-w-0 hover:opacity-90 transition"
          aria-label="ClearTrade home"
        >
          <Image
            src="/brand-logo.svg"
            alt="ClearTrade logo"
            width={156}
            height={36}
            className="h-8 sm:h-9 w-auto"
            priority
          />
        </Link>

        {/* RIGHT - Navigation links and Profile */}
        <div className="flex gap-8 items-center text-sm font-medium text-gray-700 dark:text-zinc-200">
          <Link href="/pricing" className="hover:text-gray-900 dark:hover:text-white">Pricing</Link>
          <Link href="/features" className="hover:text-gray-900 dark:hover:text-white">Features</Link>
          <ProfileDropdown />
        </div>
      </div>
    </header>
  )
}
