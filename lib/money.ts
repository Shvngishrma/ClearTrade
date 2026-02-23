/**
 * Decimal Arithmetic for Financial Calculations
 * 
 * PROBLEM:
 * JavaScript floats violate financial math:
 *   0.1 + 0.2 === 0.3     // FALSE!
 *   0.1 + 0.2 === 0.30000000000000004  // TRUE
 * 
 * SOLUTION:
 * Operate on integers (paise/cents) instead of floats.
 * Store as: {major: 1, minor: 50} = ₹1.50 or $1.50
 * 
 * Then:
 * - All arithmetic is integer-based (no float errors)
 * - Database stores Decimal type (Prisma)
 * - Comparisons are exact (no phantom mismatches)
 * 
 * USAGE:
 * const a = Money.fromDecimal(0.1, 2)
 * const b = Money.fromDecimal(0.2, 2)
 * const c = a.add(b)
 * c.toDecimal(2) === 0.3  // TRUE
 */

/**
 * Money represents a decimal amount as integer major + integer minor
 * Example: $12.34 = {major: 12, minor: 34}
 * This avoids all floating-point errors
 */
export class Money {
  readonly major: number // Whole units (dollars, rupees)
  readonly minor: number // Fractional units (cents, paise) 0-99
  readonly scale: number // Decimal places (2 for USD/INR, 3 for some currencies)

  constructor(major: number, minor: number, scale: number = 2) {
    if (!Number.isInteger(major) || !Number.isInteger(minor)) {
      throw new Error(`Money values must be integers: ${major}.${minor}`)
    }
    if (minor < 0 || minor >= Math.pow(10, scale)) {
      throw new Error(`Minor must be 0-${Math.pow(10, scale) - 1}, got ${minor}`)
    }
    this.major = major
    this.minor = minor
    this.scale = scale
  }

  /**
   * Create from decimal number
   * fromDecimal(12.34, 2) → Money(major=12, minor=34)
   * 
   * @param value Decimal value (0.1 + 0.2 patterns removed)
   * @param scale Decimal places
   */
  static fromDecimal(value: number, scale: number = 2): Money {
    // Convert via string to avoid float precision loss
    const str = value.toFixed(scale)
    const parts = str.split(".")
    const major = parseInt(parts[0], 10)
    const minor = parts[1] ? parseInt(parts[1], 10) : 0
    return new Money(major, minor, scale)
  }

  /**
   * Create from integer cents/paise
   * fromCents(1234, 2) → Money(major=12, minor=34)
   */
  static fromCents(cents: number, scale: number = 2): Money {
    const divisor = Math.pow(10, scale)
    const major = Math.floor(cents / divisor)
    const minor = cents % divisor
    return new Money(major, minor, scale)
  }

  /**
   * Create from string
   * fromString("12.34", 2) → Money(major=12, minor=34)
   */
  static fromString(str: string, scale: number = 2): Money {
    const parts = str.split(".")
    const major = parseInt(parts[0], 10)
    const minor = parts[1] ? parseInt(parts[1], 10) : 0
    return new Money(major, minor, scale)
  }

  /**
   * Convert back to decimal
   * toDecimal(2) → 12.34
   */
  toDecimal(scale?: number): number {
    const s = scale ?? this.scale
    const divisor = Math.pow(10, s)
    return (this.major * divisor + this.minor) / divisor
  }

  /**
   * Convert to total cents/paise
   * toCents(2) → 1234
   */
  toCents(scale?: number): number {
    const s = scale ?? this.scale
    return this.major * Math.pow(10, s) + this.minor
  }

  /**
   * Convert to string
   * toString() → "12.34"
   */
  toString(): string {
    return `${this.major}.${String(this.minor).padStart(this.scale, "0")}`
  }

  /**
   * Add two Money values
   */
  add(other: Money): Money {
    if (this.scale !== other.scale) {
      throw new Error(`Cannot add money with different scales: ${this.scale} vs ${other.scale}`)
    }
    const totalMinor = this.minor + other.minor
    const carryover = Math.floor(totalMinor / Math.pow(10, this.scale))
    const finalMinor = totalMinor % Math.pow(10, this.scale)
    const finalMajor = this.major + other.major + carryover

    return new Money(finalMajor, finalMinor, this.scale)
  }

  /**
   * Subtract two Money values
   */
  subtract(other: Money): Money {
    if (this.scale !== other.scale) {
      throw new Error(`Cannot subtract money with different scales: ${this.scale} vs ${other.scale}`)
    }
    const totalCents = this.toCents() - other.toCents()
    return Money.fromCents(totalCents, this.scale)
  }

  /**
   * Multiply by a factor (e.g., quantity)
   */
  multiply(factor: number): Money {
    if (!Number.isInteger(factor)) {
      throw new Error(`Multiply factor must be integer, got ${factor}`)
    }
    const totalCents = this.toCents() * factor
    return Money.fromCents(totalCents, this.scale)
  }

