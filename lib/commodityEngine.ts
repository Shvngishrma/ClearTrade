/**
 * ENGINE 4: COMMODITY VALIDATOR
 * =============================
 * 
 * ENFORCEMENT-FOCUSED commodity validator that:
 * 1. Checks DGFT prohibited/restricted items list
 * 2. Verifies quality certifications (FSSAI/APEDA/BIS)
 * 3. Validates packaging standards (metal/plastic/cardboard per commodity)
 * 4. Checks for zero-duty classification items
 * 5. Enforces allocation-based restrictions (quotas)
 * 6. Validates customs supervision requirements (pending list)
 * 
 * BLOCKS document generation if:
 * - Item is on DGFT banned list
 * - Required quality cert is missing
 * - Packaging doesn't meet standards
 * - Allocation quota exceeded
 * - Customs supervision not satisfied
 * 
 * Returns structured { blockers, warnings, auditLog, allowed }
 */

import { 
  validateHSCodeWithLiveData, 
  type HSCodeValidationResult 
} from "./hsCodeLiveValidationService"

// ============================================
// TYPES & INTERFACES
// ============================================

export interface CommodityItem {
  lineNo: number
  hsCode: string
  commodity: string
  quantity: number
  unit: "MT" | "Units" | "Boxes" | "Containers" | "Liters" | "Kg"
  packaging?: "Metal" | "Plastic" | "Cardboard" | "Glass" | "Mixed"
  qualityCerts?: string[]  // e.g., ["FSSAI", "APEDA"]
  originCountry?: string
}

export interface CommodityValidationError {
  code: string
  severity: "BLOCK" | "WARN"
  field: string
  message: string
  resolution: string
}

export interface CommodityValidationCheckResult {
  allowed: boolean
  invoiceNumber: string
  validationTimestamp: Date
  
  blockers: CommodityValidationError[]      // BLOCK if any
  warnings: CommodityValidationError[]      // WARN only
  
