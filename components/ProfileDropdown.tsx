"use client"

import { useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import Link from "next/link"

export default function ProfileDropdown() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout>()

  // Detect if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest("[data-profile-dropdown]")) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("click", handleClickOutside)
      return () => document.removeEventListener("click", handleClickOutside)
    }
  }, [isOpen])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [timeoutId])

  const handleMouseLeave = () => {
    const id = setTimeout(() => {
      setIsOpen(false)
    }, 300)
    setTimeoutId(id)
  }

  const handleMouseEnter = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      setTimeoutId(undefined)
    }
    setIsOpen(true)
  }

  const emailInitial = (session?.user?.email || "").trim().charAt(0).toUpperCase() || "U"
  const profileImage = (session?.user?.image || "").trim()

  return (
    <div
      className="relative"
      data-profile-dropdown
      onMouseEnter={() => !isMobile && handleMouseEnter()}
      onMouseLeave={() => !isMobile && handleMouseLeave()}
    >
      <button
        onClick={() => isMobile && setIsOpen(!isOpen)}
        className="w-9 h-9 rounded-full bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition overflow-hidden flex items-center justify-center"
      >
        {session ? (
          profileImage ? (
            <img
              src={profileImage}
              alt="Profile"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-xs font-semibold text-gray-700 dark:text-zinc-200">{emailInitial}</span>
          )
        ) : (
          <svg
            className="w-4 h-4 text-gray-600 dark:text-zinc-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.118a7.5 7.5 0 0115 0A17.933 17.933 0 0112 21.75a17.933 17.933 0 01-7.5-1.632z"
            />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full pt-2 z-50">
          <div className="w-48 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg">
            {session ? (
              <>
                <div className="px-4 py-2 border-b border-gray-200 dark:border-zinc-700">
                  <p className="text-sm font-medium text-gray-700 dark:text-zinc-200">{session.user?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400">{session.user?.email}</p>
                </div>
                <div className="py-2">
                  <Link
                    href="/settings"
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800"
                  >
                    Settings
                  </Link>
                  <button
                    onClick={() => signOut()}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800"
                  >
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              <div className="py-2">
                <Link
                  href="/login"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800"
                >
                  Login
                </Link>
                <Link
                  href="/settings"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800"
                >
                  Settings
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
