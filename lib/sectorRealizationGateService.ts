/**
 * SECTOR-SPECIFIC REALIZATION CLAUSE + PRE-SHIPMENT GATE SERVICE
 * =============================================================
 * 
 * Dynamic RBI realization enforcement:
 * - Sector-specific timelines (IT sector ≠ commodity sector)
 * - Advance vs date-based realization rules per sector
 * - Pre-shipment advance negative list enforcement
 * - Payment term blocking gates
 * - RBI Master Direction compliance links
 * 
 * CRITICAL: Prevents "system allowed DA 270 days but IT sector only 180" rejections
 */

import { prisma } from "@/lib/db"

export type SectorType = "IT" | "Pharma" | "Gems_Jewelry" | "Textiles" | "Commodities" | "Engineering" | "Chemicals" | "Unknown"

export interface SectorRealizationPolicy {
  sector: SectorType
  maxDATenor: number        // Days for DA (Documents Against Payment)
  maxAdvanceRealization: number // Max advance realization days (pre-shipment)
  allowablePaymentTerms: string[]  // e.g., "DA30", "DA60", "LC", "Advance"
  preShipmentAdvanceAllowed: boolean
  maxPreShipmentDaysBeforeShipment: number  // Negative
  advanceAgainstAdvices: boolean
  blockingIfNegativeList: boolean
  rbIMasterDirection: string  // Reference to RBI circular
}

export interface NegativeListItem {
  hs: string
  commodity: string
  sector: SectorType
  status: "Banned" | "Restricted" | "RequiresApproval"
  advanceNotAllowed: boolean
}

export interface PaymentTermValidation {
  term: string  // "DA30", "DA60", "LC", "Advance", "CAD" etc.
  sector: SectorType
  isAllowed: boolean
  maxDays?: number
  requiresApproval?: boolean
  issues: Array<{
    severity: "Error" | "Warning"
    message: string
    rbIMasterDirectionRef?: string
  }>
}

export interface PreShipmentAdvanceValidation {
  advancePercentage: number  // % of contract value
  shipmentDaysRemaining: number  // Days until shipment date
  sector: SectorType
  allowed: boolean
  remainingBuffer: number  // Days before shipment when advance can no longer be taken
  issues: Array<{
    severity: "Error" | "Warning"
    message: string
  }>
}

// ============================================
// SECTOR REALIZATION POLICY MASTER
// ============================================

const SECTOR_POLICIES: Record<SectorType, SectorRealizationPolicy> = {
  "IT": {
    sector: "IT",
    maxDATenor: 180,  // IT services: 180 days max
    maxAdvanceRealization: 50,  // Max 50% advance
    allowablePaymentTerms: ["DA30", "DA60", "DA90", "DA180", "LC", "Advance"],
    preShipmentAdvanceAllowed: true,
    maxPreShipmentDaysBeforeShipment: -90,  // 90 days before shipment
    advanceAgainstAdvices: true,
    blockingIfNegativeList: true,
    rbIMasterDirection: "RBI/DPSS/2023-24/02 (Master Direction on FEMA Payment Terms)"
  },
  "Pharma": {
    sector: "Pharma",
    maxDATenor: 120,
    maxAdvanceRealization: 25,
    allowablePaymentTerms: ["DA30", "DA60", "DA90", "DA120", "LC"],
    preShipmentAdvanceAllowed: false,  // Pharma: NO advance allowed
    maxPreShipmentDaysBeforeShipment: 0,
    advanceAgainstAdvices: false,
    blockingIfNegativeList: true,
    rbIMasterDirection: "RBI/FED/2023-24/01"
  },
  "Gems_Jewelry": {
    sector: "Gems_Jewelry",
    maxDATenor: 90,
    maxAdvanceRealization: 100,  // Gems can take 100% advance
    allowablePaymentTerms: ["Advance", "LC", "DA30", "DA60", "DA90"],
    preShipmentAdvanceAllowed: true,
    maxPreShipmentDaysBeforeShipment: -30,
    advanceAgainstAdvices: true,
    blockingIfNegativeList: false,
    rbIMasterDirection: "RBI/FED/Gems and Jewelry Policy"
  },
  "Textiles": {
    sector: "Textiles",
    maxDATenor: 120,
    maxAdvanceRealization: 50,
    allowablePaymentTerms: ["DA30", "DA60", "DA90", "DA120", "LC", "Advance"],
    preShipmentAdvanceAllowed: true,
    maxPreShipmentDaysBeforeShipment: -60,
    advanceAgainstAdvices: true,
    blockingIfNegativeList: true,
    rbIMasterDirection: "RBI/DPSS Notification"
  },
  "Commodities": {
    sector: "Commodities",
    maxDATenor: 270,  // Commodities: longest timeline (270 days)
    maxAdvanceRealization: 10,  // Very limited advance allowed
    allowablePaymentTerms: ["DA30", "DA60", "DA90", "DA180", "DA270", "LC"],
    preShipmentAdvanceAllowed: false,  // NO advance for commodities
    maxPreShipmentDaysBeforeShipment: 0,
    advanceAgainstAdvices: false,
    blockingIfNegativeList: true,
    rbIMasterDirection: "RBI Notification on Commodity Trade"
  },
  "Engineering": {
    sector: "Engineering",
    maxDATenor: 180,
    maxAdvanceRealization: 30,
    allowablePaymentTerms: ["DA30", "DA60", "DA90", "DA120", "DA180", "LC", "Advance"],
    preShipmentAdvanceAllowed: true,
    maxPreShipmentDaysBeforeShipment: -45,
    advanceAgainstAdvices: true,
    blockingIfNegativeList: true,
    rbIMasterDirection: "RBI/DPSS/Master Direction"
  },
  "Chemicals": {
    sector: "Chemicals",
    maxDATenor: 150,
    maxAdvanceRealization: 40,
    allowablePaymentTerms: ["DA30", "DA60", "DA90", "DA120", "DA150", "LC"],
    preShipmentAdvanceAllowed: true,
    maxPreShipmentDaysBeforeShipment: -75,
    advanceAgainstAdvices: false,
    blockingIfNegativeList: true,
    rbIMasterDirection: "RBI/FED/Notification"
  },
  "Unknown": {
    sector: "Unknown",
    maxDATenor: 180,  // Default fallback
    maxAdvanceRealization: 50,
    allowablePaymentTerms: ["DA30", "DA60", "DA90", "DA180", "LC"],
    preShipmentAdvanceAllowed: true,
    maxPreShipmentDaysBeforeShipment: -90,
    advanceAgainstAdvices: false,
    blockingIfNegativeList: true,
    rbIMasterDirection: "RBI/DPSS/Default Notification"
  }
}

