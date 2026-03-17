import type { Metadata } from "next"
import "./globals.css"
import LayoutShell from "@/components/LayoutShell"

export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
    ],
    shortcut: ["/favicon.ico"],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  )
}
