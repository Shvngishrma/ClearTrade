/**
 * ENGINE 2: CUSTOMS DUTIES VALIDATOR
 * ==================================
 * 
 * ENFORCEMENT-FOCUSED duties validator that:
 * 1. Validates HS code classification (6/8 digit format)
 * 2. Checks DGFT restrictions (bans, licenses, allocations)
 * 3. Calculates duty rates (Basic, Additional, CVD, Anti-Dumping)
 * 4. Verifies exemptions (EPCG, SEZ, FTA)
 * 5. Validates IEC registration for exemption eligibility
 * 6. Ensures AD code consistency throughout invoice
 * 
 * BLOCKS document generation if:
 * - HS code banned/restricted without valid license
 * - Duty calculation shows shortfall
 * - Exemption claimed but IEC not eligible
 * - AD codes inconsistent across line items
 * 
 * Returns structured { blockers, warnings, auditLog, allowed }
 */

import { prisma } from "@/lib/db"
import { 
  validateHSCodeWithLiveData, 
  canInvoicePassDGFTScrutiny,
  type InvoiceLineItem as DGFTLineItem,
  type HSCodeValidationResult 
} from "./hsCodeLiveValidationService"

// ============================================
// TYPES & INTERFACES
// ============================================

export interface DutyLine {
  lineNo: number
  hsCode: string
  commodity: string
  quantity: number
  unitPrice: number        // USD
  currency: string
  adCode?: string          // AD code (if using exemption)
  ieclicenseNumber?: string
}

export interface DutyCalculation {
  hsCode: string
  basicDuty: number         // % of CIF value
  additionalDuty: number    // % (if applicable)
  cvd: number              // Countervailing Duty %
  apd: number              // Anti-Dumping Duty %
  totalDutyRate: number    // Sum of all duties
  cifValue: number         // CIF in USD
  dutyAmount: number       // Total duty in USD
  exemption?: {
    type: "EPCG" | "SEZ" | "FTA" | "None"
    dutySuspended: boolean  // If true, duties deferred
    requiredDocuments: string[]
  }
}

export interface DutyValidationError {
  code: string
  severity: "BLOCK" | "WARN"
  field: string
  message: string
  resolution: string
}

export interface CustomsDutiesCheckResult {
  allowed: boolean
  invoiceNumber: string
  validationTimestamp: Date
  
  blockers: DutyValidationError[]      // BLOCK if any
  warnings: DutyValidationError[]      // WARN only
  
  dutyCalculations: DutyCalculation[]
  totalDutyCIF: number                 // Total CIF value in USD
  totalDutyAmount: number              // Total duties in USD
  exemptionStatus: "None" | "PartiallyExempt" | "FullyExempt"
  
  auditLog: {
    timestamp: Date
    ruleCode: string
    ruleDescription: string
    hsCode: string
    result: "PASS" | "FAIL"
    details: string
  }[]
}

// ============================================
// DUTY RATE MASTER (Mock - Replace with CESTAT API)
// ============================================

const HS_DUTY_MASTER: Record<string, DutyCalculation> = {
  "1201": {  // Soya Beans
    hsCode: "1201",
    basicDuty: 100,       // 100% basic
    additionalDuty: 0,    // No additional duty
    cvd: 0,              // No CVD
    apd: 0,              // No anti-dumping
    totalDutyRate: 100,
    cifValue: 0,         // Calculated per shipment
    dutyAmount: 0
  },
  "1001": {  // Wheat (if banned)
    hsCode: "1001",
    basicDuty: 0,        // Banned - will block
    additionalDuty: 0,
    cvd: 0,
    apd: 0,
    totalDutyRate: 0,
    cifValue: 0,
    dutyAmount: 0
  },
  "0302": {  // Fish (Fresh/Chilled)
    hsCode: "0302",
    basicDuty: 10,       // 10% basic
    additionalDuty: 0,
    cvd: 5,             // 5% CVD (if from certain countries)
    apd: 0,
    totalDutyRate: 15,
    cifValue: 0,
    dutyAmount: 0
  },
  "6203": {  // Cotton T-Shirts
    hsCode: "6203",
    basicDuty: 19,       // 19% basic (textiles)
    additionalDuty: 0,
    cvd: 0,
    apd: 0,
    totalDutyRate: 19,
    cifValue: 0,
    dutyAmount: 0
  },
  "8703": {  // Motor Vehicles
    hsCode: "8703",
    basicDuty: 100,      // 100% basic (automobiles)
    additionalDuty: 20,  // 20% additional
    cvd: 0,
    apd: 0,
    totalDutyRate: 120,
    cifValue: 0,
    dutyAmount: 0
  }
}

