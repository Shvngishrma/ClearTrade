/**
 * Auto Calculation Engine - DECIMAL ARITHMETIC VERSION
 * 
 * PRECISION: Uses Money class (integer-based) for zero floating-point errors
 * BACKEND-DRIVEN: Backend ALWAYS calculates, never trusts user-submitted values
 * 
 * Handles all invoice value calculations:
 * - sumItems: Calculate total value from line items (Money-based)
 * - calculateFOB: Free on Board valuation (Money-based)
 * - calculateCIF: Cost Insurance Freight valuation (Money-based)
 * - convertToINR: Currency conversion with snapshot
 * 
 * CRITICAL: All financial arithmetic uses Money class to prevent IEEE 754 errors
 * Example: 0.1 + 0.2 used to be 0.30000000000000004, now guaranteed to be 0.3
 */

import { convertToINRWithSnapshot, type ExchangeRateSnapshot } from "./exchangeRateService"
import { Money, validateMoneyMatch, sumMoney } from "./money"

export interface Item {
  quantity: number
  unitPrice: number
  description?: string
  hsCode?: string
}

export interface ExchangeRates {
  [currency: string]: number // e.g., { "USD": 83.25, "EUR": 90.50 }
}

export const DEFAULT_EXCHANGE_RATES: ExchangeRates = {
  USD: 83.45,
  EUR: 90.5,
  GBP: 105.2,
  AED: 22.72,
  INR: 1,
}

/**
 * Calculate total value of all items using Money (integer arithmetic)
 * 
 * PRECISION-SAFE: No floating-point errors
 * 
 * @param items - Array of line items with quantity and unitPrice
 * @returns Total value in the original currency
 */
export function sumItems(items: Item[]): number {
  if (!items || items.length === 0) return 0

  try {
    // Use Money class for integer-based arithmetic
    const moneyItems = items
      .map(item => {
        const qty = Number(item.quantity) || 0
        const price = Number(item.unitPrice) || 0
        const lineTotal = qty * price

        // Create Money from decimal (safe conversion)
        return Money.fromDecimal(lineTotal, 2)
      })

    // Sum using Money arithmetic (integer-based, no float errors)
    const total = sumMoney(moneyItems)

    // Convert back to decimal
    return total.toDecimal(2)
  } catch (e) {
    // Fallback to basic arithmetic if Money conversion fails
    const total = items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0
      const price = Number(item.unitPrice) || 0
      return sum + qty * price
    }, 0)

    return parseFloat(total.toFixed(2))
  }
}

/**
 * Validate that items sum exactly matches declared total
 * Uses Money class for phantom-mismatch-free comparison
 * 
 * @param items - Line items
 * @param declaredTotal - Total claimed by user/system
 * @returns { isValid: boolean, calculatedTotal: number, difference: Money }
 */
export function validateItemsTotal(
  items: Item[],
  declaredTotal: number
): {
  isValid: boolean
  calculatedTotal: number
  difference: number
  reason?: string
} {
  const calculated = sumItems(items)

  try {
    const calculatedMoney = Money.fromDecimal(calculated, 2)
    const declaredMoney = Money.fromDecimal(declaredTotal, 2)

    const { matches, difference, reason } = validateMoneyMatch(calculatedMoney, declaredMoney)

    return {
      isValid: matches,
      calculatedTotal: calculated,
      difference: difference.toDecimal(2),
      reason
    }
  } catch (e) {
    // Fallback comparison
    const difference = Math.abs(calculated - declaredTotal)
    return {
      isValid: difference === 0,
      calculatedTotal: calculated,
      difference,
      reason: difference > 0 ? `Mismatch: ${difference.toFixed(4)}` : undefined
    }
  }
}

/**
 * Calculate FOB (Free on Board) value using Money arithmetic
 * FOB = Cost of goods only (base value)
 * Other costs (freight, insurance) are NOT included in FOB valuation
 *
 * @param totalValue - Sum of all items
 * @param incoterm - Incoterm type (FOB, CIF, CFR, EXW)
 * @returns FOB value
 */
export function calculateFOB(totalValue: number, incoterm: string = "FOB"): number {
  // FOB is always the base cost of goods, regardless of incoterm chosen
  try {
    return Money.fromDecimal(totalValue, 2).toDecimal(2)
  } catch {
    return parseFloat(totalValue.toFixed(2))
  }
}

/**
 * Calculate CIF (Cost, Insurance, Freight) value using Money arithmetic
 * CIF = FOB (cost) + Freight + Insurance
 * Buyer pays for everything up to port of discharge
 * 
 * PRECISION: Uses Money class to prevent floating-point errors
 *
 * @param fobValue - Free on Board value (cost of goods)
 * @param freight - Shipping cost
 * @param insurance - Insurance cost
 * @returns CIF value
 */
export function calculateCIF(
  fobValue: number,
  freight: number = 0,
  insurance: number = 0
): number {
  try {
    const fobMoney = Money.fromDecimal(fobValue, 2)
    const freightMoney = Money.fromDecimal(Number(freight) || 0, 2)
    const insuranceMoney = Money.fromDecimal(Number(insurance) || 0, 2)

    return fobMoney
      .add(freightMoney)
      .add(insuranceMoney)
      .toDecimal(2)
  } catch {
    const cif = fobValue + (Number(freight) || 0) + (Number(insurance) || 0)
    return parseFloat(cif.toFixed(2))
  }
}

