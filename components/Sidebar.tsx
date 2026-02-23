"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import clsx from "clsx"

function NavItem({
  href,
  label,
}: {
  href: string
  label: string
}) {
  const pathname = usePathname()
  const active = pathname === href

  return (
    <Link
      href={href}
      className={clsx(
        "block rounded-md px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-gray-100 dark:bg-zinc-800 text-black dark:text-zinc-100"
          : "text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-zinc-100"
      )}
    >
      {label}
    </Link>
  )
}

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const { data: session } = useSession()
  
  const isPro = session?.user?.isPro || false
  const profileImage = (session?.user?.image || "").trim()
  const emailInitial = (session?.user?.email || "").trim().charAt(0).toUpperCase() || "U"

  // Detect if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const handleMouseEnter = () => {
    if (!isMobile) {
      setIsOpen(true)
    }
  }

  useEffect(() => {
    if (isMobile || !isOpen) return

    const SIDEBAR_WIDTH_PX = 256

    const handleMouseMove = (event: MouseEvent) => {
      if (event.clientX > SIDEBAR_WIDTH_PX) {
        setIsOpen(false)
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [isMobile, isOpen])

  return (
    <>
      {/* Toggle Button - always visible */}
      <button
        onClick={() => isMobile && setIsOpen(!isOpen)}
        onMouseEnter={handleMouseEnter}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all shadow-sm text-gray-700 dark:text-zinc-200"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Overlay for mobile */}
      {isOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/20 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        onMouseEnter={handleMouseEnter}
        className={clsx(
          "fixed top-0 left-0 h-screen bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-700 z-40 flex flex-col transition-all duration-300 ease-in-out",
          isOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full"
        )}
      >
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Navigation */}
          <nav className="flex flex-col gap-1 px-4 py-6 mt-16">
            <NavItem href="/" label="Home" />
            <NavItem href="/dashboard" label="Dashboard" />
            <NavItem href="/documents" label="Documents" />
            <NavItem href="/settings" label="Settings" />
          </nav>

          {/* Upgrade CTA */}
          <div className="mt-auto p-4">
            {session && (
              <div className="mb-3 flex items-center gap-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-700 overflow-hidden flex items-center justify-center">
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-gray-700 dark:text-zinc-200">{emailInitial}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-800 dark:text-zinc-200 truncate">{session.user?.name || "User"}</p>
                  <p className="text-[11px] text-gray-500 dark:text-zinc-400 truncate">{session.user?.email}</p>
                </div>
              </div>
            )}

            <a
              href="/pricing"
              className={clsx(
                "block px-4 py-3 rounded-xl font-medium text-center",
                isPro
                  ? "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200 cursor-default"
                  : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
              )}
            >
              {isPro ? "Pro ✓" : "Upgrade →"}
            </a>
          </div>
        </div>
      </aside>

      {/* Spacer */}
      <div
        className={clsx(
          "transition-all duration-300 ease-in-out",
          isOpen && !isMobile ? "w-64" : "w-0"
        )}
      />
    </>
  )
}