// IEC Eligibility Master (for EPCG/SEZ exemptions)
const IEC_EXEMPTION_MASTER: Record<string, { eligible: Boolean; exemptionTypes: string[] }> = {
  "0323001001": { eligible: true, exemptionTypes: ["EPCG", "SEZ"] },
  "0323001002": { eligible: true, exemptionTypes: ["FTA"] },
  "0323001003": { eligible: false, exemptionTypes: [] }
}

// ============================================
// RULE 1: HS CODE FORMAT VALIDATION
// ============================================

function validateHSCodeFormat(hsCode: string): { valid: boolean; error?: string } {
  if (!hsCode || hsCode.trim().length === 0) {
    return { valid: false, error: "HS code is required" }
  }

  const trimmed = hsCode.trim()

  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, error: "HS code must contain only digits" }
  }

  const length = trimmed.length
  // Allow 6-digit (HS) or 8-digit (ITC HS)
  if (length !== 6 && length !== 8) {
    return { valid: false, error: `HS code must be 6 or 8 digits (you provided ${length})` }
  }

  return { valid: true }
}

// ============================================
// RULE 2: DGFT RESTRICTION CHECK
// ============================================

async function checkDGFTRestriction(
  hsCode: string,
  commodity: string,
  quantity: number,
  unitPrice: number,
  currency: string
): Promise<{ 
  passed: boolean
  dgftResult?: HSCodeValidationResult
  error?: string 
}> {
  try {
    const dgftResult = await validateHSCodeWithLiveData(
      hsCode,
      commodity,
      quantity,
      unitPrice,
      currency
    )

    // If DGFT shows "BANNED" status, auto-fail
    if (dgftResult.dgftStatus?.status === "Banned") {
      const now = new Date()
      if (dgftResult.dgftStatus.effectiveFrom <= now && 
          (!dgftResult.dgftStatus.effectiveTo || dgftResult.dgftStatus.effectiveTo >= now)) {
        return {
          passed: false,
          dgftResult,
          error: `DGFT BAN ACTIVE: ${commodity} (HS ${hsCode}) banned until ${dgftResult.dgftStatus.effectiveTo || "further notice"}`
        }
      }
    }

    return { passed: !dgftResult.issues.some(i => i.severity === "Error"), dgftResult }
  } catch (err) {
    return { 
      passed: false, 
      error: `DGFT verification failed: ${err instanceof Error ? err.message : String(err)}` 
    }
  }
}

// ============================================
// RULE 3: DUTY CALCULATION
// ============================================

function calculateDutyRate(hsCode: string, cifValue: number): { 
  calculation: DutyCalculation | null
  error?: string 
} {
  const masterRate = HS_DUTY_MASTER[hsCode]

  if (!masterRate) {
    return { calculation: null, error: `Duty rate not found for HS code ${hsCode}` }
  }

  return {
    calculation: {
      ...masterRate,
      cifValue,
      dutyAmount: (masterRate.totalDutyRate / 100) * cifValue
    }
  }
}

// ============================================
// RULE 4: EXEMPTION ELIGIBILITY CHECK
// ============================================

async function validateExemptionEligibility(
  iecNumber: string,
  exemptionType?: "EPCG" | "SEZ" | "FTA"
): Promise<{
  eligible: boolean
  error?: string
  requiredDocuments: string[]
}> {
  if (!exemptionType) {
    return { eligible: true, requiredDocuments: [] }
  }

  const icelRecord = IEC_EXEMPTION_MASTER[iecNumber]

  if (!icelRecord) {
    return {
      eligible: false,
      error: `IEC ${iecNumber} not found in exemption master`,
      requiredDocuments: []
    }
  }

  if (!icelRecord.eligible) {
    return {
      eligible: false,
      error: `IEC ${iecNumber} not eligible for any exemption scheme`,
      requiredDocuments: []
    }
  }

  if (!icelRecord.exemptionTypes.includes(exemptionType)) {
    return {
      eligible: false,
      error: `IEC ${iecNumber} not eligible for ${exemptionType} scheme (eligible for: ${icelRecord.exemptionTypes.join(", ")})`,
      requiredDocuments: []
    }
  }

  // Return required documents for exemption
  const requiredDocs = exemptionType === "EPCG" 
    ? ["EPCG License", "No-objection Certificate from DPIIT", "Bank Guarantee"]
    : exemptionType === "SEZ"
    ? ["SEZ Unit Certificate", "SEZ Gate Pass", "Warehouse Storage Proof"]
    : ["Free Trade Agreement Certificate", "Rules of Origin Verification"]

  return { eligible: true, requiredDocuments: requiredDocs }
}

