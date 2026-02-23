/**
 * LC TERM FUZZY MATCHING SERVICE
 * ==============================
 * 
 * Elite-level LC term validation:
 * - Fuzzy string matching (normalizes case, punctuation, whitespace)
 * - Tolerance clause parsing (±5%, part shipment rules)
 * - Description aliasing (e.g., "Cotton T-Shirts" ≈ "cotton t shirts")
 * - Specification tolerance enforcement
 */

export interface LCTermFuzzyMatch {
  invoiceTerm: string
  lcTerm: string
  normalizedInvoice: string
  normalizedLC: string
  matchScore: number // 0-100
  matches: boolean  // true if > 85%
  differences?: string[]
  toleranceApplied?: string
}

export interface ToleranceClause {
  percentageVariance?: number  // ±5%
  quantityVariance?: number    // ±100 units
  partShipmentsAllowed: boolean
  transhipmentAllowed: boolean
  additionalConditions?: string[]
}

// ============================================
// NORMALIZATION FUNCTIONS
// ============================================

/**
 * Normalize string for comparison
 * Removes punctuation, normalizes spaces, lowercases
 */
export function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s%]/g, '') // Remove special chars except %
    .replace(/\s+/g, ' ')          // Normalize multiple spaces
    .trim()
}

/**
 * Calculate Levenshtein distance between two strings
 * (measures how different two strings are)
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[str2.length][str1.length]
}

/**
 * Calculate similarity score (0-100)
 */
export function calculateSimilarityScore(str1: string, str2: string): number {
  const norm1 = normalizeForComparison(str1)
  const norm2 = normalizeForComparison(str2)

  const maxLength = Math.max(norm1.length, norm2.length)
  if (maxLength === 0) return 100

  const distance = levenshteinDistance(norm1, norm2)
  const similarity = ((maxLength - distance) / maxLength) * 100

  return Math.round(similarity)
}

// ============================================
// TOLERANCE PARSING
// ============================================

/**
 * Extract tolerance clause from LC text
 */
export function parseToleranceClause(lcTermText: string): ToleranceClause {
  const clause: ToleranceClause = {
    partShipmentsAllowed: false,
    transhipmentAllowed: false,
    additionalConditions: []
  }

  // Check for percentage variance: ±5%, +/- 5%, etc.
  const percentMatch = lcTermText.match(/([+−\-±])\s*(\d+)\s*%|(\d+)\s*%\s*variance|tolerance.*?(\d+)\s*%/i)
  if (percentMatch) {
    clause.percentageVariance = parseInt(percentMatch[2] || percentMatch[4])
  }

  // Check for quantity variance: ±100 units, +/- 50 pcs, etc.
  const qtyMatch = lcTermText.match(/([+−\-±])\s*(\d+)\s*(units?|pcs?|pieces?|bags?|boxes?)/i)
  if (qtyMatch) {
    clause.quantityVariance = parseInt(qtyMatch[2])
  }

  // Check for part shipments
  if (/part\s+shipment|partial\s+shipment|installment/i.test(lcTermText)) {
    clause.partShipmentsAllowed = /(?:allowed|permitted|acceptable)/i.test(lcTermText)
  }

  // Check for transhipment
  if (/tranship|trans\s*ship/i.test(lcTermText)) {
    clause.transhipmentAllowed = /(?:allowed|permitted|acceptable)/i.test(lcTermText)
  }

  // Extract additional conditions
  const conditionMatches = lcTermText.match(/(?:condition|requirement|clause):\s*([^.!?]+)/gi)
  if (conditionMatches) {
    clause.additionalConditions = conditionMatches.map(c => c.replace(/^.*?:\s*/, ''))
  }

  return clause
}

// ============================================
// MASTER FUZZY MATCHING
// ============================================

export interface LCTermValidationResult {
  isCompliant: boolean
  matchScore: number
  matches: Array<{
    field: string
    invoiceValue: string
    lcValue: string
    score: number
    compliant: boolean
    reasoning?: string
  }>
  toleranceApplied: boolean
  tolerance?: ToleranceClause
  issues: Array<{
    severity: "Error" | "Warning"
    field: string
    message: string
    resolution?: string
  }>
}

/**
 * Master fuzzy matching for LC terms
 */
