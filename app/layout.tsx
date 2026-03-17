import type { Metadata } from "next"
import "./globals.css"
import LayoutShell from "@/components/LayoutShell"

export const metadata: Metadata = {
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico?v=4", sizes: "any" },
      { url: "/favicon-16x16.png?v=4", type: "image/png", sizes: "16x16" },
      { url: "/favicon-32x32.png?v=4", type: "image/png", sizes: "32x32" },
      { url: "/favicon.png?v=4", type: "image/png", sizes: "32x32" },
    ],
    shortcut: ["/favicon.ico?v=4"],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
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
