"use client"

import { useEffect, useState } from "react"
import { SessionProvider } from "next-auth/react"
import { PostHogProvider } from "posthog-js/react"

export function Providers({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<any>(null)

  useEffect(() => {
    const initPostHog = async () => {
      const posthog = (await import("posthog-js")).default

      posthog.init(
        process.env.NEXT_PUBLIC_POSTHOG_KEY!,
        {
          api_host: "https://us.i.posthog.com",
          capture_pageview: true,
        }
      )

      setClient(posthog)
    }

    initPostHog()
  }, [])

  if (!client) {
    return <SessionProvider>{children}</SessionProvider>
  }

  return (
    <PostHogProvider client={client}>
      <SessionProvider>{children}</SessionProvider>
    </PostHogProvider>
  )
}