export function validateLCTermsWithFuzzyMatching(
  invoice: {
    description: string
    quantity: number
    unitPrice: number
    currency: string
    shippingTerms?: string
    deliveryPort?: string
  },
  lcTerms: {
    description: string
    quantity: number
    unitPrice: number
    currency: string
    lcTermText: string
    shippingTerms?: string
    deliveryPort?: string
  }
): LCTermValidationResult {
  const issues: LCTermValidationResult["issues"] = []
  const matches: LCTermValidationResult["matches"] = []

  const tolerance = parseToleranceClause(lcTerms.lcTermText)
  let totalScore = 0
  let matchCount = 0

  // MATCH 1: Description
  const descScore = calculateSimilarityScore(invoice.description, lcTerms.description)
  matches.push({
    field: "description",
    invoiceValue: invoice.description.substring(0, 50),
    lcValue: lcTerms.description.substring(0, 50),
    score: descScore,
    compliant: descScore >= 85,
    reasoning: descScore < 85 ? "Wording differs significantly" : "Close match"
  })
  totalScore += descScore
  matchCount++

  if (descScore < 85) {
    issues.push({
      severity: "Warning",
      field: "description",
      message: `Item description mismatch: Invoice="${invoice.description}", LC="${lcTerms.description}" (${descScore}% similar)`,
      resolution: "Item description should closely match LC description"
    })
  }

  // MATCH 2: Quantity (with tolerance)
  let qtyCompliant = invoice.quantity === lcTerms.quantity
  let qtyReasoning = "Exact match"

  if (!qtyCompliant && tolerance.quantityVariance) {
    const variance = Math.abs(invoice.quantity - lcTerms.quantity)
    qtyCompliant = variance <= tolerance.quantityVariance
    qtyReasoning = qtyCompliant 
      ? `Within tolerance: ±${tolerance.quantityVariance} units`
      : `Exceeds tolerance: ${variance} > ±${tolerance.quantityVariance}`
  }

  if (!qtyCompliant && tolerance.percentageVariance) {
    const variance = Math.abs(invoice.quantity - lcTerms.quantity) / lcTerms.quantity * 100
    qtyCompliant = variance <= tolerance.percentageVariance
    qtyReasoning = qtyCompliant
      ? `Within tolerance: ±${tolerance.percentageVariance}%`
      : `Exceeds tolerance: ${variance.toFixed(1)}% > ±${tolerance.percentageVariance}%`
  }

  matches.push({
    field: "quantity",
    invoiceValue: invoice.quantity.toString(),
    lcValue: lcTerms.quantity.toString(),
    score: qtyCompliant ? 100 : 0,
    compliant: qtyCompliant,
    reasoning: qtyReasoning
  })
  totalScore += qtyCompliant ? 100 : 0
  matchCount++

  if (!qtyCompliant) {
    issues.push({
      severity: "Error",
      field: "quantity",
      message: `Quantity exceeds LC: Invoice=${invoice.quantity}, LC=${lcTerms.quantity} ${qtyReasoning}`,
      resolution: "Quantity must not exceed LC approved quantity"
    })
  }

  // MATCH 3: Unit Price (with tolerance)
  let priceCompliant = invoice.unitPrice === lcTerms.unitPrice
  let priceReasoning = "Exact match"

  if (!priceCompliant && tolerance.percentageVariance) {
    const variance = Math.abs(invoice.unitPrice - lcTerms.unitPrice) / lcTerms.unitPrice * 100
    priceCompliant = variance <= tolerance.percentageVariance
    priceReasoning = priceCompliant
      ? `Within tolerance: ±${tolerance.percentageVariance}%`
      : `Exceeds tolerance: ${variance.toFixed(1)}% > ±${tolerance.percentageVariance}%`
  }

  matches.push({
    field: "unitPrice",
    invoiceValue: invoice.unitPrice.toString(),
    lcValue: lcTerms.unitPrice.toString(),
    score: priceCompliant ? 100 : 0,
    compliant: priceCompliant,
    reasoning: priceReasoning
  })
  totalScore += priceCompliant ? 100 : 0
  matchCount++

  if (!priceCompliant) {
    issues.push({
      severity: "Error",
      field: "unitPrice",
      message: `Unit price exceeds LC: Invoice=${invoice.unitPrice}, LC=${lcTerms.unitPrice} ${priceReasoning}`,
      resolution: "Unit price must not exceed LC approved rate"
    })
  }

  // MATCH 4: Currency
  const currencyCompliant = invoice.currency === lcTerms.currency
  matches.push({
    field: "currency",
    invoiceValue: invoice.currency,
    lcValue: lcTerms.currency,
    score: currencyCompliant ? 100 : 0,
    compliant: currencyCompliant
  })
  totalScore += currencyCompliant ? 100 : 0
  matchCount++

  if (!currencyCompliant) {
    issues.push({
      severity: "Error",
      field: "currency",
      message: `Currency mismatch: Invoice=${invoice.currency}, LC=${lcTerms.currency}`,
      resolution: "Currency must match LC currency exactly"
    })
  }

  // MATCH 5: Shipping Terms
  if (invoice.shippingTerms && lcTerms.shippingTerms) {
    const shipScore = calculateSimilarityScore(invoice.shippingTerms, lcTerms.shippingTerms)
    matches.push({
      field: "shippingTerms",
      invoiceValue: invoice.shippingTerms,
      lcValue: lcTerms.shippingTerms,
      score: shipScore,
      compliant: shipScore >= 90
    })
    totalScore += shipScore
    matchCount++

    if (shipScore < 90) {
      issues.push({
        severity: "Warning",
        field: "shippingTerms",
        message: `Shipping terms differ: Invoice="${invoice.shippingTerms}", LC="${lcTerms.shippingTerms}" (${shipScore}% similar)`,
        resolution: "Shipping terms should match LC specifications"
      })
    }
  }

  const overallScore = Math.round(totalScore / matchCount)
  const isCompliant = issues.filter(i => i.severity === "Error").length === 0

  return {
    isCompliant,
    matchScore: overallScore,
    matches,
    toleranceApplied: tolerance.percentageVariance !== undefined || tolerance.quantityVariance !== undefined,
    tolerance,
    issues
  }
}

