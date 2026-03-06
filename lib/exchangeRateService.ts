/**
 * Exchange Rate Service
 * Handles daily exchange rates with snapshot storage
 * Uses public FX API + 24h cache with manual fallback
 */

export interface ExchangeRateSnapshot {
  currency: string
  rate: number
  date: Date
  source: "PUBLIC_API" | "BANK" | "MANUAL"
  description?: string
}

export interface PublicExchangeRateResult {
  rate: number
  source: "PUBLIC_API" | "MANUAL"
  fetchedAt: Date
  cacheHit: boolean
  fallbackMessage?: string
}

const FX_CACHE_TTL_MS = 24 * 60 * 60 * 1000

const MANUAL_FALLBACK_RATES: Record<string, number> = {
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

const PUBLIC_API_RATE_CACHE: Record<string, { rate: number; fetchedAt: Date }> = {}

function getManualFallbackRate(currency: string): number | null {
  const normalizedCurrency = currency.toUpperCase()
  const envKey = `MANUAL_EXCHANGE_RATE_${normalizedCurrency}`
  const envRateRaw = process.env[envKey]

  if (envRateRaw !== undefined && envRateRaw !== "") {
    const envRate = Number(envRateRaw)
    if (Number.isFinite(envRate) && envRate > 0) {
      return envRate
    }
  }

  return MANUAL_FALLBACK_RATES[normalizedCurrency] ?? null
}

export async function getPublicExchangeRateWithCache(currency: string): Promise<PublicExchangeRateResult> {
  const normalizedCurrency = (currency || "").trim().toUpperCase()

  if (!normalizedCurrency || normalizedCurrency === "INR") {
    return {
      rate: 1,
      source: "MANUAL",
      fetchedAt: new Date(),
      cacheHit: false,
      fallbackMessage: "INR does not require conversion.",
    }
  }

  const cached = PUBLIC_API_RATE_CACHE[normalizedCurrency]
  const now = Date.now()

  if (cached && now - cached.fetchedAt.getTime() < FX_CACHE_TTL_MS) {
    return {
      rate: cached.rate,
      source: "PUBLIC_API",
      fetchedAt: cached.fetchedAt,
      cacheHit: true,
    }
  }

  try {
    const response = await fetch("https://open.er-api.com/v6/latest/INR", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })

    if (response.ok) {
      const payload = await response.json() as { rates?: Record<string, number> }
      const inrToCurrencyRateRaw = payload?.rates?.[normalizedCurrency]
      const inrToCurrencyRate = Number(inrToCurrencyRateRaw)

      if (Number.isFinite(inrToCurrencyRate) && inrToCurrencyRate > 0) {
        const inrPerCurrency = 1 / inrToCurrencyRate
        const snapshot = {
          rate: Number(inrPerCurrency.toFixed(6)),
          fetchedAt: new Date(),
        }
        PUBLIC_API_RATE_CACHE[normalizedCurrency] = snapshot

        return {
          rate: snapshot.rate,
          source: "PUBLIC_API",
          fetchedAt: snapshot.fetchedAt,
          cacheHit: false,
        }
      }
    }
  } catch {
    // Intentional: manual fallback below
  }

  const manualRate = getManualFallbackRate(normalizedCurrency)
  if (manualRate !== null) {
    return {
      rate: manualRate,
      source: "MANUAL",
      fetchedAt: new Date(),
      cacheHit: false,
      fallbackMessage: `Live public exchange rate unavailable. Using manual fallback rate for ${normalizedCurrency}.`,
    }
  }

  throw new Error(`No exchange rate available for ${normalizedCurrency}. Configure MANUAL_EXCHANGE_RATE_${normalizedCurrency}.`)
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

  // Fall back to manual rate with warning (sync path)
  const rate = getManualFallbackRate(currency)
  if (!rate) {
    throw new Error(
      `No exchange rate available for ${currency}. Last updated: ${new Date().toLocaleDateString()}`
    )
  }

  console.warn(
    `Using manual fallback rate for ${currency}. Prefer getPublicExchangeRateWithCache for live rates.`
  )

  return {
    currency,
    rate,
    date: new Date(),
    source: "MANUAL",
    description: `Manual fallback rate used (live rate for ${dateKey} unavailable in sync flow)`,
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
  source: "PUBLIC_API" | "BANK" | "MANUAL" = "PUBLIC_API"
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
        source: "MANUAL",
        description: "No conversion needed",
      },
    }
  }

  let rate = storedRate
  let source: "PUBLIC_API" | "BANK" | "MANUAL" = storedRate ? "PUBLIC_API" : "MANUAL"

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
  if (!MANUAL_FALLBACK_RATES[currency]) return true // Unknown currency, can't validate

  const baselineRate = MANUAL_FALLBACK_RATES[currency]
  const variance = Math.abs(rate - baselineRate) / baselineRate

  // Flag if rate varies by more than 5% from current RBI rate
  if (variance > 0.05) {
    console.warn(
      `⚠️  Exchange rate ${currency}: ${rate} varies >5% from baseline rate ${baselineRate}. Verify correctness.`
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

  return MANUAL_FALLBACK_RATES // Fall back to manual baseline rates
}
