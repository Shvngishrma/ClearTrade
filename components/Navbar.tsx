"use client"

import Link from "next/link"
import Image from "next/image"
import ProfileDropdown from "./ProfileDropdown"

export default function Navbar() {
  return (
    <header className="h-14 border-b border-gray-200 dark:border-zinc-700 flex items-center px-5 pl-14 lg:px-6 lg:pl-6 justify-between bg-white dark:bg-zinc-900">
      {/* LEFT - Brand lockup */}
      <Link
        href="/"
        className="flex items-center min-w-0 hover:opacity-90 transition"
        aria-label="ClearTrade home"
      >
        <Image
          src="/brand-logo.svg"
          alt="ClearTrade logo"
          width={140}
          height={32}
          className="h-7 sm:h-8 w-auto"
          priority
        />
      </Link>

      {/* RIGHT - Navigation links and Profile */}
      <div className="flex gap-8 items-center text-sm font-medium text-gray-700 dark:text-zinc-200">
        <Link href="/pricing" className="hover:text-gray-900 dark:hover:text-white">Pricing</Link>
        <Link href="/features" className="hover:text-gray-900 dark:hover:text-white">Features</Link>
        <ProfileDropdown />
      </div>
    </header>
  )
}