// ============================================
// NEGATIVE LIST (Commodities where advance not allowed)
// ============================================

const ADVANCE_NEGATIVE_LIST: NegativeListItem[] = [
  { hs: "1001", commodity: "Wheat", sector: "Commodities", status: "Restricted", advanceNotAllowed: true },
  { hs: "1005", commodity: "Maize", sector: "Commodities", status: "Restricted", advanceNotAllowed: true },
  { hs: "2701", commodity: "Coal", sector: "Commodities", status: "Restricted", advanceNotAllowed: true },
  { hs: "2709", commodity: "Crude Petroleum", sector: "Commodities", status: "Restricted", advanceNotAllowed: true },
  { hs: "2711", commodity: "Natural Gas", sector: "Commodities", status: "Banned", advanceNotAllowed: true },
  { hs: "0302", commodity: "Fish", sector: "Commodities", status: "RequiresApproval", advanceNotAllowed: true },
]

// ============================================
// SECTOR DETECTION
// ============================================

/**
 * Auto-detect sector from HS codes and description
 */
export function detectSector(
  commodity: string,
  hsCode: string
): SectorType {
  const commodityLower = commodity.toLowerCase()
  const hsNum = parseInt(hsCode)

  // IT/Software services: Chapter 49 (books, software, etc.) + services
  if (hsNum >= 4900 && hsNum < 5000) return "IT"
  if (commodityLower.includes("software") || commodityLower.includes("service") || commodityLower.includes("it")) return "IT"

  // Pharma: Chapters 29-30 (chemicals, pharma products)
  if (hsNum >= 2900 && hsNum < 3100) return "Pharma"
  if (commodityLower.includes("medicine") || commodityLower.includes("pharma") || commodityLower.includes("drug")) return "Pharma"

  // Gems & Jewelry: Chapter 71
  if (hsNum >= 7100 && hsNum < 7200) return "Gems_Jewelry"
  if (commodityLower.includes("diamond") || commodityLower.includes("jewel") || commodityLower.includes("gem")) return "Gems_Jewelry"

  // Textiles: Chapters 50-63
  if (hsNum >= 5000 && hsNum < 6400) return "Textiles"
  if (commodityLower.includes("cotton") || commodityLower.includes("fabric") || commodityLower.includes("textile")) return "Textiles"

  // Engineering: Chapters 84-90 mostly
  if (hsNum >= 8400 && hsNum < 9100) return "Engineering"
  if (commodityLower.includes("engine") || commodityLower.includes("machinery") || commodityLower.includes("equipment")) return "Engineering"

  // Chemicals: Chapters 28-29 (except pharma)
  if (hsNum >= 2800 && hsNum < 2900) return "Chemicals"
  if (commodityLower.includes("chemical") || commodityLower.includes("dye") || commodityLower.includes("pigment")) return "Chemicals"

  // Commodities: Everything else (1000-2800 mostly)
  if (hsNum < 5000) return "Commodities"

  return "Unknown"
}

