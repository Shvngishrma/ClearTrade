/**
 * LC TERM LOCK SERVICE
 * =====================
 * Enforces UCP 600 strictness on Letter of Credit transactions
 * 
 * Architecture:
 * - Accepts LC terms from issuing bank (immutable input)
 * - Creates LOCKED terms (persisted, cannot be modified)
 * - Validates every transaction checkpoint against locks
 * - Generates audit trail for bank compliance review
 * 
 * UCP 600 § 1: "Credit must be used as issued"
 * UCP 600 § 3: "Strict compliance or not at all"
 * 
 * This service enforces BOTH rules:
 * 1. No variation from LC terms (unless explicitly allowed in LC)
 * 2. All variations flagged and logged for auditor
 */

import { Decimal } from "@prisma/client/runtime/library"

// ============================================
// INTERFACES: LC TERM DEFINITIONS (Bank Input)
// ============================================

export interface LCLineItem {
  lineNumber: number
  description: string
  quantity: number
  unit: string
  unitPrice: Decimal | number
  totalPrice: Decimal | number
}

export interface LCShipmentWindow {
  from: Date
  to: Date
  latestDate: Date // Last possible shipment date per LC
}

export interface LCTolerance {
  // UCP 600 § 30: Quantity tolerance in LC
  quantityPlusPercent?: number // e.g., "+5%" allowed
  quantityMinusPercent?: number // e.g., "-5%" allowed
  priceVariance?: number // e.g., "within 2%" variance
}

export interface LCPresentationTerms {
  // UCP 600 § 14: Presentation of documents
  presentationPeriod: number // days after shipment to present this LC to bank
  documentsRequired: string[] // "Invoice", "Packing List", "Bill of Lading", etc.
  incoterm: "FOB" | "CIF" | "CFR" | "EXW"
  partialShipmentAllowed: boolean // UCP 600 § 31
  transhipmentAllowed: boolean // UCP 600 § 32
  shipmentOn: "Steamship date" | "Departure date" | "On board date" // Bill of Lading type
}

export interface LCSpecialConditions {
  // UCP 600 § 24: Special conditions and undertakings
  conditions: Array<{
    code: string
    description: string
    mandatory: boolean // true = must be satisfied before payment
  }>
  // Example: "AUTH Certificate required", "Inspection Certificate", etc.
}

export interface LCTerms {
  // LC Identification
  lcNumber: string
  issuingBank: string
  advisingBank: string
  confirmingBank?: string
  
  // Parties
  applicant: { name: string; country: string } // Buyer
  beneficiary: { name: string; country: string } // Seller/Exporter
  
  // LC Timeline
  issuanceDate: Date
  expiryDate: Date // UCP 600 § 70: Expiry for presentation
  shipmentWindow: LCShipmentWindow
  
  // Amount
  lcAmount: Decimal | number
  currency: string
  
  // Terms
  lineItems: LCLineItem[]
  incoterm: "FOB" | "CIF" | "CFR" | "EXW"
  portOfLoading?: string
  portOfDischarge?: string
  
  // Shipment Rules
  presentation: LCPresentationTerms
  tolerance: LCTolerance
  
  // Special Conditions
  specialConditions?: LCSpecialConditions
  
  // UCP 600 Classification
  ucp600Citation?: string // "UCP 600 as per ICC Publication"
  
  // Metadata
  receivedDate: Date
  status: "Active" | "Expired" | "Cancelled"
}

// ============================================
// INTERFACES: LOCKED LC RECORD (Service Output)
// ============================================

export interface LCLockRecord {
  // Identifies the lock
  lockId: string
  lcNumber: string
  exporterId: string
  
  // Locked terms (immutable snapshot)
  lockedTerms: LCTerms
  
  // Lock lifecycle
  lockedAt: Date
  lockedBy: string // User ID
  expiresAt: Date // Same as LC expiryDate
  status: "Active" | "Expired" | "Cancelled" | "Locked"
  
  // Audit trail
  invoicesGenerated: number
  invoicesSubmitted: number
  discrepanciesFound: number
  auditLogId?: string
}

// ============================================
// VALIDATION RESULT TYPES
// ============================================

