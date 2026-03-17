"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { Providers } from "@/app/providers"
import Navbar from "@/components/Navbar"
import Sidebar from "@/components/Sidebar"

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    document.documentElement.classList.add("dark")
  }, [])

  return (
    <Providers>
      <Sidebar />
      <Navbar />
      <div key={pathname} className="page-transition">
        {children}
      </div>
    </Providers>
  )
}