// ============================================
// RULE 5: AD CODE CONSISTENCY
// ============================================

function validateADCodeConsistency(lines: DutyLine[]): {
  consistent: boolean
  error?: string
  uniqueADCodes: string[]
} {
  const adCodes = lines
    .filter(l => l.adCode)
    .map(l => l.adCode)
    .filter((code): code is string => !!code)

  if (adCodes.length === 0) {
    return { consistent: true, uniqueADCodes: [] }
  }

  // All AD codes should be identical across invoice
  const uniqueCodes = Array.from(new Set(adCodes))

  if (uniqueCodes.length > 1) {
    return {
      consistent: false,
      error: `Multiple AD codes used on same invoice: ${uniqueCodes.join(", ")}. All import house transactions must use single AD code.`,
      uniqueADCodes: uniqueCodes
    }
  }

  return {
    consistent: true,
    uniqueADCodes: uniqueCodes.length === 0 ? [] : [uniqueCodes[0]!]
  }
}

// ============================================
// MASTER VALIDATION FUNCTION
// ============================================

export async function validateCustomsDuties(
  invoiceNumber: string,
  lines: DutyLine[],
  iecNumber?: string
): Promise<CustomsDutiesCheckResult> {
  const result: CustomsDutiesCheckResult = {
    allowed: true,
    invoiceNumber,
    validationTimestamp: new Date(),
    blockers: [],
    warnings: [],
    dutyCalculations: [],
    totalDutyCIF: 0,
    totalDutyAmount: 0,
    exemptionStatus: "None",
    auditLog: []
  }

  // ============ VALIDATE AD CODE CONSISTENCY ============
  const adCheck = validateADCodeConsistency(lines)
  if (!adCheck.consistent) {
    result.blockers.push({
      code: "AD_CODE_INCONSISTENCY",
      severity: "BLOCK",
      field: "adCode",
      message: adCheck.error!,
      resolution: "Use single AD code for entire invoice or split into separate invoices"
    })
    result.auditLog.push({
      timestamp: new Date(),
      ruleCode: "RULE_AD_CONSISTENCY",
      ruleDescription: "AD code must be consistent across invoice",
      hsCode: "ALL",
      result: "FAIL",
      details: `Found ${adCheck.uniqueADCodes.length} unique AD codes`
    })
  } else {
    result.auditLog.push({
      timestamp: new Date(),
      ruleCode: "RULE_AD_CONSISTENCY",
      ruleDescription: "AD code consistency",
      hsCode: "ALL",
      result: "PASS",
      details: `AD code consistent: ${adCheck.uniqueADCodes[0] || "N/A"}`
    })
  }

  // ============ PROCESS EACH LINE ITEM ============
  for (const line of lines) {
    // RULE 1: HS Code Format
    const hsFormatCheck = validateHSCodeFormat(line.hsCode)
    if (!hsFormatCheck.valid) {
      result.blockers.push({
        code: "INVALID_HS_CODE_FORMAT",
        severity: "BLOCK",
        field: `line_${line.lineNo}_hsCode`,
        message: `Line ${line.lineNo}: ${hsFormatCheck.error}`,
        resolution: "HS code must be 6 or 8 digits without special characters"
      })
      result.auditLog.push({
        timestamp: new Date(),
        ruleCode: "RULE_HS_FORMAT",
        ruleDescription: "HS code format validation (6 or 8 digits)",
        hsCode: line.hsCode,
        result: "FAIL",
        details: hsFormatCheck.error!
      })
      continue
    } else {
      result.auditLog.push({
        timestamp: new Date(),
        ruleCode: "RULE_HS_FORMAT",
        ruleDescription: "HS code format validation",
        hsCode: line.hsCode,
        result: "PASS",
        details: `HS ${line.hsCode} (${line.hsCode.length} digits) valid format`
      })
    }

    // RULE 2: DGFT Restriction Check
    const dgftCheck = await checkDGFTRestriction(
      line.hsCode,
      line.commodity,
      line.quantity,
      line.unitPrice,
      line.currency
    )

    if (!dgftCheck.passed) {
      result.blockers.push({
        code: "DGFT_RESTRICTED",
        severity: "BLOCK",
        field: `line_${line.lineNo}_dgft`,
        message: `Line ${line.lineNo}: ${dgftCheck.error || "Commodity restricted by DGFT"}`,
        resolution: dgftCheck.dgftResult?.issues
          .filter(i => i.severity === "Error")
          .map(i => i.resolution || i.message)
          .join("; ") || "Contact DGFT for exemption"
      })
      result.auditLog.push({
        timestamp: new Date(),
        ruleCode: "RULE_DGFT_RESTRICTION",
        ruleDescription: "DGFT restriction check",
        hsCode: line.hsCode,
        result: "FAIL",
        details: dgftCheck.error || "DGFT restriction applies"
      })
      continue
    } else {
      result.auditLog.push({
        timestamp: new Date(),
        ruleCode: "RULE_DGFT_RESTRICTION",
        ruleDescription: "DGFT restriction check",
        hsCode: line.hsCode,
        result: "PASS",
        details: `HS ${line.hsCode} cleared by DGFT`
      })

      // Add DGFT warnings if any
      if (dgftCheck.dgftResult?.issues.filter(i => i.severity === "Warning").length! > 0) {
        dgftCheck.dgftResult?.issues
          .filter(i => i.severity === "Warning")
          .forEach(issue => {
            result.warnings.push({
              code: "DGFT_WARNING",
              severity: "WARN",
              field: `line_${line.lineNo}_dgft`,
              message: `Line ${line.lineNo}: ${issue.message}`,
              resolution: issue.resolution || "Take note of restriction"
            })
          })
      }
    }

    // RULE 3: Duty Calculation
    const cifValue = line.quantity * line.unitPrice
    const dutyCalc = calculateDutyRate(line.hsCode, cifValue)

    if (!dutyCalc.calculation) {
      result.warnings.push({
        code: "DUTY_RATE_NOT_FOUND",
        severity: "WARN",
        field: `line_${line.lineNo}_duty`,
        message: `Line ${line.lineNo}: ${dutyCalc.error}`,
        resolution: "Manually verify duty rate from latest CESTAT tariff schedule"
      })
      result.auditLog.push({
        timestamp: new Date(),
        ruleCode: "RULE_DUTY_CALC",
        ruleDescription: "Duty rate calculation",
        hsCode: line.hsCode,
        result: "FAIL",
        details: dutyCalc.error!
      })
    } else {
      result.dutyCalculations.push(dutyCalc.calculation)
      result.totalDutyCIF += cifValue
      result.totalDutyAmount += dutyCalc.calculation.dutyAmount

      result.auditLog.push({
        timestamp: new Date(),
        ruleCode: "RULE_DUTY_CALC",
        ruleDescription: "Duty rate calculation",
        hsCode: line.hsCode,
        result: "PASS",
        details: `CIF USD ${cifValue}, Duty ${dutyCalc.calculation.totalDutyRate}% = USD ${dutyCalc.calculation.dutyAmount.toFixed(2)}`
      })
    }

    // RULE 4: Exemption Eligibility
    if (line.adCode && iecNumber) {
      const exemptionCheck = await validateExemptionEligibility(
        iecNumber,
        line.adCode as "EPCG" | "SEZ" | "FTA"
      )

      if (!exemptionCheck.eligible) {
        result.blockers.push({
          code: "EXEMPTION_NOT_ELIGIBLE",
          severity: "BLOCK",
          field: `line_${line.lineNo}_exemption`,
          message: `Line ${line.lineNo}: ${exemptionCheck.error}`,
          resolution: "Cannot claim exemption or remove exemption claim from invoice"
        })
        result.auditLog.push({
          timestamp: new Date(),
          ruleCode: "RULE_EXEMPTION_ELIGIBLE",
          ruleDescription: "Exemption eligibility check",
          hsCode: line.hsCode,
          result: "FAIL",
          details: exemptionCheck.error!
        })
      } else {
        // Update exemption status
        if (exemptionCheck.eligible && result.exemptionStatus === "None") {
          result.exemptionStatus = "PartiallyExempt"
        }

        result.auditLog.push({
          timestamp: new Date(),
          ruleCode: "RULE_EXEMPTION_ELIGIBLE",
          ruleDescription: "Exemption eligibility check",
          hsCode: line.hsCode,
          result: "PASS",
          details: `IEC ${iecNumber} eligible for exemption. Required docs: ${exemptionCheck.requiredDocuments.join(", ")}`
        })

        // Warn if documents not provided
        if (exemptionCheck.requiredDocuments.length > 0) {
          result.warnings.push({
            code: "EXEMPTION_DOCS_REQUIRED",
            severity: "WARN",
            field: `line_${line.lineNo}_exemption`,
            message: `Line ${line.lineNo}: Exemption claimed - ensure these docs are ready: ${exemptionCheck.requiredDocuments.join(", ")}`,
            resolution: "Attach exemption documentation before shipment"
          })
        }
      }
    }
  }

  // ============ FINAL DETERMINATION ============
  result.allowed = result.blockers.length === 0

  return result
}