export interface CheckpointValidation {
  passed: boolean
  checkpoint: string
  severity: "Error" | "Warning" | "Info"
  message: string
  details?: Record<string, any>
}

export interface ShipmentDateValidation extends CheckpointValidation {
  checkpoint: "shipment-date"
  actualDate?: Date
  allowedWindow?: { from: Date; to: Date }
}

export interface QuantityValidation extends CheckpointValidation {
  checkpoint: "quantity"
  lcQuantity?: number
  actualQuantity?: number
  tolerance?: { min: number; max: number }
  variance?: number
}

export interface PresentationValidation extends CheckpointValidation {
  checkpoint: "presentation-period"
  shipmentDate?: Date
  presentationDeadline?: Date
  actualPresentationDate?: Date
  daysRemaining?: number
}

export interface DocumentaryValidation extends CheckpointValidation {
  checkpoint: "documentary-consistency"
  requiredDocuments?: string[]
  missingDocuments?: string[]
  inconsistencies?: Array<{
    document1: string
    document2: string
    field: string
    value1: any
    value2: any
  }>
}

export interface SpecialConditionValidation extends CheckpointValidation {
  checkpoint: "special-conditions"
  failedConditions?: Array<{
    code: string
    description: string
    status: "Satisfied" | "Pending" | "Not Satisfied"
  }>
}

export interface LCComplianceReport {
  lockId: string
  lcNumber: string
  invoiceId: string
  
  // Validation checkpoint results
  checkpoints: CheckpointValidation[]
  
  // Summary
  totalCheckpoints: number
  checkpointsPassed: number
  checkpointsFailed: number
  complianceScore: number // 0-100%
  compliant: boolean // true if all Error checkpoints passed
  
  // Recommendations
  issues: Array<{
    severity: "Error" | "Warning" | "Info"
    message: string
    resolution?: string
  }>
  
