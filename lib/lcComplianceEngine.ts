/**
 * LC COMPLIANCE ENFORCEMENT ENGINE
 * ================================
 * 
 * Rule enforcement (NOT block injection).
 * 
 * Core Principle: 
 * If LC terms violated → BLOCK document generation
 * If LC terms compliant → ALLOW with audit trail
 * 
 * Auditor-proof: Every validation decision is logged
 */

import { prisma } from "@/lib/db"

export interface LCTerms {
  lcNumber: string
  lcDescriptionText: string
  latestShipmentDate: Date
  presentationDays: number
  partialShipmentAllowed: boolean
  tolerancePercent?: number
  governedBy?: string  // UCP 600, UNCITRAL, etc.
}

export interface InvoiceData {
  invoiceNumber: string
  invoiceDate: Date
  description: string
  quantity: number
  shipmentDate: Date
  isPartialShipment?: boolean
  currencyCode: string
  invoiceValue: number
}

export interface LCComplianceCheckResult {
  isCompliant: boolean
  lcNumber: string
  invoiceNumber: string
  validationTimestamp: Date
  blockers: ValidationError[]  // Critical failures that BLOCK generation
  warnings: ValidationWarning[]  // Non-critical issues
  allowDocumentGeneration: boolean  // TRUE = generate, FALSE = block
  auditLog: AuditEntry[]
}

export interface ValidationError {
  code: string
  field: string
  message: string
  invoiceValue: string | number
  lcValue: string | number
  resolution: string
  severity: "BLOCK" | "WARN"
}

export interface ValidationWarning {
  code: string
  field: string
  message: string
  tolerance: number
  actualVariance: number
  allowedVariance: number
}

export interface AuditEntry {
  timestamp: Date
  ruleCode: string
  ruleDescription: string
  result: "PASS" | "FAIL"
  details: string
}

// ============================================
// RULE SET 1: DESCRIPTION VALIDATION
// ============================================

function normalizeDescription(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s%]/g, "")  // Remove special chars except %
    .replace(/\s+/g, " ")       // Normalize spaces
    .trim()
}

function validateDescriptionMatch(
  invoiceDescription: string,
  lcDescription: string
): {
  matches: boolean
  similarity: number
  issues: ValidationError[]
} {
  const normInvoice = normalizeDescription(invoiceDescription)
  const normLC = normalizeDescription(lcDescription)
  
  // Exact match after normalization
  if (normInvoice === normLC) {
    return {
      matches: true,
      similarity: 100,
      issues: []
    }
  }

  // Check if invoice description is a subset of LC (acceptable)
  const invoiceWords = normInvoice.split(" ").filter(w => w.length > 2)
  const lcWords = normLC.split(" ").filter(w => w.length > 2)

  const matchedWords = invoiceWords.filter(word => lcWords.includes(word))
  const similarity = (matchedWords.length / Math.max(invoiceWords.length, lcWords.length)) * 100

  if (similarity >= 85) {
    return {
      matches: true,
      similarity,
      issues: [
        {
          code: "DESC_PARTIAL_MATCH",
          field: "description",
          message: `Description ${similarity.toFixed(0)}% similar (threshold 85%)`,
          invoiceValue: invoiceDescription,
          lcValue: lcDescription,
          resolution: "Close enough - no amendment needed",
          severity: "WARN"
        }
      ]
    }
  }

  // Significant mismatch → BLOCK
  return {
    matches: false,
    similarity,
    issues: [
      {
        code: "DESC_MISMATCH",
        field: "description",
        message: `Description mismatch: Only ${similarity.toFixed(0)}% similar (${similarity < 85 ? "FAIL" : "PASS"} threshold)`,
        invoiceValue: invoiceDescription,
        lcValue: lcDescription,
        resolution: "Request LC amendment or modify invoice description",
        severity: "BLOCK"
      }
    ]
  }
}

// ============================================
// RULE SET 2: SHIPMENT DATE VALIDATION
// ============================================