// ============================================
// PAYMENT TERM VALIDATION
// ============================================

/**
 * Validate payment term against sector policy
 */
export function validatePaymentTerm(
  term: string,
  sector: SectorType
): PaymentTermValidation {
  const policy = SECTOR_POLICIES[sector] || SECTOR_POLICIES["Unknown"]
  const issues: PaymentTermValidation["issues"] = []

  // Parse term (e.g., "DA60" → 60 days)
  const match = term.match(/DA(\d+)|LC|Advance|CAD/)
  let termType = "Unknown"
  let days = 0

  if (match) {
    if (match[1]) {
      termType = "DA"
      days = parseInt(match[1])
    } else if (match[0] === "LC") {
      termType = "LC"
      days = 0  // LC has embedded terms
    } else if (match[0] === "Advance") {
      termType = "Advance"
      days = -999  // Pre-shipment
    }
  }

  // Check if term is allowed for sector
  const isAllowed = policy.allowablePaymentTerms.includes(term)

  if (!isAllowed) {
    issues.push({
      severity: "Error",
      message: `Payment term "${term}" is NOT allowed for ${sector} sector. Allowed terms: ${policy.allowablePaymentTerms.join(", ")}`,
      rbIMasterDirectionRef: policy.rbIMasterDirection
    })
  }

  // Check DA tenure limit
  if (termType === "DA" && days > policy.maxDATenor) {
    issues.push({
      severity: "Error",
      message: `DA tenure ${days} days exceeds ${sector} sector maximum of ${policy.maxDATenor} days`,
      rbIMasterDirectionRef: policy.rbIMasterDirection
    })
  }

  // Check advance terms
  if (termType === "Advance" && !policy.preShipmentAdvanceAllowed) {
    issues.push({
      severity: "Error",
      message: `Pre-shipment advance is NOT allowed for ${sector} sector per RBI policy`,
      rbIMasterDirectionRef: policy.rbIMasterDirection
    })
  }

  return {
    term,
    sector,
    isAllowed: isAllowed && issues.filter(i => i.severity === "Error").length === 0,
    maxDays: termType === "DA" ? days : undefined,
    issues
  }
}

// ============================================
// NEGATIVE LIST CHECK
// ============================================

/**
 * Check if commodity is on advance-negative list
 */
export function checkNegativeList(
  hsCode: string
): NegativeListItem | null {
  return ADVANCE_NEGATIVE_LIST.find(item => item.hs === hsCode) || null
}

/**
 * Validate against negative list
 */
export function validateNegativeList(
  hsCode: string,
  paymentTerm: string,
  sector: SectorType
): {
  onNegativeList: boolean
  canAccept: boolean
  issues: Array<{
    severity: "Error" | "Warning"
    message: string
    resolution?: string
  }>
} {
  const issues: Array<{ severity: "Error" | "Warning"; message: string; resolution?: string }> = []

  const negativeItem = checkNegativeList(hsCode)

  if (!negativeItem) {
    return {
      onNegativeList: false,
      canAccept: true,
      issues: []
    }
  }

  // On negative list
  issues.push({
    severity: "Warning",
    message: `⚠️ HS ${hsCode} (${negativeItem.commodity}) is on RBI advance-negative list`,
    resolution: `Only ${negativeItem.status === "Banned" ? "banned" : "restricted"} terms allowed`
  })

  // Check if advance term used
  const isAdvanceTerm = paymentTerm.includes("Advance") || paymentTerm === "CAD"
  if (isAdvanceTerm && negativeItem.advanceNotAllowed) {
    issues.push({
      severity: "Error",
      message: `❌ CRITICAL: Advanced payment NOT allowed for ${negativeItem.commodity}. ${negativeItem.status} commodity.`,
      resolution: `Use DA, LC, or CAD only. Never use advance payment for negative-list commodities.`
    })
  }

  // Check if banned
  if (negativeItem.status === "Banned") {
    issues.push({
      severity: "Error",
      message: `❌ CRITICAL: ${negativeItem.commodity} (HS ${hsCode}) is completely BANNED from advance payment`,
      resolution: `Cannot export with payment term "${paymentTerm}". Check DGFT notification.`
    })
  }

  return {
    onNegativeList: true,
    canAccept: issues.filter(i => i.severity === "Error").length === 0,
    issues
  }
}

