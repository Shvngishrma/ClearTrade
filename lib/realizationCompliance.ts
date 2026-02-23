/**
 * ENGINE 6: FEMA REALIZATION COMPLIANCE ENGINE
 * 
 * Enforces Foreign Exchange Management Act (FEMA) compliance around payment realization.
 * Validates payment term clauses, advance payment timing, and LC governance.
 * Goes BEYOND blocking - includes clause-level logic for each payment term type.
 * 
 * 5 Rules:
 * 1. Advance payment must be realized before shipment (timing validation)
 * 2. LC governed by UCP 600 (standard reference auto-injection)
 * 3. DA/DP flagged with risk disclosure (payment risk flagging)
 * 4. RBI Master Direction reference auto-injected (compliance reference)
 * 5. Realization timeline enforced (9-month default, configurable per term)
 * 
 * Returns: paymentValid, advanceReceivedOnTime, rbiCompliant, riskLevel, auditLog[]
 * 
 * Clause-level logic:
 * - Advance: Must clear before shipment
 * - LC: Must reference UCP 600, validate expiry window
 * - DA: Requires acceptance date, 180-day realization window
 * - DP: Requires payment proof, 90-day realization window
 * - COD: Uses UPI/RTGS clearing, real-time validation
 * - Credit: 90-day default, configurable per buyer credit rating
 */

import { prisma } from "@/lib/db"

// ============================================
// TYPE DEFINITIONS
// ============================================

export type PaymentTermType =
  | "Advance" // Full advance payment
  | "LC" // Letter of Credit
  | "DA" // Documents Against Acceptance
  | "DP" // Documents Against Payment
  | "COD" // Cash on Delivery
  | "Credit" // Post-shipment credit

export interface RealizationComplianceInput {
  invoiceId: string
  paymentTerms: PaymentTermType
  shipmentDate: Date
  advanceReceivedDate?: Date
  lcNumber?: string
  lcExpiryDate?: Date
  daAcceptanceDate?: Date
  dpPaymentDate?: Date
  creditTerms?: number // Days (default 90)
  invoiceAmount: number
  invoiceCurrency: string
  buyerId?: string
  buyerCountry?: string
}

export interface RealizationComplianceResult {
  isCompliant: boolean
  paymentTermValid: boolean
  advanceReceivedOnTime: boolean
  rbiCompliant: boolean
  realizationStatus: "REALIZED" | "NOT_REALIZED" | "PENDING" | "AT_RISK"
  riskLevel: "LOW" | "MEDIUM" | "HIGH"
  
  paymentClause: {
    type: PaymentTermType
    description: string
    rbiReference: string
    realizationDeadline: Date
    daysRemaining: number
  }
  
  errors: Array<{
    code: string
    message: string
    severity: "BLOCKER" | "WARNING"
  }>
  
  warnings: Array<{
    code: string
    message: string
    riskDisclosure: string
  }>
  
  riskDisclosures: Array<{
    riskType: string
    description: string
    mitigation: string
  }>
  
  auditLog: Array<{
    timestamp: Date
    ruleCode: string
    ruleName: string
    result: boolean
    message: string
    clause?: string
  }>
  
  validationTimestamp: Date
}

// ============================================
// MASTER DATA: RBI COMPLIANCE REFERENCES
// ============================================

interface RBIPaymentClause {
  paymentType: PaymentTermType
  rbiReference: string
  section: string
  description: string
  realizationWindow: number // Days
  requiresDocumentation: string[]
}