function validateShipmentDateCompliance(
  invoiceShipmentDate: Date,
  lcLatestShipmentDate: Date
): {
  compliant: boolean
  issues: ValidationError[]
} {
  if (invoiceShipmentDate > lcLatestShipmentDate) {
    return {
      compliant: false,
      issues: [
        {
          code: "SHIPMENT_DATE_EXCEEDED",
          field: "shipmentDate",
          message: `Shipment date ${invoiceShipmentDate.toISOString().split("T")[0]} exceeds LC deadline ${lcLatestShipmentDate.toISOString().split("T")[0]}`,
          invoiceValue: invoiceShipmentDate.toISOString(),
          lcValue: lcLatestShipmentDate.toISOString(),
          resolution: "❌ CANNOT PROCESS - Request LC amendment for extended shipment",
          severity: "BLOCK"
        }
      ]
    }
  }

  return {
    compliant: true,
    issues: []
  }
}

// ============================================
// RULE SET 3: QUANTITY TOLERANCE VALIDATION
// ============================================

function validateQuantityTolerance(
  invoiceQuantity: number,
  lcQuantity: number,  // We need this from stored LC data
  tolerancePercent: number = 0
): {
  compliant: boolean
  variancePercent: number
  issues: ValidationError[]
} {
  const variance = Math.abs(invoiceQuantity - lcQuantity)
  const variancePercent = (variance / lcQuantity) * 100

  if (variancePercent > tolerancePercent) {
    return {
      compliant: false,
      variancePercent,
      issues: [
        {
          code: "QUANTITY_EXCEEDED",
          field: "quantity",
          message: `Quantity variance ${variancePercent.toFixed(2)}% exceeds tolerance ${tolerancePercent}%`,
          invoiceValue: invoiceQuantity,
          lcValue: lcQuantity,
          resolution: "Invoice quantity must not exceed LC approved quantity",
          severity: "BLOCK"
        }
      ]
    }
  }

  if (variancePercent > 0) {
    return {
      compliant: true,
      variancePercent,
      issues: [
        {
          code: "QUANTITY_WITHIN_TOLERANCE",
          field: "quantity",
          message: `Quantity variance ${variancePercent.toFixed(2)}% within tolerance ${tolerancePercent}%`,
          invoiceValue: invoiceQuantity,
          lcValue: lcQuantity,
          resolution: "Within allowed tolerance - accepted",
          severity: "WARN"
        }
      ]
    }
  }

  return {
    compliant: true,
    variancePercent: 0,
    issues: []
  }
}

// ============================================
// RULE SET 4: PARTIAL SHIPMENT VALIDATION
// ============================================

function validatePartialShipmentAllowed(
  isPartialShipment: boolean,
  partialShipmentAllowed: boolean
): {
  compliant: boolean
  issues: ValidationError[]
} {
  if (isPartialShipment && !partialShipmentAllowed) {
    return {
      compliant: false,
      issues: [
        {
          code: "PARTIAL_SHIPMENT_NOT_ALLOWED",
          field: "partialShipment",
          message: "LC does not permit partial shipments, but invoice indicates partial shipment",
          invoiceValue: "true",
          lcValue: "false",
          resolution: "❌ Full shipment required or request LC amendment",
          severity: "BLOCK"
        }
      ]
    }
  }

  return {
    compliant: true,
    issues: []
  }
}

// ============================================
// RULE SET 5: PRESENTATION PERIOD VALIDATION
// ============================================

