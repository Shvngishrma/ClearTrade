/**
 * Guest User Tracking - Client-side localStorage management
 * Tracks unique guests and their document generation usage without authentication
 */

const GUEST_ID_KEY = "clearTrade_guestId"
const GUEST_DOCS_COUNT_KEY = "clearTrade_docsGenerated"
const GUEST_ID_EXPIRY_KEY = "clearTrade_guestExpiry"
const GUEST_LAST_VISIT_TRACKED_DATE_KEY = "clearTrade_lastVisitTrackedDate"
const GUEST_ID_EXPIRY_DAYS = 90 // Expire guest ID after 90 days

// Safe localStorage access with fallback
function safeGetItem(key: string): string | null {
  try {
    if (typeof window === "undefined") return null
    return localStorage.getItem(key)
  } catch {
    // localStorage not available (private mode, old browser, etc)
    return null
  }
}

function safeSetItem(key: string, value: string): boolean {
  try {
    if (typeof window === "undefined") return false
    localStorage.setItem(key, value)
    return true
  } catch {
    // localStorage not available
    return false
  }
}

// Generate a unique guest ID
function generateGuestId(): string {
  return `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Get or create guest ID
export function getOrCreateGuestId(): string | null {
  const storedId = safeGetItem(GUEST_ID_KEY)
  const expiryTime = safeGetItem(GUEST_ID_EXPIRY_KEY)

  // Check if existing ID is still valid
  if (storedId && expiryTime) {
    const expiryDate = new Date(expiryTime)
    if (expiryDate > new Date()) {
      return storedId
    }
    // ID has expired, clear it
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(GUEST_ID_KEY)
        localStorage.removeItem(GUEST_DOCS_COUNT_KEY)
        localStorage.removeItem(GUEST_ID_EXPIRY_KEY)
      }
    } catch {
      // ignore
    }
  }

  // Create new guest ID
  const newId = generateGuestId()
  const expiryDate = new Date()
  expiryDate.setDate(expiryDate.getDate() + GUEST_ID_EXPIRY_DAYS)

  safeSetItem(GUEST_ID_KEY, newId)
  safeSetItem(GUEST_ID_EXPIRY_KEY, expiryDate.toISOString())

  return newId
}

// Get current guest ID without creating one
export function getCurrentGuestId(): string | null {
  return safeGetItem(GUEST_ID_KEY)
}

// Get documents generated count for guest
export function getGuestDocsGenerated(): number {
  const count = safeGetItem(GUEST_DOCS_COUNT_KEY)
  return count ? parseInt(count, 10) : 0
}

// Increment documents generated count
export function incrementGuestDocsCount(): number {
  const current = getGuestDocsGenerated()
  const newCount = current + 1
  safeSetItem(GUEST_DOCS_COUNT_KEY, String(newCount))
  return newCount
}

function getTodayDateKey(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function shouldTrackGuestVisitToday(): boolean {
  const lastTrackedDate = safeGetItem(GUEST_LAST_VISIT_TRACKED_DATE_KEY)
  return lastTrackedDate !== getTodayDateKey()
}

export function markGuestVisitTrackedToday(): void {
  safeSetItem(GUEST_LAST_VISIT_TRACKED_DATE_KEY, getTodayDateKey())
}

// Get remaining free documents for guest
export function getGuestRemaining(limit: number = 7): number {
  const used = getGuestDocsGenerated()
  return Math.max(0, limit - used)
}

// Check if guest has reached limit
export function isGuestLimitReached(limit: number = 7): boolean {
  return getGuestDocsGenerated() >= limit
}

// Clear guest data (when user logs in or chooses to reset)
export function clearGuestData(): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(GUEST_ID_KEY)
      localStorage.removeItem(GUEST_DOCS_COUNT_KEY)
      localStorage.removeItem(GUEST_ID_EXPIRY_KEY)
      localStorage.removeItem(GUEST_LAST_VISIT_TRACKED_DATE_KEY)
    }
  } catch {
    // ignore
  }
}

// Check if localStorage is available
export function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === "undefined") return false
    const test = "__localStorage_test__"
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch {
    return false
  }
}