// ============================================
// PRE-SHIPMENT ADVANCE GATE
// ============================================

/**
 * Validate pre-shipment advance against sector policy
 */
export function validatePreShipmentAdvance(
  advancePercentage: number,  // 0-100
  shipmentDate: Date,
  sector: SectorType,
  hsCode?: string
): PreShipmentAdvanceValidation {
  const policy = SECTOR_POLICIES[sector] || SECTOR_POLICIES["Unknown"]
  const issues: PreShipmentAdvanceValidation["issues"] = []
  const today = new Date()

  const daysUntilShipment = Math.floor((shipmentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const remainingBuffer = Math.abs(policy.maxPreShipmentDaysBeforeShipment)

  // Check if advance allowed at all
  if (!policy.preShipmentAdvanceAllowed) {
    issues.push({
      severity: "Error",
      message: `Pre-shipment advance is NOT allowed for ${sector} sector`
    })
  }

  // Check if advance exceeds maximum
  if (advancePercentage > policy.maxAdvanceRealization) {
    issues.push({
      severity: "Error",
      message: `Advance ${advancePercentage}% exceeds ${sector} sector maximum of ${policy.maxAdvanceRealization}%`
    })
  }

  // Check negative list
  if (hsCode) {
    const negItem = checkNegativeList(hsCode)
    if (negItem && negItem.advanceNotAllowed) {
      issues.push({
        severity: "Error",
        message: `Advance not allowed for ${negItem.commodity} (HS ${hsCode}) - on negative list`
      })
    }
  }

  // Check shipment timing gate
  if (daysUntilShipment < remainingBuffer) {
    issues.push({
      severity: "Warning",
      message: `Shipment in ${daysUntilShipment} days - within ${remainingBuffer}-day pre-shipment buffer`
    })
  }

  if (daysUntilShipment <= 0) {
    issues.push({
      severity: "Error",
      message: `❌ CRITICAL: Shipment date has PASSED or is TODAY - no advance allowed within shipment date`
    })
  }

  const allowed = issues.filter(i => i.severity === "Error").length === 0

  return {
    advancePercentage,
    shipmentDaysRemaining: daysUntilShipment,
    sector,
    allowed,
    remainingBuffer,
    issues
  }
}

// ============================================
// MASTER REALIZATION CLAUSE VALIDATION
// ============================================

export interface RealizationClauseValidation {
  invoiceValue: number
  paymentTerm: string
  sector: SectorType
  hsCode: string
  commodity: string
  shipmentDate: Date
  paymentTermValid: boolean
  negativeListCheck: {
    onList: boolean
    canAccept: boolean
  }
  advanceGateValid: boolean
  dynamicTimeline: {
    maxDays: number
    maxAdvancePercent: number
    preShipmentAllowed: boolean
  }
  overallCompliant: boolean
  issues: Array<{
    severity: "Error" | "Warning"
    message: string
    rbIMasterDirectionRef?: string
  }>
  recommendations?: string[]
}

/**
 * Master validation function
 */
export async function validateRealizationClauseWithGates(
  invoiceValue: number,
  paymentTerm: string,
  hsCode: string,
  commodity: string,
  shipmentDate: Date,
  advancePercentage?: number
): Promise<RealizationClauseValidation> {
  const sector = detectSector(commodity, hsCode)
  const policy = SECTOR_POLICIES[sector] || SECTOR_POLICIES["Unknown"]
  const issues: RealizationClauseValidation["issues"] = []
  const recommendations: string[] = []

  // 1. Validate payment term
  const paymentTermValidation = validatePaymentTerm(paymentTerm, sector)
  issues.push(...paymentTermValidation.issues)

  // 2. Check negative list
  const negativeListValidation = validateNegativeList(hsCode, paymentTerm, sector)
  if (!negativeListValidation.canAccept) {
    issues.push(...negativeListValidation.issues)
  }

  // 3. Validate pre-shipment advance (if applicable)
  let advanceGateValid = true
  if (advancePercentage !== undefined && advancePercentage > 0) {
    const advanceValidation = validatePreShipmentAdvance(advancePercentage, shipmentDate, sector, hsCode)
    issues.push(...advanceValidation.issues)
    advanceGateValid = advanceValidation.allowed
  }

  // Build dynamic timeline info
  const dynamicTimeline = {
    maxDays: policy.maxDATenor,
    maxAdvancePercent: policy.maxAdvanceRealization,
    preShipmentAllowed: policy.preShipmentAdvanceAllowed
  }

  // Recommendations
  if (sector === "IT") {
    recommendations.push(`IT Sector Policy: Max ${policy.maxDATenor}-day DA tenure, ${policy.maxAdvanceRealization}% advance allowed`)
  } else if (sector === "Commodities") {
    recommendations.push(`Commodity Policy: Max ${policy.maxDATenor}-day DA tenure, advance typically NOT allowed per RBI`)
  } else if (sector === "Pharma") {
    recommendations.push(`Pharma Policy: No pre-shipment advance allowed, max ${policy.maxDATenor}-day DA`)
  }

  recommendations.push(`Reference: ${policy.rbIMasterDirection}`)

  const overallCompliant = issues.filter(i => i.severity === "Error").length === 0

  return {
    invoiceValue,
    paymentTerm,
    sector,
    hsCode,
    commodity,
    shipmentDate,
    paymentTermValid: paymentTermValidation.isAllowed,
    negativeListCheck: {
      onList: negativeListValidation.onNegativeList,
      canAccept: negativeListValidation.canAccept
    },
    advanceGateValid,
    dynamicTimeline,
    overallCompliant,
    issues,
    recommendations: recommendations.length > 0 ? recommendations : undefined
  }
}

// ============================================
// REPORT GENERATION
// ============================================

export function generateRealizationClauseReport(
  invoiceNumber: string,
  validation: RealizationClauseValidation
): string {
  const lines: string[] = [
    "═".repeat(90),
    "SECTOR-SPECIFIC REALIZATION CLAUSE + PRE-SHIPMENT GATE VALIDATION",
    "═".repeat(90),
    `Invoice: ${invoiceNumber}`,
    `Sector Policy Applied: ${validation.sector}`,
    `HS Code: ${validation.hsCode} | Commodity: ${validation.commodity}`,
    `Payment Term: ${validation.paymentTerm}`,
    `Shipment Date: ${validation.shipmentDate.toISOString().split("T")[0]}`,
    "",
    "POLICY TIMELINE:",
    `  Max DA Tenure: ${validation.dynamicTimeline.maxDays} days`,
    `  Max Pre-Shipment Advance: ${validation.dynamicTimeline.maxAdvancePercent}%`,
    `  Pre-Shipment Advance Allowed: ${validation.dynamicTimeline.preShipmentAllowed ? "Yes" : "No"}`,
    "",
    "VALIDATION STATUS:",
    `  Payment Term Allowed: ${validation.paymentTermValid ? "✅ Yes" : "❌ No"}`,
    `  Negative List Status: ${validation.negativeListCheck.onList ? `⚠️ On List (${validation.negativeListCheck.canAccept ? "Acceptable" : "Blocked"})` : "✅ Not on List"}`,
    `  Pre-Shipment Advance Gate: ${validation.advanceGateValid ? "✅ Passed" : "❌ Failed"}`,
    `  OVERALL COMPLIANCE: ${validation.overallCompliant ? "✅ COMPLIANT" : "❌ NON-COMPLIANT"}`,
    ""
  ]

  if (validation.issues.length > 0) {
    lines.push("ISSUES:")
    validation.issues.forEach(issue => {
      lines.push(`  [${issue.severity}] ${issue.message}`)
      if (issue.rbIMasterDirectionRef) {
        lines.push(`    Ref: ${issue.rbIMasterDirectionRef}`)
      }
    })
    lines.push("")
  }

  if (validation.recommendations) {
    lines.push("SECTOR GUIDANCE:")
    validation.recommendations.forEach(rec => {
      lines.push(`  • ${rec}`)
    })
  }

  lines.push("═".repeat(90))

  return lines.join("\n")
}

/**
 * Bank acceptance check for realization terms
 */
export function canInvoicePassRealizationGates(
  validation: RealizationClauseValidation
): {
  acceptable: boolean
  bankAction: "Negotiate" | "Reject" | "QueryAmendment"
  reasoning: string
} {
  const errors = validation.issues.filter(i => i.severity === "Error")

  if (errors.length > 0) {
    const criticalErrors = errors.filter(e => e.message.includes("NOT allowed") || e.message.includes("CRITICAL"))
    if (criticalErrors.length > 0) {
      return {
        acceptable: false,
        bankAction: "Reject",
        reasoning: `Critical policy violations: ${criticalErrors.map(e => e.message).join("; ")}`
      }
    }

    return {
      acceptable: false,
      bankAction: "QueryAmendment",
      reasoning: `Payment term revision needed: ${errors[0].message}`
    }
  }

  return {
    acceptable: true,
    bankAction: "Negotiate",
    reasoning: `Realization clause compliant with ${validation.sector} sector policy`
  }
}