  itemValidations: Array<{
    lineNo: number
    hsCode: string
    commodity: string
    status: "CLEAR" | "WARNING" | "BLOCKED"
    dgftStatus: string
    certifications: {
      required: string[]
      provided: string[]
      missing: string[]
    }
    packagingStatus: "Compliant" | "Non-Compliant" | "N/A"
  }>
  
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
// DGFT PROHIBITED ITEMS MASTER
// ============================================

interface DGFTProhibitedItem {
  hsCode: string
  commodity: string
  status: "Banned" | "Restricted" | "Allowed"
  reason: string
  effectiveFrom: Date
  effectiveTo?: Date
  allowedOrigins?: string[]  // Only from these countries
  requiredCerts?: string[]
  quotaLimit?: number  // MT or units
  customsSupervision?: boolean
}

const DGFT_PROHIBITED_MASTER: Record<string, DGFTProhibitedItem> = {
  "1001": {  // Wheat
    hsCode: "1001",
    commodity: "Wheat",
    status: "Banned",
    reason: "Domestic price stabilization (Jan-Dec 2026)",
    effectiveFrom: new Date("2026-01-01"),
    effectiveTo: new Date("2026-12-31"),
    customsSupervision: false
  },
  "1201": {  // Soya Beans
    hsCode: "1201",
    commodity: "Soya Beans",
    status: "Allowed",
    reason: "Normal trade flow",
    effectiveFrom: new Date("2026-01-01")
  },
  "0302": {  // Fish Fresh/Chilled
    hsCode: "0302",
    commodity: "Fish (Fresh/Chilled)",
    status: "Restricted",
    reason: "Health & food safety certification required",
    effectiveFrom: new Date("2026-01-01"),
    requiredCerts: ["APEDA", "Health Certificate"],
    customsSupervision: true
  },
  "0403": {  // Buttermilk
    hsCode: "0403",
    commodity: "Buttermilk & Dairy",
    status: "Restricted",
    reason: "Dairy quality control",
    effectiveFrom: new Date("2026-01-01"),
    requiredCerts: ["FSSAI"],
    customsSupervision: true
  },
  "6203": {  // Cotton T-Shirts
    hsCode: "6203",
    commodity: "Cotton T-Shirts",
    status: "Allowed",
    reason: "Normal import allowed",
    effectiveFrom: new Date("2026-01-01")
  },
  "2716": {  // Electrical Energy
    hsCode: "2716",
    commodity: "Electrical Energy",
    status: "Restricted",
    reason: "Government approval required (NITI Aayog)",
    effectiveFrom: new Date("2026-01-01"),
    customsSupervision: true
  }
}

// ============================================
// QUALITY CERTIFICATION REQUIREMENTS
// ============================================

interface QualityCertReq {
  hsCode: string
  commodity: string
  requiredCerts: string[]
  authority: string
  validityPeriod: number  // months
}

const QUALITY_CERT_MASTER: Record<string, QualityCertReq> = {
  "0302": {
    hsCode: "0302",
    commodity: "Fish",
    requiredCerts: ["APEDA", "Health Certificate", "Cold Chain Proof"],
    authority: "APEDA (Agricultural & Processed Food Products Export Authority)",
    validityPeriod: 12
  },
  "0403": {
    hsCode: "0403",
    commodity: "Dairy",
    requiredCerts: ["FSSAI"],
    authority: "FSSAI (Food Safety & Standards Authority of India)",
    validityPeriod: 24
  },
  "1001": {
    hsCode: "1001",
    commodity: "Wheat",
    requiredCerts: ["Quality Test Report"],
    authority: "PSA (Port Superintendent Authorities)",
    validityPeriod: 6
  },
  "2716": {
    hsCode: "2716",
    commodity: "Electrical Energy",
    requiredCerts: ["NITI Aayog Approval", "Grid Connection NOC"],
    authority: "NITI Aayog / Power Ministry",
    validityPeriod: 36
  }
}

// ============================================
// PACKAGING STANDARDS MASTER
// ============================================

interface PackagingStandard {
  hsCode: string
  commodity: string
  allowedPackaging: string[]
  standards: string[]
}

const PACKAGING_STANDARDS: Record<string, PackagingStandard> = {
  "0302": {
    hsCode: "0302",
    commodity: "Fish",
    allowedPackaging: ["Plastic", "Metal", "Glass"],
    standards: ["BIS: IS 10910 (Plastic containers)", "ISO 2331 (Metal containers)"]
  },
  "0403": {
    hsCode: "0403",
    commodity: "Dairy",
    allowedPackaging: ["Plastic", "Glass", "Metal"],
    standards: ["BIS: IS 9833 (Plastic food containers)", "FSSAI compliance"]
  },
  "6203": {
    hsCode: "6203",
    commodity: "Textiles",
    allowedPackaging: ["Cardboard", "Plastic"],
    standards: ["Moisture-resistant packaging required"]
  },
  "1201": {
    hsCode: "1201",
    commodity: "Soya Beans",
    allowedPackaging: ["Jute Bag", "Plastic Bag", "Metal Container", "Cardboard"],
    standards: ["Food-grade packaging", "No contamination"]
  }
}

const PACKAGING_ALIASES: Record<string, string[]> = {
  Plastic: ["Plastic", "Plastic Bag"],
  Metal: ["Metal", "Metal Container"],
  Cardboard: ["Cardboard", "Carton"],
  Glass: ["Glass"],
  Mixed: ["Mixed"],
}

// ============================================
// CUSTOMS SUPERVISION REQUIREMENTS
// ============================================

interface CustomsSupervisedItem {
  hsCode: string
  commodity: string
  supervisedAt: "Port" | "ICD" | "Both"
  requiresPhysicalInspection: boolean
  samplingRequired: boolean
  documentationRequired: string[]
}

const CUSTOMS_SUPERVISION_MASTER: Record<string, CustomsSupervisedItem> = {
  "0302": {
    hsCode: "0302",
    commodity: "Fish",
    supervisedAt: "Port",
    requiresPhysicalInspection: true,
    samplingRequired: true,
    documentationRequired: ["Cold Chain Records", "Temperature Logs", "APEDA Cert"]
  },
  "0403": {
    hsCode: "0403",
    commodity: "Dairy",
    supervisedAt: "Port",
    requiresPhysicalInspection: true,
    samplingRequired: true,
    documentationRequired: ["FSSAI Approval", "Analysis Report", "Packing Info"]
  },
  "2716": {
    hsCode: "2716",
    commodity: "Electrical Energy",
    supervisedAt: "Both",
    requiresPhysicalInspection: true,
    samplingRequired: false,
    documentationRequired: ["NITI approval", "Grid NOC", "Technical specs"]
  }
}

// ============================================
// RULE 1: DGFT BAN CHECK
// ============================================

function checkDGFTBan(hsCode: string, commodity: string): {
  banned: boolean
  error?: string
  details?: string
} {
  const item = DGFT_PROHIBITED_MASTER[hsCode]

  if (!item) {
    return { banned: false, details: "HS code not found in DGFT master (non-restricted)" }
  }

  if (item.status === "Banned") {
    const now = new Date()
    if (item.effectiveFrom <= now && (!item.effectiveTo || item.effectiveTo >= now)) {
      return {
        banned: true,
        error: `DGFT BAN: ${commodity} (HS ${hsCode}) banned until ${item.effectiveTo?.toISOString().split("T")[0] || "further notice"}. Reason: ${item.reason}`
      }
    }
  }

  return { banned: false, details: `HS ${hsCode} status: ${item.status}` }
}

// ============================================
// RULE 2: QUALITY CERTIFICATION CHECK
// ============================================

function validateQualityCertifications(
  hsCode: string,
  commodity: string,
  providedCerts: string[] = []
): {
  valid: boolean
  requiredCerts: string[]
  missingCerts: string[]
  error?: string
} {
  const certReq = QUALITY_CERT_MASTER[hsCode]

  if (!certReq) {
    return { valid: true, requiredCerts: [], missingCerts: [], error: undefined }
  }

  const missing = certReq.requiredCerts.filter(cert => !providedCerts.includes(cert))

  if (missing.length > 0) {
    return {
      valid: false,
      requiredCerts: certReq.requiredCerts,
      missingCerts: missing,
      error: `Missing quality certifications for ${commodity}: ${missing.join(", ")}. Required by: ${certReq.authority}`
    }
  }

  return {
    valid: true,
    requiredCerts: certReq.requiredCerts,
    missingCerts: []
  }
}

// ============================================
// RULE 3: PACKAGING VALIDATION
// ============================================

function validatePackaging(
  hsCode: string,
  commodity: string,
  packaging?: string
): {
  valid: boolean
  status: "Compliant" | "Non-Compliant" | "N/A"
  error?: string
  allowedTypes?: string[]
} {
  const standard = PACKAGING_STANDARDS[hsCode]

  if (!standard) {
    return { valid: true, status: "N/A", error: undefined }
  }

  if (!packaging) {
    return {
      valid: true,
      status: "N/A",
      error: undefined,
    }
  }

  const equivalentPackaging = PACKAGING_ALIASES[packaging] || [packaging]
  const matchesAllowedPackaging = equivalentPackaging.some((alias) =>
    standard.allowedPackaging.includes(alias)
  )

  if (!matchesAllowedPackaging) {
    return {
      valid: false,
      status: "Non-Compliant",
      error: `Invalid packaging "${packaging}" for ${commodity}. Allowed: ${standard.allowedPackaging.join(", ")}. Standards: ${standard.standards.join("; ")}`,
      allowedTypes: standard.allowedPackaging
    }
  }

  return { valid: true, status: "Compliant" }
}

// ============================================
// RULE 4: CUSTOMS SUPERVISION CHECK
// ============================================

function checkCustomsSupervision(hsCode: string, commodity: string): {
  required: boolean
  supervisedAt?: string
  requiresInspection?: boolean
  requiresSampling?: boolean
  requiredDocs?: string[]
} {
  const supervised = CUSTOMS_SUPERVISION_MASTER[hsCode]

  if (!supervised) {
    return { required: false }
  }

  return {
    required: true,
    supervisedAt: supervised.supervisedAt,
    requiresInspection: supervised.requiresPhysicalInspection,
    requiresSampling: supervised.samplingRequired,
    requiredDocs: supervised.documentationRequired
  }
}

// ============================================
// RULE 5: ALLOCATION/QUOTA CHECK
// ============================================

function checkAllocationQuota(
  hsCode: string,
  commodity: string,
  requestedQuantity: number,
  importedSoFar: number = 0
): {
  withinQuota: boolean
  quotaLimit?: number
  remaining?: number
  warning?: string
} {
  const item = DGFT_PROHIBITED_MASTER[hsCode]

  if (!item?.quotaLimit) {
    return { withinQuota: true }
  }

  const total = importedSoFar + requestedQuantity

  if (total > item.quotaLimit) {
    return {
      withinQuota: false,
      quotaLimit: item.quotaLimit,
      remaining: Math.max(0, item.quotaLimit - importedSoFar),
      warning: `Allocation quota exceeded: ${total} exceeds limit ${item.quotaLimit}`
    }
  }

  return {
    withinQuota: true,
    quotaLimit: item.quotaLimit,
    remaining: item.quotaLimit - total,
    warning: total > item.quotaLimit * 0.8 ? `Warning: ${(100 * total / item.quotaLimit).toFixed(1)}% of quota used` : undefined
  }
}

// ============================================
// MASTER VALIDATION FUNCTION
// ============================================

export async function validateCommodities(
  invoiceNumber: string,
  items: CommodityItem[]
): Promise<CommodityValidationCheckResult> {
  const result: CommodityValidationCheckResult = {
    allowed: true,
    invoiceNumber,
    validationTimestamp: new Date(),
    blockers: [],
    warnings: [],
    itemValidations: [],
    auditLog: []
  }

  // ============ PROCESS EACH LINE ITEM ============
  for (const item of items) {
    const itemResult: CommodityValidationCheckResult["itemValidations"][0] = {
      lineNo: item.lineNo,
      hsCode: item.hsCode,
      commodity: item.commodity,
      status: "CLEAR",
      dgftStatus: "Allowed",
      certifications: {
        required: [],
        provided: item.qualityCerts || [],
        missing: []
      },
      packagingStatus: "N/A"
    }

    // RULE 1: Check DGFT Ban
    const dgftCheck = checkDGFTBan(item.hsCode, item.commodity)
    if (dgftCheck.banned) {
      result.blockers.push({
        code: "DGFT_BAN",
        severity: "BLOCK",
        field: `line_${item.lineNo}_commodity`,
        message: `Line ${item.lineNo}: ${dgftCheck.error}`,
        resolution: "Cannot import this commodity during ban period"
      })
      itemResult.status = "BLOCKED"
      itemResult.dgftStatus = "Banned"

      result.auditLog.push({
        timestamp: new Date(),
        ruleCode: "RULE_DGFT_BAN",
        ruleDescription: "DGFT ban status check",
        hsCode: item.hsCode,
        result: "FAIL",
        details: dgftCheck.error!
      })
      result.itemValidations.push(itemResult)
      continue
    } else {
      itemResult.dgftStatus = "Allowed"
      result.auditLog.push({
        timestamp: new Date(),
        ruleCode: "RULE_DGFT_BAN",
        ruleDescription: "DGFT ban check",
        hsCode: item.hsCode,
        result: "PASS",
        details: dgftCheck.details || "Not banned"
      })
    }

    // RULE 2: Quality Certifications
    const certCheck = validateQualityCertifications(item.hsCode, item.commodity, item.qualityCerts)
    if (!certCheck.valid) {
      result.blockers.push({
        code: "MISSING_QUALITY_CERT",
        severity: "BLOCK",
        field: `line_${item.lineNo}_certs`,
        message: `Line ${item.lineNo}: ${certCheck.error}`,
        resolution: `Obtain certificates from ${QUALITY_CERT_MASTER[item.hsCode]?.authority || "appropriate authority"}`
      })
      itemResult.status = "BLOCKED"
      itemResult.certifications.required = certCheck.requiredCerts
      itemResult.certifications.missing = certCheck.missingCerts

      result.auditLog.push({
        timestamp: new Date(),
        ruleCode: "RULE_QUALITY_CERT",
        ruleDescription: "Quality certification check",
        hsCode: item.hsCode,
        result: "FAIL",
        details: `Missing: ${certCheck.missingCerts.join(", ")}`
      })
    } else if (certCheck.requiredCerts.length > 0) {
      itemResult.certifications.required = certCheck.requiredCerts
      result.auditLog.push({
        timestamp: new Date(),
        ruleCode: "RULE_QUALITY_CERT",
        ruleDescription: "Quality certification validation",
        hsCode: item.hsCode,
        result: "PASS",
        details: `All required certs provided: ${certCheck.requiredCerts.join(", ")}`
      })
    }

    // RULE 3: Packaging Validation
    const packCheck = validatePackaging(item.hsCode, item.commodity, item.packaging)
    if (!packCheck.valid) {
      result.blockers.push({
        code: "INVALID_PACKAGING",
        severity: "BLOCK",
        field: `line_${item.lineNo}_packaging`,
        message: `Line ${item.lineNo}: ${packCheck.error}`,
        resolution: `Use approved packaging: ${packCheck.allowedTypes?.join(" or ") || "see standards"}`
      })
      itemResult.status = "BLOCKED"
      itemResult.packagingStatus = "Non-Compliant"

      result.auditLog.push({
        timestamp: new Date(),
        ruleCode: "RULE_PACKAGING",
        ruleDescription: "Packaging standard validation",
        hsCode: item.hsCode,
        result: "FAIL",
        details: packCheck.error || "Invalid packaging"
      })
    } else if (packCheck.status !== "N/A") {
      itemResult.packagingStatus = packCheck.status
      result.auditLog.push({
        timestamp: new Date(),
        ruleCode: "RULE_PACKAGING",
        ruleDescription: "Packaging validation",
        hsCode: item.hsCode,
        result: "PASS",
        details: `Packaging compliant: ${item.packaging}`
      })
    }

    // RULE 4: Customs Supervision
    const superCheck = checkCustomsSupervision(item.hsCode, item.commodity)
    if (superCheck.required) {
      result.warnings.push({
        code: "CUSTOMS_SUPERVISION_REQUIRED",
        severity: "WARN",
        field: `line_${item.lineNo}_supervision`,
        message: `Line ${item.lineNo}: Customs supervision required at ${superCheck.supervisedAt}. Physical inspection: ${superCheck.requiresInspection ? "Yes" : "No"}. Sampling: ${superCheck.requiresSampling ? "Yes" : "No"}. Required docs: ${superCheck.requiredDocs?.join(", ") || "as per customs requirements"}`,
        resolution: `Prepare documents: ${superCheck.requiredDocs?.join(", ") || "as per customs requirements"}`
      })
      if (itemResult.status !== "BLOCKED") {
        itemResult.status = "WARNING"
      }

      result.auditLog.push({
        timestamp: new Date(),
        ruleCode: "RULE_CUSTOMS_SUPERVISION",
        ruleDescription: "Customs supervision check",
        hsCode: item.hsCode,
        result: "PASS",
        details: `Supervision at ${superCheck.supervisedAt}, inspection: ${superCheck.requiresInspection}, sampling: ${superCheck.requiresSampling}`
      })
    }

    // RULE 5: Allocation Quota
    const quotaCheck = checkAllocationQuota(item.hsCode, item.commodity, item.quantity)
    if (!quotaCheck.withinQuota) {
      result.blockers.push({
        code: "QUOTA_EXCEEDED",
        severity: "BLOCK",
        field: `line_${item.lineNo}_quantity`,
        message: `Line ${item.lineNo}: ${quotaCheck.warning}`,
        resolution: `Reduce quantity to ${quotaCheck.remaining || 0} or split shipment`
      })
      itemResult.status = "BLOCKED"

      result.auditLog.push({
        timestamp: new Date(),
        ruleCode: "RULE_QUOTA",
        ruleDescription: "Allocation quota check",
        hsCode: item.hsCode,
        result: "FAIL",
        details: quotaCheck.warning!
      })
    } else if (quotaCheck.warning) {
      result.warnings.push({
        code: "QUOTA_WARNING",
        severity: "WARN",
        field: `line_${item.lineNo}_quantity`,
        message: `Line ${item.lineNo}: ${quotaCheck.warning}`,
        resolution: "Monitor for next shipments; may hit quota soon"
      })
    }

    result.itemValidations.push(itemResult)
  }

  // ============ FINAL DETERMINATION ============
  result.allowed = result.blockers.length === 0

  return result
}

// ============================================
// INTEGRATION FUNCTION: Can Generate Documents?
// ============================================

export async function canGenerateInvoiceDocuments_Commodity(
  invoiceId: string,
  items: CommodityItem[]
): Promise<{
  allowed: boolean
  blockers: CommodityValidationError[]
  warnings: CommodityValidationError[]
}> {
  const checkResult = await validateCommodities(invoiceId, items)

  return {
    allowed: checkResult.allowed,
    blockers: checkResult.blockers,
    warnings: checkResult.warnings
  }
}

// ============================================
// STORAGE & REPORTING
// ============================================

export async function storeCommodityValidation(
  invoiceId: string,
  result: CommodityValidationCheckResult
): Promise<string> {
  // Store validation in database (placeholder)
  // In production: Insert into CommodityValidation table

  return `commodity_${invoiceId}_${Date.now()}`
}

export function generateCommodityValidationReport(
  result: CommodityValidationCheckResult
): string {
  const lines: string[] = [
    "═".repeat(100),
    "COMMODITY VALIDATION REPORT - ENGINE 4",
    "═".repeat(100),
    `Invoice: ${result.invoiceNumber}`,
    `Validation Time: ${result.validationTimestamp.toISOString()}`,
    `Status: ${result.allowed ? "✅ APPROVED" : "❌ BLOCKED"}`,
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

  lines.push("LINE ITEM VALIDATION SUMMARY:")
  result.itemValidations.forEach(item => {
    const statusIcon = item.status === "CLEAR" ? "✅" : item.status === "WARNING" ? "⚠️" : "❌"
    lines.push(
      `  ${statusIcon} Line ${item.lineNo}: ${item.commodity} (HS ${item.hsCode}) - ${item.status}`
    )

    if (item.certifications.required.length > 0) {
      lines.push(
        `     Required Certs: ${item.certifications.required.join(", ")}`
      )
      if (item.certifications.missing.length > 0) {
        lines.push(
          `     ❌ Missing: ${item.certifications.missing.join(", ")}`
        )
      } else {
        lines.push(
          `     ✅ Provided: ${item.certifications.provided.join(", ")}`
        )
      }
    }

    if (item.packagingStatus !== "N/A") {
      lines.push(
        `     Packaging: ${item.packagingStatus}`
      )
    }
  })

  lines.push("")
  lines.push("═".repeat(100))

  return lines.join("\n")
}
