"use client"

import Link from "next/link"

export default function TopNav() {
  return (
    <nav className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 hover:opacity-75 transition"
        >
          <div className="w-8 h-8 bg-black rounded flex items-center justify-center text-white text-sm font-bold">
            📦
          </div>
          <span className="font-bold text-lg hidden sm:inline">Export SaaS</span>
        </Link>

        {/* Right: Auth */}
        <div className="flex items-center gap-4" />
      </div>
    </nav>
  )
}