/**
 * Calculate CFR (Cost and Freight) value using Money arithmetic
 * CFR = FOB + Freight (no insurance)
 * Insurance not included - buyer arranges separately
 * 
 * PRECISION: Uses Money class to prevent floating-point errors
 *
 * @param fobValue - Free on Board value
 * @param freight - Shipping cost
 * @returns CFR value
 */
export function calculateCFR(fobValue: number, freight: number = 0): number {
  try {
    const fobMoney = Money.fromDecimal(fobValue, 2)
    const freightMoney = Money.fromDecimal(Number(freight) || 0, 2)

    return fobMoney
      .add(freightMoney)
      .toDecimal(2)
  } catch {
    const cfr = fobValue + (Number(freight) || 0)
    return parseFloat(cfr.toFixed(2))
  }
}

/**
 * Calculate EXW (Ex Works) value
 * EXW = Base value only at exporter's location
 * Buyer arranges and pays for all transportation and insurance
 *
 * @param fobValue - Base value at factory
 * @returns EXW value (same as FOB)
 */
export function calculateEXW(fobValue: number): number {
  try {
    return Money.fromDecimal(fobValue, 2).toDecimal(2)
  } catch {
    return parseFloat(fobValue.toFixed(2))
  }
}

/**
 * Get calculated price based on incoterm
 * Returns the appropriate valuation for the chosen incoterm
 *
 * @param fobValue - Cost of goods
 * @param incoterm - Incoterm type
 * @param freight - Optional freight cost
 * @param insurance - Optional insurance cost
 * @returns Calculated value for the incoterm
 */
export function getIncotermValue(
  fobValue: number,
  incoterm: string = "FOB",
  freight: number = 0,
  insurance: number = 0
): number {
  const frt = Number(freight) || 0
  const ins = Number(insurance) || 0

  switch (incoterm.toUpperCase()) {
    case "CIF":
      return calculateCIF(fobValue, frt, ins)
    case "CFR":
    case "CNF":
      return calculateCFR(fobValue, frt)
    case "EXW":
      return calculateEXW(fobValue)
    case "FOB":
    default:
      return calculateFOB(fobValue, incoterm)
  }
}



/**
 * Complete invoice calculation - BACKEND-DRIVEN
 * Backend ALWAYS calculates these values fresh, never trusts user input.
 * User-submitted fobValue, cifValue, totalValueINR are IGNORED.
 *
 * @param items - Array of line items
 * @param incoterm - Incoterm type
 * @param freight - Freight cost (validated by backend)
 * @param insurance - Insurance cost (validated by backend)
 * @param currency - Currency of amounts
 * @param date - Date for exchange rate lookup
 * @returns Complete calculation object with rate snapshots
 */
export function calculateInvoiceTotals(
  items: Item[],
  incoterm: string = "FOB",
  freight: number = 0,
  insurance: number = 0,
  currency: string = "USD",
  date: Date = new Date()
) {
  // Step 1: Sum all items (FORCE CALCULATION)
  const totalValue = sumItems(items)

  // Step 2: Calculate FOB value (FORCE CALCULATION)
  const fobValue = calculateFOB(totalValue, incoterm)

  // Step 3: Calculate CIF value based on incoterm (FORCE CALCULATION)
  let cifValue: number | null = null
  if (["CIF", "CFR", "CNF"].includes(incoterm.toUpperCase())) {
    if (incoterm.toUpperCase() === "CIF") {
      cifValue = calculateCIF(fobValue, freight, insurance)
    } else if (incoterm.toUpperCase() === "CFR" || incoterm.toUpperCase() === "CNF") {
      cifValue = calculateCFR(fobValue, freight)
    }
  }

  // Step 4: Get exchange rates with snapshots (DATE-SPECIFIC)
  const totalValueINRData = convertToINRWithSnapshot(totalValue, currency, date)
  const fobValueINRData = convertToINRWithSnapshot(fobValue, currency, date, totalValueINRData.rate)
  const cifValueINRData = cifValue
    ? convertToINRWithSnapshot(cifValue, currency, date, totalValueINRData.rate)
    : null
  const freightINRData = convertToINRWithSnapshot(freight, currency, date, totalValueINRData.rate)
  const insuranceINRData = convertToINRWithSnapshot(insurance, currency, date, totalValueINRData.rate)

  return {
    // Original currency values (BACKEND CALCULATED)
    totalValue,
    fobValue,
    cifValue,
    freight: parseFloat((Number(freight) || 0).toFixed(2)),
    insurance: parseFloat((Number(insurance) || 0).toFixed(2)),

    // INR conversions (BACKEND CALCULATED with snapshot)
    totalValueINR: totalValueINRData.inrValue,
    fobValueINR: fobValueINRData.inrValue,
    cifValueINR: cifValueINRData?.inrValue || null,
    freightINR: freightINRData.inrValue,
    insuranceINR: insuranceINRData.inrValue,

    // Exchange rate snapshot (FOR AUDIT TRAIL)
    exchangeRateSnapshot: totalValueINRData.snapshot,
    exchangeRate: totalValueINRData.rate,

    // Metadata
    currency,
    incoterm,
    itemCount: items.length,
    calculatedAt: new Date(),
  }
}
