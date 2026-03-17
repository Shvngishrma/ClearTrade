/**
 * React Hook for Guest User Tracking
 * Provides guest tracking functionality in React components
 */

"use client"

import { useEffect, useState } from "react"
import {
  getOrCreateGuestId,
  getCurrentGuestId,
  getGuestDocsGenerated,
  getGuestRemaining,
  isGuestLimitReached,
  incrementGuestDocsCount,
  isLocalStorageAvailable,
} from "@/lib/guestTracking"

interface UseGuestTrackingReturn {
  guestId: string | null
  docsGenerated: number
  remaining: number
  isLimitReached: boolean
  isAvailable: boolean
  incrementCount: () => number
  reset: () => void
}

export function useGuestTracking(documentLimit: number = 7): UseGuestTrackingReturn {
  const [guestId, setGuestId] = useState<string | null>(null)
  const [docsGenerated, setDocsGenerated] = useState(0)
  const [isAvailable, setIsAvailable] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Initialize on client side only
  useEffect(() => {
    setMounted(true)
    const available = isLocalStorageAvailable()
    setIsAvailable(available)

    if (available) {
      const id = getOrCreateGuestId()
      setGuestId(id)
      setDocsGenerated(getGuestDocsGenerated())
    }
  }, [])

  const remaining = Math.max(0, documentLimit - docsGenerated)
  const isLimited = isGuestLimitReached(documentLimit)

  const handleIncrement = () => {
    const newCount = incrementGuestDocsCount()
    setDocsGenerated(newCount)
    return newCount
  }

  const handleReset = () => {
    setDocsGenerated(0)
    setGuestId(getOrCreateGuestId())
  }

  // Only return stable values after mount
  if (!mounted) {
    return {
      guestId: null,
      docsGenerated: 0,
      remaining: documentLimit,
      isLimitReached: false,
      isAvailable: false,
      incrementCount: () => 0,
      reset: () => {},
    }
  }

  return {
    guestId,
    docsGenerated,
    remaining,
    isLimitReached: isLimited,
    isAvailable,
    incrementCount: handleIncrement,
    reset: handleReset,
  }
}