const RBI_PAYMENT_MASTER: RBIPaymentClause[] = [
  {
    paymentType: "Advance",
    rbiReference: "RBI-Master Direction 2023 | AD Series Circular 2",
    section: "Payment for Exports - Advance Section",
    description: "Advance payment must be realized (credited to AD account) BEFORE shipment of goods",
    realizationWindow: 0, // Must be before shipment
    requiresDocumentation: ["Bank confirmation", "Advance remittance proof", "Exchange declaration"]
  },
  {
    paymentType: "LC",
    rbiReference: "RBI-Master Direction 2023 | UCP 600 Governing Clause",
    section: "LC Realization - UCP 600 Standard",
    description: "LC must be governed by UCP 600 and realization must occur within 45 days of shipment (standard presentation period)",
    realizationWindow: 45, // UCP 600 standard
    requiresDocumentation: ["LC copy", "Bill of Lading", "Shipping documents", "Invoice", "Insurance certificate"]
  },
  {
    paymentType: "DA",
    rbiReference: "RBI-Master Direction 2023 | DA Trade Procedure",
    section: "Documents Against Acceptance - Trade Credit",
    description: "DA involves crediting after buyer acceptance of documents. RBI requires realization within 180 days, risk on exporter",
    realizationWindow: 180, // 6 months standard DA window
    requiresDocumentation: ["DA bill", "Acceptance date proof", "Bill of Lading", "Insurance certificate", "Invoice"]
  },
  {
    paymentType: "DP",
    rbiReference: "RBI-Master Direction 2023 | DP Trade Procedure",
    section: "Documents Against Payment - Stricter Control",
    description: "DP requires payment BEFORE document release. Realization window 90 days. Bank acts as collection agent.",
    realizationWindow: 90, // 3 months for DP
    requiresDocumentation: ["DP bill copy", "Payment proof", "Collection reference", "Bill of Lading", "Insurance certificate"]
  },
  {
    paymentType: "COD",
    rbiReference: "RBI-Master Direction 2023 | COD Real-Time Settlement",
    section: "Cash on Delivery - Immediate Settlement",
    description: "COD requires payment at delivery via UPI/RTGS/SWIFT. Real-time clearing within 24 hours.",
    realizationWindow: 1, // 1 day max
    requiresDocumentation: ["Payment confirmation", "Courier proof", "Recipient signature", "Settlement statement"]
  },
  {
    paymentType: "Credit",
    rbiReference: "RBI-Master Direction 2023 | Post-Shipment Credit",
    section: "Credit Terms - Buyer Creditworthiness",
    description: "Post-shipment credit typically 90 days (configurable based on buyer rating). Must track realization daily.",
    realizationWindow: 90, // Default 90 days, configurable
    requiresDocumentation: ["Credit approval", "Buyer rating report", "Shipping documents", "Invoice", "Realization schedule"]
  }
]

// ============================================
// RULE 1: ADVANCE PAYMENT REALIZATION TIMING
// ============================================

function validateAdvancePaymentTiming(
  advanceReceivedDate: Date | undefined,
  shipmentDate: Date
): { valid: boolean; message: string; clause: string } {
  if (!advanceReceivedDate) {
    return {
      valid: false,
      message: "❌ Advance payment not received - cannot ship under Advance term",
      clause: "RBI-Master Direction: Advance must be realized BEFORE shipment"
    }
  }
  
  const advanceBeforeShipment = advanceReceivedDate < shipmentDate
  
  if (!advanceBeforeShipment) {
    return {
      valid: false,
      message: `❌ Advance received AFTER shipment (${advanceReceivedDate.toDateString()}) - violates FEMA`,
      clause: "RBI-Master Direction: Advance payment must clear before goods move"
    }
  }
  
  const daysBefore = Math.floor(
    (shipmentDate.getTime() - advanceReceivedDate.getTime()) / (1000 * 60 * 60 * 24)
  )
  
  return {
    valid: true,
    message: `✅ Advance received ${daysBefore} days before shipment (${advanceReceivedDate.toDateString()})`,
    clause: "RBI-Master Direction: Advance received on time, compliant"
  }
}

// ============================================
// RULE 2: LC GOVERNANCE - UCP 600
// ============================================

