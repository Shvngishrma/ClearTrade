"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { Providers } from "@/app/providers"
import Navbar from "@/components/Navbar"
import Sidebar from "@/components/Sidebar"
import { getOrCreateGuestId, isLocalStorageAvailable, markGuestVisitTrackedToday, shouldTrackGuestVisitToday } from "@/lib/guestTracking"

function GuestVisitTracker({ pathname }: { pathname: string }) {
  const { status } = useSession()

  useEffect(() => {
    if (status !== "unauthenticated") {
      return
    }

    if (!isLocalStorageAvailable()) {
      return
    }

    if (!shouldTrackGuestVisitToday()) {
      return
    }

    const guestId = getOrCreateGuestId()
    if (!guestId) {
      return
    }

    fetch("/api/guest/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId, action: "visit" }),
    })
      .then((res) => {
        if (res.ok) {
          markGuestVisitTrackedToday()
        }
      })
      .catch(() => null)
  }, [status, pathname])

  return null
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    document.documentElement.classList.add("dark")
  }, [])

  return (
    <Providers>
      <GuestVisitTracker pathname={pathname} />
      <Sidebar />
      <Navbar />
      <div key={pathname} className="page-transition">
        {children}
      </div>
    </Providers>
  )
}
