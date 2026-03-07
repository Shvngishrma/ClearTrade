"use client"

import { useEffect } from "react"
import { SessionProvider } from "next-auth/react"
import posthog from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"

let posthogInitialized = false

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY

    if (!posthogKey || posthogInitialized) {
      return
    }

    posthog.init(posthogKey, {
      api_host: "https://us.i.posthog.com",
      capture_pageview: true,
      autocapture: true,
    })

    posthogInitialized = true
  }, [])

  return (
    <PHProvider client={posthog}>
      <SessionProvider>{children}</SessionProvider>
    </PHProvider>
  )
}