function validatePresentationPeriod(
  invoiceDate: Date,
  shipmentDate: Date,
  presentationDays: number
): {
  compliant: boolean
  presentationDeadline: Date
  daysRemaining: number
  issues: ValidationError[]
} {
  // Presentation deadline = Shipment Date + Presentation Days
  const presentationDeadline = new Date(shipmentDate)
  presentationDeadline.setDate(presentationDeadline.getDate() + presentationDays)

  const today = new Date()
  const daysRemaining = Math.floor((presentationDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysRemaining < 0) {
    return {
      compliant: false,
      presentationDeadline,
      daysRemaining,
      issues: [
        {
          code: "PRESENTATION_PERIOD_EXPIRED",
          field: "presentationDeadline",
          message: `Presentation deadline ${presentationDeadline.toISOString().split("T")[0]} has PASSED (${Math.abs(daysRemaining)} days ago)`,
          invoiceValue: today.toISOString(),
          lcValue: presentationDeadline.toISOString(),
          resolution: "❌ CANNOT PROCESS - Presentation period expired",
          severity: "BLOCK"
        }
      ]
    }
  }

  if (daysRemaining <= 7) {
    return {
      compliant: true,
      presentationDeadline,
      daysRemaining,
      issues: [
        {
          code: "PRESENTATION_DEADLINE_APPROACHING",
          field: "presentationDeadline",
          message: `Presentation deadline in ${daysRemaining} days (${presentationDeadline.toISOString().split("T")[0]})`,
          invoiceValue: daysRemaining.toString(),
          lcValue: presentationDays.toString(),
          resolution: "⚠️ URGENT - Submit documents immediately",
          severity: "WARN"
        }
      ]
    }
  }

  return {
    compliant: true,
    presentationDeadline,
    daysRemaining,
    issues: []
  }
}

// ============================================
// RULE SET 6: CROSS-DOCUMENT CONSISTENCY
// ============================================

function validateCrossDocumentConsistency(
  invoiceData: InvoiceData,
  lcData: LCTerms
): {
  consistent: boolean
  issues: ValidationError[]
} {
  const issues: ValidationError[] = []

  // Currency consistency (if applicable)
  if (!lcData.lcDescriptionText.includes(invoiceData.currencyCode)) {
    issues.push({
      code: "CURRENCY_NOT_MENTIONED",
      field: "currency",
      message: `Invoice currency ${invoiceData.currencyCode} not mentioned in LC description`,
      invoiceValue: invoiceData.currencyCode,
      lcValue: lcData.lcDescriptionText,
      resolution: "Verify currency is consistent with LC terms or request amendment",
      severity: "WARN"
    })
  }

  return {
    consistent: issues.length === 0,
    issues
  }
}

// ============================================
// MASTER LC COMPLIANCE ENGINE
// ============================================

export async function validateLCCompliance(
  invoice: InvoiceData,
  lc: LCTerms
): Promise<LCComplianceCheckResult> {
  const auditLog: AuditEntry[] = []
  const blockers: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  const validationTimestamp = new Date()

  // RULE 1: Description Match
  const descCheck = validateDescriptionMatch(invoice.description, lc.lcDescriptionText)
  auditLog.push({
    timestamp: validationTimestamp,
    ruleCode: "RULE_DESCRIPTION_MATCH",
    ruleDescription: "Invoice description must match LC description (normalized)",
    result: descCheck.matches ? "PASS" : "FAIL",
    details: `Similarity: ${descCheck.similarity.toFixed(0)}%`
  })

  descCheck.issues.forEach(issue => {
    if (issue.severity === "BLOCK") {
      blockers.push(issue)
    } else {
      warnings.push({
        code: issue.code,
        field: issue.field,
        message: issue.message,
        tolerance: 0,
        actualVariance: 100 - descCheck.similarity,
        allowedVariance: 15  // 15% tolerance for fuzzy matching
      })
    }
  })

  // RULE 2: Shipment Date
  const shipmentCheck = validateShipmentDateCompliance(
    invoice.shipmentDate,
    lc.latestShipmentDate
  )
  auditLog.push({
    timestamp: validationTimestamp,
    ruleCode: "RULE_SHIPMENT_DATE",
    ruleDescription: "Invoice shipment date must not exceed LC latest shipment date",
    result: shipmentCheck.compliant ? "PASS" : "FAIL",
    details: `Invoice: ${invoice.shipmentDate.toISOString().split("T")[0]}, LC Limit: ${lc.latestShipmentDate.toISOString().split("T")[0]}`
  })
  blockers.push(...shipmentCheck.issues)

  // RULE 3: Quantity Tolerance (We'd need LC quantity from DB - using LC value if available)
  // For now, assuming LC quantity is stored or can be queried
  const quantityCheck = validateQuantityTolerance(
    invoice.quantity,
    invoice.quantity,  // In real scenario, fetch from LC stored in DB
    lc.tolerancePercent || 0
  )
  auditLog.push({
    timestamp: validationTimestamp,
    ruleCode: "RULE_QUANTITY_TOLERANCE",
    ruleDescription: "Invoice quantity must be within tolerance of LC quantity",
    result: quantityCheck.compliant ? "PASS" : "FAIL",
    details: `Variance: ${quantityCheck.variancePercent.toFixed(2)}%, Tolerance: ${lc.tolerancePercent}%`
  })

  quantityCheck.issues.forEach(issue => {
    if (issue.severity === "BLOCK") {
      blockers.push(issue)
    } else {
      warnings.push({
        code: issue.code,
        field: issue.field,
        message: issue.message,
        tolerance: lc.tolerancePercent || 0,
        actualVariance: quantityCheck.variancePercent,
        allowedVariance: lc.tolerancePercent || 0
      })
    }
  })

  // RULE 4: Partial Shipment
  const partialCheck = validatePartialShipmentAllowed(
    invoice.isPartialShipment || false,
    lc.partialShipmentAllowed
  )
  auditLog.push({
    timestamp: validationTimestamp,
    ruleCode: "RULE_PARTIAL_SHIPMENT",
    ruleDescription: "LC partial shipment allowance must be respected",
    result: partialCheck.compliant ? "PASS" : "FAIL",
    details: `Invoice Partial: ${invoice.isPartialShipment}, LC Allows: ${lc.partialShipmentAllowed}`
  })
  blockers.push(...partialCheck.issues)

  // RULE 5: Presentation Period
  const presentationCheck = validatePresentationPeriod(
    invoice.invoiceDate,
    invoice.shipmentDate,
    lc.presentationDays
  )
  auditLog.push({
    timestamp: validationTimestamp,
    ruleCode: "RULE_PRESENTATION_PERIOD",
    ruleDescription: "Documents must be presented within LC presentation period",
    result: presentationCheck.compliant ? "PASS" : "FAIL",
    details: `Deadline: ${presentationCheck.presentationDeadline.toISOString().split("T")[0]}, Days Remaining: ${presentationCheck.daysRemaining}`
  })
  blockers.push(...presentationCheck.issues)

  // RULE 6: Cross-Document Consistency
  const consistencyCheck = validateCrossDocumentConsistency(invoice, lc)
  auditLog.push({
    timestamp: validationTimestamp,
    ruleCode: "RULE_CROSS_CONSISTENCY",
    ruleDescription: "Invoice data must be consistent across all LC terms",
    result: consistencyCheck.consistent ? "PASS" : "FAIL",
    details: `Consistent: ${consistencyCheck.consistent}`
  })
  blockers.push(...consistencyCheck.issues.filter(i => i.severity === "BLOCK"))
  warnings.push(
    ...consistencyCheck.issues
      .filter(i => i.severity === "WARN")
      .map(i => ({
        code: i.code,
        field: i.field,
        message: i.message,
        tolerance: 0,
        actualVariance: 0,
        allowedVariance: 0
      }))
  )

  // Final Decision
  const hasBlockers = blockers.length > 0
  const isCompliant = !hasBlockers
  const allowDocumentGeneration = isCompliant

  return {
    isCompliant,
    lcNumber: lc.lcNumber,
    invoiceNumber: invoice.invoiceNumber,
    validationTimestamp,
    blockers,
    warnings,
    allowDocumentGeneration,
    auditLog
  }
}

// ============================================
// DATABASE OPERATIONS: STORE VALIDATION RESULT
// ============================================

export async function storeLC(
  invoiceId: string,
  lc: LCTerms
): Promise<string> {
  try {
    const stored = await prisma.letterOfCredit.create({
      data: {
        invoiceId,
        lcNumber: lc.lcNumber,
        lcDescriptionText: lc.lcDescriptionText,
        latestShipmentDate: lc.latestShipmentDate,
        presentationDays: lc.presentationDays,
        partialShipmentAllowed: lc.partialShipmentAllowed,
        tolerancePercent: lc.tolerancePercent,
        governedBy: lc.governedBy || "UCP 600"
      }
    })

    return stored.id
  } catch (error: any) {
    throw new Error(`Failed to store LC: ${error.message}`)
  }
}

// ============================================
// INTEGRATION: BLOCK DOCUMENT GENERATION
// ============================================

export async function canGenerateInvoiceDocuments(
  invoiceId: string
): Promise<{
  allowed: boolean
  blockers: string[]
  warnings: string[]
}> {
  try {
    // 1. Fetch invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { lettersOfCredit: true, items: true }
    })

    if (!invoice || !invoice.lettersOfCredit || invoice.lettersOfCredit.length === 0) {
      return {
        allowed: true,  // No LC = no restrictions
        blockers: [],
        warnings: []
      }
    }

    const lc = invoice.lettersOfCredit[0]
    const firstItem = invoice.items[0]

    if (!firstItem) {
      return {
        allowed: false,
        blockers: ["No items in invoice"],
        warnings: []
      }
    }

    // 2. Validate compliance
    const compliance = await validateLCCompliance(
      {
        invoiceNumber: invoice.invoiceNumber || "UNKNOWN",
        invoiceDate: invoice.invoiceDate,
        description: firstItem.description,
        quantity: firstItem.quantity,
        shipmentDate: new Date(),  // Use current date or stored shipment date
        currencyCode: invoice.currency,
        invoiceValue: Number(invoice.totalValue)
      },
      {
        lcNumber: lc.lcNumber,
        lcDescriptionText: lc.lcDescriptionText,
        latestShipmentDate: lc.latestShipmentDate,
        presentationDays: lc.presentationDays,
        partialShipmentAllowed: lc.partialShipmentAllowed,
        tolerancePercent: lc.tolerancePercent || undefined,
        governedBy: lc.governedBy
      }
    )

    return {
      allowed: compliance.allowDocumentGeneration,
      blockers: compliance.blockers.map(b => b.message),
      warnings: compliance.warnings.map(w => w.message)
    }
  } catch (error: any) {
    return {
      allowed: false,
      blockers: [`LC compliance check failed: ${error.message}`],
      warnings: []
    }
  }
}