  /**
   * Divide by a factor
   * Note: May lose precision if not evenly divisible
   */
  divide(factor: number): Money {
    if (!Number.isInteger(factor)) {
      throw new Error(`Divide factor must be integer, got ${factor}`)
    }
    const totalCents = Math.round(this.toCents() / factor)
    return Money.fromCents(totalCents, this.scale)
  }

  /**
   * Compare: equals
   */
  equals(other: Money): boolean {
    return this.major === other.major && this.minor === other.minor && this.scale === other.scale
  }

  /**
   * Compare: less than
   */
  lessThan(other: Money): boolean {
    if (this.scale !== other.scale) {
      throw new Error(`Cannot compare money with different scales`)
    }
    return this.toCents() < other.toCents()
  }

  /**
   * Compare: less than or equal
   */
  lessThanOrEqual(other: Money): boolean {
    return this.lessThan(other) || this.equals(other)
  }

  /**
   * Compare: greater than
   */
  greaterThan(other: Money): boolean {
    if (this.scale !== other.scale) {
      throw new Error(`Cannot compare money with different scales`)
    }
    return this.toCents() > other.toCents()
  }

  /**
   * Compare: greater than or equal
   */
  greaterThanOrEqual(other: Money): boolean {
    return this.greaterThan(other) || this.equals(other)
  }

  /**
   * Get absolute value
   */
  abs(): Money {
    if (this.major < 0) {
      return new Money(-this.major, this.minor, this.scale)
    }
    return this
  }

  /**
   * Get difference (absolute)
   */
  difference(other: Money): Money {
    if (this.scale !== other.scale) {
      throw new Error(`Cannot get difference of money with different scales`)
    }
    const diff = Math.abs(this.toCents() - other.toCents())
    return Money.fromCents(diff, this.scale)
  }

  /**
   * Format for display
   */
  format(currency: string = "$"): string {
    const sign = this.major < 0 ? "-" : ""
    return `${sign}${currency}${Math.abs(this.major)}.${String(Math.abs(this.minor)).padStart(this.scale, "0")}`
  }
}

/**
 * Sum a list of Money values
 */
export function sumMoney(values: Money[]): Money {
  if (values.length === 0) {
    return new Money(0, 0, 2)
  }

  const scale = values[0].scale
  let total = values[0]

  for (let i = 1; i < values.length; i++) {
    total = total.add(values[i])
  }

  return total
}

/**
 * Average a list of Money values (rounded)
 */
export function averageMoney(values: Money[]): Money {
  if (values.length === 0) {
    throw new Error("Cannot average empty list")
  }
  const total = sumMoney(values)
  return total.divide(values.length)
}

/**
 * Validate exact match for invoice totals
 * 
 * STRICT: Detects real mismatches while ignoring legitimate rounding
 * 
 * Returns: { matches: boolean, difference: Money, reason?: string }
 */
export function validateMoneyMatch(
  calculated: Money,
  declared: Money,
  currency: string = "USD"
): {
  matches: boolean
  difference: Money
  reason?: string
} {
  if (calculated.scale !== declared.scale) {
    return {
      matches: false,
      difference: new Money(0, 0),
      reason: `Scale mismatch: calculated scale ${calculated.scale} vs declared ${declared.scale}`
    }
  }

  const diff = calculated.difference(declared)

  // If difference is 0, exact match
  if (diff.equals(new Money(0, 0, calculated.scale))) {
    return {
      matches: true,
      difference: diff
    }
  }

  // If difference > 1 cent/paisa, it's a real mismatch (not floating-point error)
  if (diff.toCents() > 1) {
    return {
      matches: false,
      difference: diff,
      reason: `Real mismatch: calculated ${calculated.toString()} ${currency} vs declared ${declared.toString()} ${currency}`
    }
  }

  // If difference is exactly 1 cent/paisa, could be legitimate rounding in very rare cases
  // But still flag as mismatch for strictness
  if (diff.toCents() === 1) {
    return {
      matches: false,
      difference: diff,
      reason: `1-unit rounding error: calculated ${calculated.toString()} vs declared ${declared.toString()}`
    }
  }

  return {
    matches: true,
    difference: diff
  }
}

/**
 * Exchange rate calculation with Money precision
 * 
 * Uses integer arithmetic to avoid float errors
 * Example: 100 USD × 83.45 (INR per USD) = 8345 INR
 */
export function convertMoney(
  amount: Money,
  rateNumerator: number,
  rateDenominator: number = 1,
  resultScale: number = 2
): Money {
  if (!Number.isInteger(rateNumerator) || !Number.isInteger(rateDenominator)) {
    throw new Error("Rate must be specified as integer fraction")
  }

  const totalCents = amount.toCents() * rateNumerator
  const resultCents = Math.round(totalCents / rateDenominator)

  return Money.fromCents(resultCents, resultScale)
}

// Export type aliases for convenience
export type MoneyValue = Money