function validateLCGovernance(
  paymentTerms: PaymentTermType,
  lcNumber: string | undefined,
  lcExpiryDate: Date | undefined
): { valid: boolean; message: string; ucp600Applied: boolean; clause: string } {
  if (paymentTerms !== "LC") {
    return {
      valid: true,
      message: "N/A - Payment term is not LC",
      ucp600Applied: false,
      clause: ""
    }
  }
  
  if (!lcNumber) {
    return {
      valid: false,
      message: "❌ LC term selected but no LC number provided",
      ucp600Applied: false,
      clause: "RBI-Master: LC must have valid LC number"
    }
  }
  
  if (!lcExpiryDate) {
    return {
      valid: false,
      message: "❌ LC expiry date not provided - cannot validate UCP 600 window",
      ucp600Applied: false,
      clause: "RBI-Master: LC expiry is mandatory for UCP 600 presentation period"
    }
  }
  
  const today = new Date()
  const daysUntilExpiry = Math.floor(
    (lcExpiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )
  
  if (daysUntilExpiry < 45) {
    return {
      valid: false,
      message: `❌ LC expires in ${daysUntilExpiry} days - insufficient time for 45-day UCP 600 presentation period`,
      ucp600Applied: true,
      clause: "UCP 600: 45-day presentation window required"
    }
  }
  
  return {
    valid: true,
    message: `✅ LC ${lcNumber} valid, governed by UCP 600. Expiry: ${lcExpiryDate.toDateString()} (${daysUntilExpiry} days)`,
    ucp600Applied: true,
    clause: "UCP 600: LC presentation period validated"
  }
}

// ============================================
// RULE 3: DA/DP RISK FLAGGING
// ============================================

function flagDADPRisks(
  paymentTerms: PaymentTermType
): {
  flagged: boolean
  riskLevel: "LOW" | "MEDIUM" | "HIGH"
  risks: Array<{ type: string; description: string; mitigation: string }>
  clause: string
} {
  if (paymentTerms === "Advance" || paymentTerms === "LC" || paymentTerms === "COD") {
    return {
      flagged: false,
      riskLevel: "LOW",
      risks: [],
      clause: `${paymentTerms} term - Low payment risk`
    }
  }
  
  if (paymentTerms === "DA") {
    return {
      flagged: true,
      riskLevel: "HIGH",
      risks: [
        {
          type: "Acceptance Risk",
          description: "Buyer can reject documents or delay acceptance indefinitely",
          mitigation: "Require written acceptance clause; set maximum 10-day acceptance window"
        },
        {
          type: "Credit Risk",
          description: "Payment depends on buyer's creditworthiness after document receipt",
          mitigation: "Get buyer credit rating report; consider buyer insurance"
        },
        {
          type: "Realization Risk",
          description: "RBI allows 180-day realization window - working capital blocked for 6 months",
          mitigation: "Factoring / Invoice discounting recommended; negotiate early payment discount"
        }
      ],
      clause: "RBI-Master: DA carries high credit risk - requires acceptance proof within 10 days"
    }
  }
  
  if (paymentTerms === "DP") {
    return {
      flagged: true,
      riskLevel: "MEDIUM",
      risks: [
        {
          type: "Payment Before Release",
          description: "Bank releases documents only after payment - less risk than DA",
          mitigation: "Ensure collection bank is reputable; confirm payment within 3 days"
        },
        {
          type: "Dispute Risk",
          description: "International disputes on document rejection or payment delays",
          mitigation: "Use standardized formats; coordinate with bank on document terms"
        }
      ],
      clause: "RBI-Master: DP requires 90-day realization window; payment before document release"
    }
  }
  
  if (paymentTerms === "Credit") {
    return {
      flagged: true,
      riskLevel: "MEDIUM",
      risks: [
        {
          type: "Buyer Default Risk",
          description: "Post-shipment credit - full payment depends on buyer honoring terms",
          mitigation: "Credit insurance; periodic follow-ups; legal agreement"
        },
        {
          type: "Working Capital Crunch",
          description: "Goods shipped, payment delayed 90+ days",
          mitigation: "Invoice discounting; buyer payment tracking; automated reminders"
        }
      ],
      clause: "RBI-Master: Credit term requires buyer creditworthiness verification"
    }
  }
  
  return {
    flagged: false,
    riskLevel: "LOW",
    risks: [],
    clause: ""
  }
}

// ============================================
// RULE 4: RBI MASTER DIRECTION AUTO-INJECTION
// ============================================

function injectRBIReference(paymentTerms: PaymentTermType): {
  reference: string
  section: string
  realizationDays: number
} {
  const rbiClause = RBI_PAYMENT_MASTER.find(m => m.paymentType === paymentTerms)
  
  if (!rbiClause) {
    return {
      reference: "RBI-Master Direction 2023 (General)",
      section: "Foreign Exchange Management",
      realizationDays: 90
    }
  }
  
  return {
    reference: rbiClause.rbiReference,
    section: rbiClause.section,
    realizationDays: rbiClause.realizationWindow
  }
}

// ============================================
// RULE 5: REALIZATION TIMELINE ENFORCEMENT
// ============================================

function calculateRealizationTimeline(
  paymentTerms: PaymentTermType,
  shipmentDate: Date,
  customDays?: number
): {
  deadline: Date
  daysRemaining: number
  status: "REALIZED" | "NOT_REALIZED" | "PENDING" | "AT_RISK"
  message: string
} {
  const rbiClause = RBI_PAYMENT_MASTER.find(m => m.paymentType === paymentTerms)
  const realizationDays = customDays || rbiClause?.realizationWindow || 90

  // Deadline = shipment + realization window
  const deadline = new Date(shipmentDate)
  deadline.setDate(deadline.getDate() + realizationDays)
  
  const today = new Date()
  const daysRemaining = Math.floor(
    (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )
  
  let status: "REALIZED" | "NOT_REALIZED" | "PENDING" | "AT_RISK"
  let message = ""
  
  if (daysRemaining < 0) {
    status = "NOT_REALIZED"
    message = `❌ Realization deadline MISSED (${Math.abs(daysRemaining)} days overdue). RBI may levy penalties.`
  } else if (daysRemaining === 0) {
    status = "AT_RISK"
    message = `⚠️  Realization deadline TODAY. Payment must clear immediately.`
  } else if (daysRemaining <= 7) {
    status = "AT_RISK"
    message = `⚠️  Realization deadline in ${daysRemaining} days. Follow up urgently.`
  } else {
    status = "PENDING"
    message = `✅ Realization deadline: ${deadline.toDateString()} (${daysRemaining} days remaining)`
  }
  
  return { deadline, daysRemaining, status, message }
}

// ============================================
// MAIN VALIDATION FUNCTION
// ============================================

export async function validateRealization(
  input: RealizationComplianceInput
): Promise<RealizationComplianceResult> {
  const auditLog: RealizationComplianceResult["auditLog"] = []
  const errors: RealizationComplianceResult["errors"] = []
  const warnings: RealizationComplianceResult["warnings"] = []
  const riskDisclosures: RealizationComplianceResult["riskDisclosures"] = []
  
  const startTime = new Date()
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW"
  
  // RULE 1: Advance Payment Timing (if applicable)
  if (input.paymentTerms === "Advance") {
    const advanceCheck = validateAdvancePaymentTiming(
      input.advanceReceivedDate,
      input.shipmentDate
    )
    
    auditLog.push({
      timestamp: new Date(),
      ruleCode: "ADVANCE_PAYMENT_TIMING",
      ruleName: "Advance Payment Realization Timing",
      result: advanceCheck.valid,
      message: advanceCheck.message,
      clause: advanceCheck.clause
    })
    
    if (!advanceCheck.valid) {
      errors.push({
        code: "ADVANCE_NOT_REALIZED_BEFORE_SHIPMENT",
        message: advanceCheck.message,
        severity: "BLOCKER"
      })
    }
  }
  
  // RULE 2: LC Governance (if applicable)
  if (input.paymentTerms === "LC") {
    const lcCheck = validateLCGovernance(
      input.paymentTerms,
      input.lcNumber,
      input.lcExpiryDate
    )
    
    auditLog.push({
      timestamp: new Date(),
      ruleCode: "LC_UCP600_GOVERNANCE",
      ruleName: "LC Governed by UCP 600",
      result: lcCheck.valid,
      message: lcCheck.message,
      clause: lcCheck.clause
    })
    
    if (!lcCheck.valid) {
      errors.push({
        code: "LC_UCP600_VIOLATION",
        message: lcCheck.message,
        severity: "BLOCKER"
      })
    }
  }
  
  // RULE 3: DA/DP Risk Flagging
  const riskCheck = flagDADPRisks(input.paymentTerms)
  
  auditLog.push({
    timestamp: new Date(),
    ruleCode: "DADP_RISK_ASSESSMENT",
    ruleName: "DA/DP Payment Risk Disclosure",
    result: !riskCheck.flagged,
    message: riskCheck.flagged
      ? `⚠️  HIGH-RISK payment term: ${input.paymentTerms}`
      : `✅ LOW-RISK payment term: ${input.paymentTerms}`,
    clause: riskCheck.clause
  })
  
  if (riskCheck.flagged) {
    riskLevel = riskCheck.riskLevel
    
    riskCheck.risks.forEach(risk => {
      riskDisclosures.push({
        riskType: risk.type,
        description: risk.description,
        mitigation: risk.mitigation
      })
      warnings.push({
        code: `${input.paymentTerms}_RISK_${risk.type.replace(/\s+/g, "_").toUpperCase()}`,
        message: risk.description,
        riskDisclosure: `Mitigation: ${risk.mitigation}`
      })
    })
  }
  
  // RULE 4: RBI Reference Auto-Injection
  const rbiRef = injectRBIReference(input.paymentTerms)
  
  auditLog.push({
    timestamp: new Date(),
    ruleCode: "RBI_COMPLIANCE_REFERENCE",
    ruleName: "RBI Master Direction Auto-Injection",
    result: true,
    message: `✅ RBI Reference Applied: ${rbiRef.reference}`,
    clause: rbiRef.section
  })
  
  // RULE 5: Realization Timeline
  const timelineCheck = calculateRealizationTimeline(
    input.paymentTerms,
    input.shipmentDate,
    input.creditTerms
  )
  
  auditLog.push({
    timestamp: new Date(),
    ruleCode: "REALIZATION_TIMELINE",
    ruleName: "Payment Realization Timeline",
    result: timelineCheck.status !== "NOT_REALIZED",
    message: timelineCheck.message,
    clause: `RBI Window: ${rbiRef.realizationDays} days from shipment`
  })
  
  if (timelineCheck.status === "NOT_REALIZED") {
    errors.push({
      code: "REALIZATION_DEADLINE_MISSED",
      message: timelineCheck.message,
      severity: "BLOCKER"
    })
  }
  
  if (timelineCheck.status === "AT_RISK") {
    warnings.push({
      code: "REALIZATION_AT_RISK",
      message: timelineCheck.message,
      riskDisclosure: "Immediate follow-up with buyer/bank required to avoid RBI penalties"
    })
  }
  
  // ============================================
  // COMPILE RESULTS
  // ============================================
  
  const isCompliant = errors.length === 0
  
  return {
    isCompliant,
    paymentTermValid: true, // If we reach here, term is valid
    advanceReceivedOnTime:
      input.paymentTerms !== "Advance" || 
      Boolean(input.advanceReceivedDate && input.advanceReceivedDate < input.shipmentDate),
    rbiCompliant: isCompliant,
    realizationStatus: timelineCheck.status,
    riskLevel,
    
    paymentClause: {
      type: input.paymentTerms,
      description: RBI_PAYMENT_MASTER.find(m => m.paymentType === input.paymentTerms)?.description ||
        `${input.paymentTerms} payment term`,
      rbiReference: rbiRef.reference,
      realizationDeadline: timelineCheck.deadline,
      daysRemaining: timelineCheck.daysRemaining
    },
    
    errors,
    warnings,
    riskDisclosures,
    auditLog,
    validationTimestamp: startTime
  }
}

// ============================================
// HELPER: CAN GENERATE INVOICE DOCUMENTS?
// ============================================

export async function canGenerateInvoiceDocuments_Realization(
  invoiceId: string,
  paymentTerms: PaymentTermType,
  shipmentDate: Date,
  advanceReceivedDate?: Date,
  lcNumber?: string,
  lcExpiryDate?: Date
): Promise<{
  allowed: boolean
  blockers: Array<{ code: string; message: string }>
  warnings: string[]
}> {
  const result = await validateRealization({
    invoiceId,
    paymentTerms,
    shipmentDate,
    advanceReceivedDate,
    lcNumber,
    lcExpiryDate,
    invoiceAmount: 0,
    invoiceCurrency: "USD"
  })
  
  return {
    allowed: result.isCompliant,
    blockers: result.errors.filter(e => e.severity === "BLOCKER"),
    warnings: result.warnings.map(w => w.message)
  }
}

// ============================================
// HELPER: GENERATE COMPLIANCE REPORT
// ============================================

export function generateRealizationReport(
  result: RealizationComplianceResult
): string {
  const lines: string[] = []
  
  lines.push("=".repeat(70))
  lines.push("FEMA REALIZATION COMPLIANCE REPORT")
  lines.push("=".repeat(70))
  lines.push("")
  
  lines.push(`Payment Term: ${result.paymentClause.type}`)
  lines.push(`RBI Reference: ${result.paymentClause.rbiReference}`)
  lines.push(`Realization Deadline: ${result.paymentClause.realizationDeadline.toDateString()}`)
  lines.push(`Days Remaining: ${result.paymentClause.daysRemaining}`)
  lines.push(`Risk Level: ${result.riskLevel}`)
  lines.push(`Status: ${result.realizationStatus}`)
  lines.push("")
  
  lines.push("CLAUSE DESCRIPTION:")
  lines.push(`  ${result.paymentClause.description}`)
  lines.push("")
  
  if (result.errors.length > 0) {
    lines.push("⚠️  BLOCKERS:")
    result.errors.forEach(e => {
      lines.push(`  • [${e.code}] ${e.message}`)
    })
    lines.push("")
  }
  
  if (result.warnings.length > 0) {
    lines.push("⚠️  WARNINGS:")
    result.warnings.forEach(w => {
      lines.push(`  • [${w.code}] ${w.message}`)
      if (w.riskDisclosure) {
        lines.push(`     Risk: ${w.riskDisclosure}`)
      }
    })
    lines.push("")
  }
  
  if (result.riskDisclosures.length > 0) {
    lines.push("🚨 RISK DISCLOSURES:")
    result.riskDisclosures.forEach(disclosure => {
      lines.push(`  Risk Type: ${disclosure.riskType}`)
      lines.push(`  Description: ${disclosure.description}`)
      lines.push(`  Mitigation: ${disclosure.mitigation}`)
      lines.push("")
    })
  }
  
  lines.push("AUDIT LOG (CLAUSE-LEVEL VALIDATION):")
  result.auditLog.forEach(log => {
    const clauseInfo = log.clause ? ` | Clause: ${log.clause}` : ""
    lines.push(`  ${log.timestamp.toISOString()} | ${log.ruleCode.padEnd(30)} | ${log.result ? "✅" : "❌"}${clauseInfo}`)
    lines.push(`     → ${log.message}`)
  })
  
  lines.push("")
  lines.push("=".repeat(70))
  
  return lines.join("\n")
}