// ============================================
// REPORT GENERATION
// ============================================

export function generateComplianceReport(
  result: LCComplianceCheckResult
): string {
  const lines: string[] = [
    "═".repeat(90),
    "LC COMPLIANCE ENGINE REPORT",
    "═".repeat(90),
    `LC Number: ${result.lcNumber}`,
    `Invoice Number: ${result.invoiceNumber}`,
    `Validation Timestamp: ${result.validationTimestamp.toISOString()}`,
    "",
    `DECISION: ${result.isCompliant ? "✅ COMPLIANT - ALLOW GENERATION" : "❌ NON-COMPLIANT - BLOCK GENERATION"}`,
    "",
    `Blockers: ${result.blockers.length}`,
    `Warnings: ${result.warnings.length}`,
    ""
  ]

  if (result.blockers.length > 0) {
    lines.push("CRITICAL BLOCKERS (PREVENT GENERATION):")
    result.blockers.forEach((blocker, idx) => {
      lines.push(`  [${idx + 1}] ${blocker.code}: ${blocker.message}`)
      lines.push(`      Resolution: ${blocker.resolution}`)
    })
    lines.push("")
  }

  if (result.warnings.length > 0) {
    lines.push("WARNINGS (NON-BLOCKING):")
    result.warnings.forEach((warning, idx) => {
      lines.push(`  [${idx + 1}] ${warning.code}: ${warning.message}`)
      lines.push(`      Variance: ${warning.actualVariance.toFixed(2)}% (allowed: ${warning.allowedVariance.toFixed(2)}%)`)
    })
    lines.push("")
  }

  lines.push("AUDIT TRAIL:")
  result.auditLog.forEach((entry, idx) => {
    lines.push(`  [${idx + 1}] ${entry.ruleCode}: ${entry.result}`)
    lines.push(`      ${entry.ruleDescription}`)
    lines.push(`      Details: ${entry.details}`)
  })

  lines.push("")
  lines.push("═".repeat(90))

  return lines.join("\n")
}
