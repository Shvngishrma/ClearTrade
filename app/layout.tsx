"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import "./globals.css"
import { SessionProvider } from "next-auth/react"
import Navbar from "@/components/Navbar"
import Sidebar from "@/components/Sidebar"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    const saved = localStorage.getItem("theme-preference")
    const theme = saved === "light" || saved === "dark" || saved === "system" ? saved : "system"
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const shouldDark = theme === "dark" || (theme === "system" && prefersDark)

    document.documentElement.classList.toggle("dark", shouldDark)
  }, [])

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <SessionProvider>
          <Sidebar />
          <Navbar />
          <div key={pathname} className="page-transition">
            {children}
          </div>
        </SessionProvider>
      </body>
    </html>
  )
}