/**
 * Generate LC discrepancy report for bank submission
 */
export function generateLCDiscrepancyReport(
  invoiceNumber: string,
  lcNumber: string,
  validation: LCTermValidationResult
): string {
  const lines: string[] = [
    "═".repeat(80),
    "LC TERM FUZZY MATCH VALIDATION REPORT",
    "═".repeat(80),
    `Invoice: ${invoiceNumber}`,
    `LC Number: ${lcNumber}`,
    `Overall Match Score: ${validation.matchScore}%`,
    `Status: ${validation.isCompliant ? "✅ COMPLIANT" : "❌ NON-COMPLIANT"}`,
    "",
    "DETAILED MATCHES:",
  ]

  validation.matches.forEach(match => {
    lines.push(
      `  ${match.compliant ? "✅" : "⚠️"} ${match.field.toUpperCase()}: ${match.score}%`,
      `    Invoice: ${match.invoiceValue}`,
      `    LC Term: ${match.lcValue}`,
      match.reasoning ? `    Note: ${match.reasoning}` : ""
    )
  })

  lines.push("")

  if (validation.toleranceApplied) {
    lines.push("TOLERANCE CLAUSES APPLIED:")
    if (validation.tolerance?.percentageVariance) {
      lines.push(`  • Percentage Variance: ±${validation.tolerance.percentageVariance}%`)
    }
    if (validation.tolerance?.quantityVariance) {
      lines.push(`  • Quantity Variance: ±${validation.tolerance.quantityVariance} units`)
    }
    if (validation.tolerance?.partShipmentsAllowed) {
      lines.push(`  • Part Shipments: Allowed`)
    }
    lines.push("")
  }

  if (validation.issues.length > 0) {
    lines.push("ISSUES FOUND:")
    validation.issues.forEach(issue => {
      lines.push(`  [${issue.severity}] ${issue.field}: ${issue.message}`)
      if (issue.resolution) {
        lines.push(`    → ${issue.resolution}`)
      }
    })
    lines.push("")
  }

  lines.push("═".repeat(80))

  return lines.join("\n")
}

/**
 * Check if invoice can be negotiated under LC
 */
export function canInvoiceNegotiateUnderLC(
  validation: LCTermValidationResult
): {
  acceptable: boolean
  bankAction: "Negotiate" | "Reject" | "Query_Extension"
  reasoning: string
} {
  const errors = validation.issues.filter(i => i.severity === "Error")

  if (errors.length === 0) {
    return {
      acceptable: true,
      bankAction: "Negotiate",
      reasoning: `All LC terms match (${validation.matchScore}% overall similarity)`
    }
  }

  const criticalErrors = errors.filter(i => 
    ["quantity", "currency", "unitPrice"].includes(i.field)
  )

  if (criticalErrors.length > 0) {
    return {
      acceptable: false,
      bankAction: "Reject",
      reasoning: `Critical field mismatch: ${criticalErrors.map(e => e.field).join(", ")}`
    }
  }

  // Minor errors (description, terms) → Query extension for amendment
  return {
    acceptable: false,
    bankAction: "Query_Extension",
    reasoning: `Minor discrepancies found. Bank may request LC amendment: ${errors.map(e => e.field).join(", ")}`
  }
}