  // Audit info
  validatedAt: Date
  validatedBy: string
  reportId: string
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * PHASE 1: Lock LC Terms
 * Creates immutable snapshot of LC from bank
 * Once locked, terms cannot be modified
 */
export function lockLCTerms(
  lcTerms: LCTerms,
  exporterId: string,
  userId: string
): LCLockRecord {
  const lockId = `LC-LOCK-${lcTerms.lcNumber}-${Date.now()}`
  
  const lock: LCLockRecord = {
    lockId,
    lcNumber: lcTerms.lcNumber,
    exporterId,
    lockedTerms: JSON.parse(JSON.stringify(lcTerms)), // Deep copy for immutability
    lockedAt: new Date(),
    lockedBy: userId,
    expiresAt: lcTerms.expiryDate,
    status: "Active",
    invoicesGenerated: 0,
    invoicesSubmitted: 0,
    discrepanciesFound: 0,
  }
  
  return lock
}

/**
 * CHECKPOINT 1: Shipment Date Validation
 * UCP 600 § 15: Shipment period
 * 
 * Validates:
 * - Shipment date within LC window
 * - Not after latest date in LC
 */
export function validateShipmentDate(
  lcLock: LCLockRecord,
  shipmentDate: Date
): ShipmentDateValidation {
  const window = lcLock.lockedTerms.shipmentWindow
  const isValid =
    shipmentDate >= window.from &&
    shipmentDate <= window.latestDate &&
    shipmentDate <= lcLock.lockedTerms.expiryDate

  return {
    passed: isValid,
    checkpoint: "shipment-date",
    severity: isValid ? "Info" : "Error",
    message: isValid
      ? `Shipment date ${shipmentDate.toISOString().split("T")[0]} is within LC window`
      : `Shipment date ${shipmentDate.toISOString().split("T")[0]} violates LC window [${window.from.toISOString().split("T")[0]} to ${window.latestDate.toISOString().split("T")[0]}]`,
    actualDate: shipmentDate,
    allowedWindow: window,
  }
}

/**
 * CHECKPOINT 2: Quantity Validation
 * UCP 600 § 30: Tolerance in credit amount and quantities
 * 
 * Validates:
 * - Quantity matches LC exactly OR within stated tolerance
 * - If partial shipment not allowed: quantity = LC quantity
 * - If tolerance exists: variance within limits
 */
export interface QuantityCheckInput {
  invoiceQuantity: number
  invoiceUnit: string
  lineItemIndex: number
}

export function validateQuantity(
  lcLock: LCLockRecord,
  quantityCheck: QuantityCheckInput
): QuantityValidation {
  const lcItem = lcLock.lockedTerms.lineItems[quantityCheck.lineItemIndex]
  
  if (!lcItem) {
    return {
      passed: false,
      checkpoint: "quantity",
      severity: "Error",
      message: `LC line item ${quantityCheck.lineItemIndex} not found in LC`,
    }
  }

  const lcQty = lcItem.quantity
  const invoiceQty = quantityCheck.invoiceQuantity
  const tolerance = lcLock.lockedTerms.tolerance

  // Check for exact match first
  if (invoiceQty === lcQty) {
    return {
      passed: true,
      checkpoint: "quantity",
      severity: "Info",
      message: `Quantity ${invoiceQty} ${quantityCheck.invoiceUnit} matches LC exactly`,
      lcQuantity: lcQty,
      actualQuantity: invoiceQty,
    }
  }

  // Check if partial shipment allowed
  if (!lcLock.lockedTerms.presentation.partialShipmentAllowed && invoiceQty < lcQty) {
    return {
      passed: false,
      checkpoint: "quantity",
      severity: "Error",
      message: `Partial shipment not allowed per LC. LC quantity: ${lcQty}, Invoice quantity: ${invoiceQty}`,
      lcQuantity: lcQty,
      actualQuantity: invoiceQty,
    }
  }

  // Check tolerance if applicable
  if (tolerance && (tolerance.quantityPlusPercent || tolerance.quantityMinusPercent)) {
    const minPercent = tolerance.quantityMinusPercent || 0
    const maxPercent = tolerance.quantityPlusPercent || 0
    
    const minQty = lcQty * (1 - minPercent / 100)
    const maxQty = lcQty * (1 + maxPercent / 100)
    const variance = ((invoiceQty - lcQty) / lcQty) * 100

    const withinTolerance = invoiceQty >= minQty && invoiceQty <= maxQty
    
    return {
      passed: withinTolerance,
      checkpoint: "quantity",
      severity: withinTolerance ? "Info" : "Error",
      message: withinTolerance
        ? `Quantity ${invoiceQty} within tolerance ±${maxPercent}% (${minQty.toFixed(2)}-${maxQty.toFixed(2)})`
        : `Quantity ${invoiceQty} exceeds tolerance ±${maxPercent}% (allowed: ${minQty.toFixed(2)}-${maxQty.toFixed(2)})`,
      lcQuantity: lcQty,
      actualQuantity: invoiceQty,
      tolerance: { min: minQty, max: maxQty },
      variance,
    }
  }

  // Strict compliance: exact match required
  return {
    passed: false,
    checkpoint: "quantity",
    severity: "Error",
    message: `Quantity mismatch: LC=${lcQty}, Invoice=${invoiceQty}. Strict compliance requires exact match per UCP 600 § 30.`,
    lcQuantity: lcQty,
    actualQuantity: invoiceQty,
  }
}

/**
 * CHECKPOINT 3: Presentation Period Validation
 * UCP 600 § 14: "Presentation must be made by the expiry date"
 * 
 * Validates:
 * - Documents presented within period after shipment
 * - Presentation before LC expiry
 */
export interface PresentationCheckInput {
  shipmentDate: Date
  presentationDate: Date
}

export function validatePresentationPeriod(
  lcLock: LCLockRecord,
  presentationCheck: PresentationCheckInput
): PresentationValidation {
  const period = lcLock.lockedTerms.presentation.presentationPeriod // days
  const deadline = new Date(presentationCheck.shipmentDate)
  deadline.setDate(deadline.getDate() + period)

  const beforeExpiry = presentationCheck.presentationDate <= lcLock.lockedTerms.expiryDate
  const beforeDeadline = presentationCheck.presentationDate <= deadline

  const passed = beforeExpiry && beforeDeadline
  const daysRemaining = Math.ceil(
    (deadline.getTime() - presentationCheck.presentationDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  return {
    passed,
    checkpoint: "presentation-period",
    severity: passed ? "Info" : "Error",
    message: passed
      ? `Presentation within ${period}-day period (deadline: ${deadline.toISOString().split("T")[0]})`
      : `Presentation deadline exceeded. Deadline: ${deadline.toISOString().split("T")[0]}, Presentation: ${presentationCheck.presentationDate.toISOString().split("T")[0]}`,
    shipmentDate: presentationCheck.shipmentDate,
    presentationDeadline: deadline,
    actualPresentationDate: presentationCheck.presentationDate,
    daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
  }
}

/**
 * CHECKPOINT 4: Documentary Consistency Cross-Check
 * UCP 600 § 14: All documents in the credit should be consistent
 * 
 * Validates:
 * - All required documents present
 * - Quantities consistent across documents
 * - Descriptions consistent across documents
 * - Port names consistent
 */
export interface DocumentaryData {
  invoice?: {
    quantity: number
    description: string
    unitPrice: number
    totalAmount: number
  }
  packingList?: {
    quantity: number
    weight: number
    netWeight: number
  }
  shippingBill?: {
    quantity: number
    portOfLoading: string
  }
  billOfLading?: {
    quantity: number
    shipmentDate: Date
    onBoardDate: Date
  }
}

export function validateDocumentaryConsistency(
  lcLock: LCLockRecord,
  documents: DocumentaryData
): DocumentaryValidation {
  const required = lcLock.lockedTerms.presentation.documentsRequired
  const inconsistencies: DocumentaryValidation["inconsistencies"] = []
  const missingDocuments: string[] = []

  // Check if all required documents present
  const hasInvoice = required.includes("Invoice") && documents.invoice
  const hasPackingList = required.includes("Packing List") && documents.packingList
  const hasShippingBill = required.includes("Shipping Bill") && documents.shippingBill
  const hasBOL = required.includes("Bill of Lading") && documents.billOfLading

  for (const doc of required) {
    if (doc === "Invoice" && !documents.invoice) missingDocuments.push(doc)
    if (doc === "Packing List" && !documents.packingList) missingDocuments.push(doc)
    if (doc === "Shipping Bill" && !documents.shippingBill) missingDocuments.push(doc)
    if (doc === "Bill of Lading" && !documents.billOfLading) missingDocuments.push(doc)
  }

  // Cross-check quantities
  if (hasInvoice && hasPackingList && documents.invoice && documents.packingList) {
    if (documents.invoice.quantity !== documents.packingList.quantity) {
      inconsistencies.push({
        document1: "Invoice",
        document2: "Packing List",
        field: "quantity",
        value1: documents.invoice.quantity,
        value2: documents.packingList.quantity,
      })
    }
  }

  if (hasInvoice && hasShippingBill && documents.invoice && documents.shippingBill) {
    if (documents.invoice.quantity !== documents.shippingBill.quantity) {
      inconsistencies.push({
        document1: "Invoice",
        document2: "Shipping Bill",
        field: "quantity",
        value1: documents.invoice.quantity,
        value2: documents.shippingBill.quantity,
      })
    }
  }

  // Cross-check port names
  if (hasShippingBill && documents.shippingBill && lcLock.lockedTerms.portOfLoading) {
    if (!documents.shippingBill.portOfLoading.toUpperCase().includes(lcLock.lockedTerms.portOfLoading.toUpperCase())) {
      inconsistencies.push({
        document1: "LC",
        document2: "Shipping Bill",
        field: "portOfLoading",
        value1: lcLock.lockedTerms.portOfLoading,
        value2: documents.shippingBill.portOfLoading,
      })
    }
  }

  // Cross-check shipment date consistency
  if (hasShippingBill && hasBOL && documents.shippingBill && documents.billOfLading) {
    // Shipping bill date should be before or equal to BOL on-board date
    if (documents.shippingBill.quantity !== documents.billOfLading.quantity) {
      inconsistencies.push({
        document1: "Shipping Bill",
        document2: "Bill of Lading",
        field: "quantity",
        value1: documents.shippingBill.quantity,
        value2: documents.billOfLading.quantity,
      })
    }
  }

  const passed = missingDocuments.length === 0 && inconsistencies.length === 0

  return {
    passed,
    checkpoint: "documentary-consistency",
    severity: passed ? "Info" : "Error",
    message: passed
      ? `All required documents present and consistent`
      : `Documentary inconsistencies detected: ${missingDocuments.length} missing, ${inconsistencies.length} inconsistent fields`,
    requiredDocuments: required,
    missingDocuments: missingDocuments.length > 0 ? missingDocuments : undefined,
    inconsistencies: inconsistencies.length > 0 ? inconsistencies : undefined,
  }
}

/**
 * CHECKPOINT 5: Special Conditions Validation
 * UCP 600 § 24: Special conditions that must be satisfied
 * 
 * Validates:
 * - All mandatory special conditions satisfied
 * - Auth certificates present
 * - Inspection certificates present
 */
export interface SpecialConditionStatus {
  code: string
  satisfied: boolean
  evidenceDocuments?: string[] // e.g., ["AUTH Certificate", "Inspection Report"]
}

export function validateSpecialConditions(
  lcLock: LCLockRecord,
  conditionStatuses: SpecialConditionStatus[]
): SpecialConditionValidation {
  if (!lcLock.lockedTerms.specialConditions || lcLock.lockedTerms.specialConditions.conditions.length === 0) {
    return {
      passed: true,
      checkpoint: "special-conditions",
      severity: "Info",
      message: "No special conditions in this LC",
      failedConditions: [],
    }
  }

  const failedConditions = lcLock.lockedTerms.specialConditions.conditions
    .filter((cond) => cond.mandatory)
    .map((cond) => {
      const status = conditionStatuses.find((s) => s.code === cond.code)
      return {
        code: cond.code,
        description: cond.description,
        status: status?.satisfied ? ("Satisfied" as const) : ("Not Satisfied" as const),
      }
    })
    .filter((cond) => cond.status === "Not Satisfied")

  const passed = failedConditions.length === 0

  return {
    passed,
    checkpoint: "special-conditions",
    severity: passed ? "Info" : "Error",
    message: passed
      ? `All ${lcLock.lockedTerms.specialConditions.conditions.length} mandatory conditions satisfied`
      : `${failedConditions.length} mandatory conditions not satisfied`,
    failedConditions: failedConditions.length > 0 ? failedConditions : undefined,
  }
}

/**
 * MASTER VALIDATION: Generate Comprehensive LC Compliance Report
 * Runs all 5 checkpoints and generates audit report
 */
export interface ComplianceCheckInput {
  invoiceId: string
  shipmentDate: Date
  presentationDate: Date
  quantities: QuantityCheckInput[]
  documents: DocumentaryData
  specialConditionStatuses?: SpecialConditionStatus[]
  validatedBy: string
}

export function generateLCComplianceReport(
  lcLock: LCLockRecord,
  check: ComplianceCheckInput
): LCComplianceReport {
  const checkpoints: CheckpointValidation[] = []

  // Run all 5 checkpoints
  checkpoints.push(validateShipmentDate(lcLock, check.shipmentDate))

  for (const qty of check.quantities) {
    checkpoints.push(validateQuantity(lcLock, qty))
  }

  checkpoints.push(validatePresentationPeriod(lcLock, {
    shipmentDate: check.shipmentDate,
    presentationDate: check.presentationDate,
  }))

  checkpoints.push(validateDocumentaryConsistency(lcLock, check.documents))

  checkpoints.push(
    validateSpecialConditions(
      lcLock,
      check.specialConditionStatuses || []
    )
  )

  // Calculate compliance score
  const totalCheckpoints = checkpoints.length
  const checkpointsFailed = checkpoints.filter((c) => c.severity === "Error").length
  const checkpointsPassed = totalCheckpoints - checkpointsFailed
  const complianceScore = Math.round((checkpointsPassed / totalCheckpoints) * 100)

  const issues = checkpoints
    .filter((c) => c.severity !== "Info")
    .map((c) => ({
      severity: c.severity,
      message: c.message,
      resolution: c.checkpoint === "shipment-date"
        ? "Adjust shipment date to fall within LC window"
        : c.checkpoint === "quantity"
        ? "Adjust invoice quantity to match LC or within tolerance"
        : c.checkpoint === "presentation-period"
        ? "Present documents before deadline"
        : c.checkpoint === "documentary-consistency"
        ? "Ensure all documents are present and consistent"
        : "Satisfy all mandatory special conditions",
    }))

  return {
    lockId: lcLock.lockId,
    lcNumber: lcLock.lcNumber,
    invoiceId: check.invoiceId,
    checkpoints,
    totalCheckpoints,
    checkpointsPassed,
    checkpointsFailed,
    complianceScore,
    compliant: checkpointsFailed === 0,
    issues,
    validatedAt: new Date(),
    validatedBy: check.validatedBy,
    reportId: `REPORT-${lcLock.lcNumber}-${check.invoiceId}-${Date.now()}`,
  }
}

/**
 * Format compliance report for bank submission
 */
export function formatLCComplianceForBank(report: LCComplianceReport): string {
  const lines: string[] = [
    "═══════════════════════════════════════════════════════════════",
    "LC COMPLIANCE CERTIFICATION REPORT",
    "═══════════════════════════════════════════════════════════════",
    "",
    `LC Number: ${report.lcNumber}`,
    `Invoice ID: ${report.invoiceId}`,
    `Report ID: ${report.reportId}`,
    `Validated: ${report.validatedAt.toISOString()}`,
    `Validated By: ${report.validatedBy}`,
    "",
    "COMPLIANCE CHECKPOINTS",
    "─────────────────────────────────────────────────────────────────",
  ]

  report.checkpoints.forEach((cp, idx) => {
    const statusIcon = cp.passed ? "✓" : "✗"
    lines.push(`${statusIcon} Checkpoint ${idx + 1}: ${cp.checkpoint.toUpperCase()}`)
    lines.push(`  Status: ${cp.severity}`)
    lines.push(`  ${cp.message}`)
    lines.push("")
  })

  lines.push("SUMMARY")
  lines.push("─────────────────────────────────────────────────────────────────")
  lines.push(`Total Checkpoints: ${report.totalCheckpoints}`)
  lines.push(`Passed: ${report.checkpointsPassed}`)
  lines.push(`Failed: ${report.checkpointsFailed}`)
  lines.push(`Compliance Score: ${report.complianceScore}%`)
  lines.push(`Status: ${report.compliant ? "✓ COMPLIANT (Ready for bank)" : "✗ NON-COMPLIANT (Requires correction)"}`)
  lines.push("")

  if (report.issues.length > 0) {
    lines.push("ISSUES & RESOLUTIONS")
    lines.push("─────────────────────────────────────────────────────────────────")
    report.issues.forEach((issue) => {
      lines.push(`[${issue.severity}] ${issue.message}`)
      if (issue.resolution) {
        lines.push(`→ Resolution: ${issue.resolution}`)
      }
      lines.push("")
    })
  }

  lines.push("═══════════════════════════════════════════════════════════════")
  lines.push(`This report is certified as per UCP 600 compliance rules.`)
  lines.push(`For bank review and acceptance only.`)

  return lines.join("\n")
}

/**
 * Check if LC lock is still valid
 */
export function isLCLockValid(lcLock: LCLockRecord): boolean {
  const now = new Date()
  return (
    lcLock.status === "Active" &&
    now <= lcLock.expiresAt &&
    lcLock.lockedTerms.status === "Active"
  )
}

/**
 * Get LC lock summary (for display)
 */
export function getLCLockSummary(lcLock: LCLockRecord): Record<string, any> {
  return {
    lcNumber: lcLock.lcNumber,
    status: lcLock.status,
    lockedAt: lcLock.lockedAt.toISOString(),
    expiresAt: lcLock.expiresAt.toISOString(),
    amount: lcLock.lockedTerms.lcAmount,
    currency: lcLock.lockedTerms.currency,
    shipmentWindow: {
      from: lcLock.lockedTerms.shipmentWindow.from.toISOString(),
      to: lcLock.lockedTerms.shipmentWindow.latestDate.toISOString(),
    },
    lineItems: lcLock.lockedTerms.lineItems.length,
    partialShipmentAllowed: lcLock.lockedTerms.presentation.partialShipmentAllowed,
    tolerance: lcLock.lockedTerms.tolerance,
    presentationPeriod: `${lcLock.lockedTerms.presentation.presentationPeriod} days`,
    invoices: {
      generated: lcLock.invoicesGenerated,
      submitted: lcLock.invoicesSubmitted,
      discrepancies: lcLock.discrepanciesFound,
    },
  }
}
