/**
 * Exchange Rate Service
 * Handles daily exchange rates with snapshot storage
 * Real-world: Uses RBI reference rates + date-based lookups
 */

export interface ExchangeRateSnapshot {
  currency: string
  rate: number
  date: Date
  source: "RBI" | "BANK" | "MANUAL"
  description?: string
}

// RBI Reference Rates (as of 18 Feb 2026)
// In production, fetch from RBI API: https://www.rbi.org.in/
const RBI_RATES: Record<string, number> = {
  USD: 90.69,
  EUR: 107.37,
  GBP: 122.93,
  JPY: 0.5917,
  AED: 24.70,
  AUD: 64.13,
  CAD: 66.47,
  CHF: 117.72,
  CNY: 13.12,
  SGD: 71.80,
  HKD: 11.60,
  NZD: 54.78,
  MXN: 5.28,
  BRL: 17.36,
}

// Historical rates storage (in production, use database/cache)
const HISTORICAL_RATES: Record<string, ExchangeRateSnapshot[]> = {}

/**
 * Get exchange rate for specific date
 * NEVER hardcode rates - always date-bound
 */
export function getExchangeRateForDate(
  currency: string,
  date: Date = new Date()
): ExchangeRateSnapshot | null {
  if (currency === "INR") {
    return null // No conversion needed
  }

  const dateKey = date.toISOString().split("T")[0]
  const historical = HISTORICAL_RATES[dateKey]

  if (historical) {
    const found = historical.find((r) => r.currency === currency)
    if (found) return found
  }

  // Fall back to current RBI rate with warning
  const rate = RBI_RATES[currency]
  if (!rate) {
    throw new Error(
      `No exchange rate available for ${currency}. Last updated: ${new Date().toLocaleDateString()}`
    )
  }

  console.warn(
    `Using current RBI rate for ${currency}. Ideal: use historical rate for ${dateKey}`
  )

  return {
    currency,
    rate,
    date: new Date(),
    source: "RBI",
    description: `Current RBI reference rate (actual rate for ${dateKey} not in system)`,
  }
}

/**
 * Store a rate snapshot (for audit trail)
 * Called when invoice is created
 */
export function storeExchangeRateSnapshot(
  currency: string,
  rate: number,
  date: Date,
  source: "RBI" | "BANK" | "MANUAL" = "RBI"
): ExchangeRateSnapshot {
  const snapshot: ExchangeRateSnapshot = {
    currency,
    rate,
    date,
    source,
  }

  const dateKey = date.toISOString().split("T")[0]
  if (!HISTORICAL_RATES[dateKey]) {
    HISTORICAL_RATES[dateKey] = []
  }

  HISTORICAL_RATES[dateKey].push(snapshot)
  return snapshot
}

/**
 * Calculate INR value with snapshot
 * Backend ALWAYS calculates, never trusts user input
 */
export function convertToINRWithSnapshot(
  amount: number,
  currency: string,
  date: Date = new Date(),
  storedRate?: number // If provided, use this instead of lookup (for updates)
): {
  inrValue: number
  rate: number
  snapshot: ExchangeRateSnapshot
} {
  if (currency === "INR") {
    return {
      inrValue: amount,
      rate: 1,
      snapshot: {
        currency: "INR",
        rate: 1,
        date,
        source: "RBI",
        description: "No conversion needed",
      },
    }
  }

  let rate = storedRate
  let source: "RBI" | "BANK" | "MANUAL" = "RBI"

  if (!rate) {
    const snapshot = getExchangeRateForDate(currency, date)
    if (!snapshot) {
      throw new Error(`Cannot convert ${currency} - rate not available for ${date.toLocaleDateString()}`)
    }
    rate = snapshot.rate
    source = snapshot.source
  }

  const inrValue = amount * rate

  return {
    inrValue: parseFloat(inrValue.toFixed(2)),
    rate,
    snapshot: {
      currency,
      rate,
      date,
      source,
      description: `${source} rate on ${date.toLocaleDateString()}`,
    },
  }
}

/**
 * Validate rate is reasonable (sanity check)
 * Prevents typos like 8345 instead of 83.45
 */
export function validateExchangeRate(currency: string, rate: number): boolean {
  if (!RBI_RATES[currency]) return true // Unknown currency, can't validate

  const rbiRate = RBI_RATES[currency]
  const variance = Math.abs(rate - rbiRate) / rbiRate

  // Flag if rate varies by more than 5% from current RBI rate
  if (variance > 0.05) {
    console.warn(
      `⚠️  Exchange rate ${currency}: ${rate} varies >5% from RBI rate ${rbiRate}. Verify correctness.`
    )
    return false
  }

  return true
}

/**
 * Get all available rates for a date
 */
export function getAvailableRatesForDate(date: Date): Record<string, number> {
  const dateKey = date.toISOString().split("T")[0]
  const historical = HISTORICAL_RATES[dateKey]

  if (historical) {
    return Object.fromEntries(historical.map((r) => [r.currency, r.rate]))
  }

  return RBI_RATES // Fall back to current rates
}