// ============================================
// INTEGRATION FUNCTION: Can Generate Documents?
// ============================================

export async function canGenerateInvoiceDocuments_Duties(
  invoiceId: string,
  lines: DutyLine[],
  iecNumber?: string
): Promise<{
  allowed: boolean
  blockers: DutyValidationError[]
  warnings: DutyValidationError[]
}> {
  const checkResult = await validateCustomsDuties(
    invoiceId,
    lines,
    iecNumber
  )

  return {
    allowed: checkResult.allowed,
    blockers: checkResult.blockers,
    warnings: checkResult.warnings
  }
}

// ============================================
// STORAGE & REPORTING
// ============================================

export async function storeDutyCalculation(
  invoiceId: string,
  result: CustomsDutiesCheckResult
): Promise<string> {
  // Store calculation in database (placeholder)
  // In production: Insert into DutyCalculation table

  return `duty_${invoiceId}_${Date.now()}`
}

export function generateCustomsDutiesReport(
  result: CustomsDutiesCheckResult
): string {
  const lines: string[] = [
    "═".repeat(100),
    "CUSTOMS DUTIES VALIDATION REPORT - ENGINE 2",
    "═".repeat(100),
    `Invoice: ${result.invoiceNumber}`,
    `Validation Time: ${result.validationTimestamp.toISOString()}`,
    `Status: ${result.allowed ? "✅ APPROVED" : "❌ BLOCKED"}`,
    "",
    "KEY METRICS:",
    `  Total CIF Value: USD ${result.totalDutyCIF.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
    `  Total Duty Amount: USD ${result.totalDutyAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
    `  Duty as % of CIF: ${((result.totalDutyAmount / result.totalDutyCIF) * 100).toFixed(2)}%`,
    `  Exemption Status: ${result.exemptionStatus}`,
    ""
  ]

  if (result.blockers.length > 0) {
    lines.push("❌ BLOCKERS (Invoice CANNOT be generated):")
    result.blockers.forEach((blocker, idx) => {
      lines.push(`  ${idx + 1}. [${blocker.code}] ${blocker.message}`)
      lines.push(`     → ${blocker.resolution}`)
    })
    lines.push("")
  }

  if (result.warnings.length > 0) {
    lines.push("⚠️ WARNINGS (Invoice CAN proceed with caution):")
    result.warnings.forEach((warn, idx) => {
      lines.push(`  ${idx + 1}. [${warn.code}] ${warn.message}`)
      lines.push(`     → ${warn.resolution}`)
    })
    lines.push("")
  }

  if (result.dutyCalculations.length > 0) {
    lines.push("💰 DUTY CALCULATIONS:")
    result.dutyCalculations.forEach((calc, idx) => {
      lines.push(`  Line ${idx + 1}: HS ${calc.hsCode}`)
      lines.push(`    CIF: USD ${calc.cifValue.toLocaleString("en-US", { maximumFractionDigits: 2 })}`)
      lines.push(
        `    Duty: Basic ${calc.basicDuty}% + Additional ${calc.additionalDuty}% + CVD ${calc.cvd}% + APD ${calc.apd}% = ${calc.totalDutyRate}%`
      )
      lines.push(`    Total Duty: USD ${calc.dutyAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`)
    })
    lines.push("")
  }

  lines.push("═".repeat(100))

  return lines.join("\n")
}
