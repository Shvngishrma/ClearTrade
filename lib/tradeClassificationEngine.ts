/**
 * ENGINE 3: TRADE CLASSIFICATION ENGINE
 * 
 * Validates trade classification CONTEXT (not HS format - that's Engine 2).
 * Enforces alignment between HS codes, GST rates, restricted goods, and export rules.
 * 
 * 5 Rules:
 * 1. HS ↔ GST alignment (must match official mappings)
 * 2. Restricted goods detection (flagged for DGFT license)
 * 3. DGFT license requirement (auto-flag based on HS)
 * 4. SION requirement detection (System of Identification of Odalwadi items)
 * 5. Export prohibition detection (completely banned items)
 * 
 * Returns: isRestricted, requiresLicense, sionRequired, errors[]
 * 
 * Later: Replace masters with live DGFT API calls
 * Now: Structured internal rule base (auditable, enforceable, blockers)
 */

import { prisma } from "@/lib/db"

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface TradeClassificationInput {
  hsCode: string
  gstRate: number
  countryOfDestination: string
  commodity: string
  quantity?: number
  unitPrice?: number
}

export interface TradeClassificationResult {
  isValid: boolean
  isRestricted: boolean
  requiresLicense: boolean
  sionRequired: boolean
  exportProhibited: boolean
  gstAligned: boolean
  
  errors: Array<{
    code: string
    message: string
    severity: "BLOCKER" | "WARNING"
  }>
  
  warnings: Array<{
    code: string
    message: string
  }>
  
  classification: {
    hsCode: string
    gstRate: number
    classificationStatus: "FREELY_EXPORTABLE" | "RESTRICTED" | "LICENSED" | "PROHIBITED"
    applicableLicenses: string[]
    applicableRestrictions: string[]
  }
  
  auditLog: Array<{
    timestamp: Date
    ruleCode: string
    ruleName: string
    result: boolean
    message: string
  }>
  
  validationTimestamp: Date
}

// ============================================
// MASTER DATA: HS ↔ GST ALIGNMENT MASTER
// ============================================

interface HSGSTMapping {
  hsCode: string
  hsDescription: string
  validGSTRates: number[]  // GST rates (5, 12, 18, 28)
  restrictedStatus: "FREELY_EXPORTABLE" | "RESTRICTED" | "LICENSED" | "PROHIBITED"
}

const HS_GST_MASTER: HSGSTMapping[] = [
  // Textiles
  {
    hsCode: "6203",
    hsDescription: "Men's T-Shirts (Cotton)",
    validGSTRates: [5],
    restrictedStatus: "FREELY_EXPORTABLE"
  },
  {
    hsCode: "6204",
    hsDescription: "Women's Shirts",
    validGSTRates: [5],
    restrictedStatus: "FREELY_EXPORTABLE"
  },
  {
    hsCode: "5208",
    hsDescription: "Woven cotton fabric",
    validGSTRates: [5],
    restrictedStatus: "FREELY_EXPORTABLE"
  },
  
  // Agricultural
  {
    hsCode: "0302",
    hsDescription: "Fish (Fresh)",
    validGSTRates: [5, 12],
    restrictedStatus: "RESTRICTED"  // APEDA restriction
  },
  {
    hsCode: "0710",
    hsDescription: "Vegetables (fresh/chilled)",
    validGSTRates: [0, 5],
    restrictedStatus: "FREELY_EXPORTABLE"
  },
  {
    hsCode: "1001",
    hsDescription: "Wheat",
    validGSTRates: [0],
    restrictedStatus: "PROHIBITED"  // Banned until Dec 2026
  },
  {
    hsCode: "1005",
    hsDescription: "Corn",
    validGSTRates: [0],
    restrictedStatus: "FREELY_EXPORTABLE"
  },
  
  // Metal & Machinery
  {
    hsCode: "7208",
    hsDescription: "Flat-rolled iron/steel products",
    validGSTRates: [5],
    restrictedStatus: "LICENSED"  // DGFT license required
  },
  {
    hsCode: "8407",
    hsDescription: "Piston engines",
    validGSTRates: [5],
    restrictedStatus: "LICENSED"  // Strategic items
  },
  
  // Chemicals & Pharmaceuticals
  {
    hsCode: "2936",
    hsDescription: "Vitamins",
    validGSTRates: [5],
    restrictedStatus: "FREELY_EXPORTABLE"
  },
  {
    hsCode: "3004",
    hsDescription: "Medicaments (prepared)",
    validGSTRates: [0, 5],
    restrictedStatus: "LICENSED"  // Quality standards
  },
  
  // Gems & Jewellery
  {
    hsCode: "7102",
    hsDescription: "Diamonds",
    validGSTRates: [0],
    restrictedStatus: "LICENSED"  // DGFT license
  },
  {
    hsCode: "7108",
    hsDescription: "Gold",
    validGSTRates: [0],
    restrictedStatus: "LICENSED"  // Hallmark required
  }
]

// ============================================
// MASTER DATA: DGFT LICENSE REQUIREMENTS
// ============================================

interface DGFTLicenseItem {
  hsCode: string
  commodity: string
  licenseType: "IEC_MANDATORY" | "SION_MANDATORY" | "AD_CODE_REQUIRED" | "DGFT_PERMISSION"
  licenseCode: string
  restrictionDetails: string
}

const DGFT_LICENSE_MASTER: DGFTLicenseItem[] = [
  {
    hsCode: "0302",
    commodity: "Fish",
    licenseType: "DGFT_PERMISSION",
    licenseCode: "FISH_EXPORT_2026",
    restrictionDetails: "Requires APEDA approval + Customs supervision"
  },
  {
    hsCode: "7102",
    commodity: "Diamonds",
    licenseType: "DGFT_PERMISSION",
    licenseCode: "DIAMOND_LICENSE",
    restrictionDetails: "Kimberly Process certificate required"
  },
  {
    hsCode: "3004",
    commodity: "Pharmaceuticals",
    licenseType: "DGFT_PERMISSION",
    licenseCode: "PHARMA_LICENSE",
    restrictionDetails: "EDD (Establishment Drugs Directory) approval required"
  },
  {
    hsCode: "7208",
    commodity: "Steel",
    licenseType: "DGFT_PERMISSION",
    licenseCode: "STEEL_LICENSE",
    restrictionDetails: "Export quota monitoring required"
  },
  {
    hsCode: "8407",
    commodity: "Engines",
    licenseType: "DGFT_PERMISSION",
    licenseCode: "ENGINE_LICENSE",
    restrictionDetails: "Strategic items - Ministry clearance needed"
  }
]

// ============================================
// MASTER DATA: SION REQUIREMENTS
// ============================================

interface SIONItem {
  hsCode: string
  commodity: string
  sionCode: string
  odal: boolean
  sanctuaryRestriction: boolean
  seasonalRestriction: {
    restricted: boolean
    season: string
  }
}

const SION_REQUIREMENTS_MASTER: SIONItem[] = [
  {
    hsCode: "0302",
    commodity: "Fish",
    sionCode: "SION_0302",
    odal: true,
    sanctuaryRestriction: true,
    seasonalRestriction: {
      restricted: true,
      season: "Monsoon (Jun-Sep): Reduced export allowed"
    }
  },
  {
    hsCode: "0710",
    commodity: "Vegetables",
    sionCode: "SION_0710",
    odal: false,
    sanctuaryRestriction: false,
    seasonalRestriction: {
      restricted: false,
      season: ""
    }
  },
  {
    hsCode: "0403",
    commodity: "Butter/Ghee",
    sionCode: "SION_0403",
    odal: true,
    sanctuaryRestriction: false,
    seasonalRestriction: {
      restricted: false,
      season: ""
    }
  }
]

// ============================================
// MASTER DATA: EXPORT PROHIBITIONS
// ============================================

interface ExportProhibition {
  hsCode: string
  commodity: string
  banned: boolean
  banReason: "NATIONAL_SECURITY" | "CONSERVATION" | "HEALTH_SAFETY" | "STRATEGIC"
  banStartDate: Date
  banEndDate?: Date
  allowedException?: string
}

const EXPORT_PROHIBITION_MASTER: ExportProhibition[] = [
  {
    hsCode: "1001",
    commodity: "Wheat",
    banned: true,
    banReason: "NATIONAL_SECURITY",
    banStartDate: new Date("2022-03-14"),
    banEndDate: new Date("2026-12-31"),
    allowedException: "With DGFT permission for specific contracts"
  },
  {
    hsCode: "0708",
    commodity: "Onions",
    banned: true,
    banReason: "NATIONAL_SECURITY",
    banStartDate: new Date("2021-12-01"),
    banEndDate: undefined,
    allowedException: "Continuous ban"
  },
  {
    hsCode: "9925",
    commodity: "Waste & Scrap",
    banned: true,
    banReason: "CONSERVATION",
    banStartDate: new Date("2019-01-01"),
    allowedException: "Recycled materials only with certificate"
  }
]

// ============================================
// RULE 1: HS ↔ GST ALIGNMENT CHECK
// ============================================

function validateHSGSTAlignment(
  hsCode: string,
  gstRate: number
): { aligned: boolean; message: string; validRates: number[] } {
  const hsGSTMapping = HS_GST_MASTER.find(m => m.hsCode === hsCode)
  
  if (!hsGSTMapping) {
    return {
      aligned: false,
      message: `HS code ${hsCode} not found in master. Update required.`,
      validRates: []
    }
  }
  
  const isAligned = hsGSTMapping.validGSTRates.includes(gstRate)
  
  return {
    aligned: isAligned,
    message: isAligned
      ? `✅ GST rate ${gstRate}% correctly aligned with HS ${hsCode}`
      : `❌ GST rate ${gstRate}% misaligned. Valid rates for HS ${hsCode}: ${hsGSTMapping.validGSTRates.join(", ")}%`,
    validRates: hsGSTMapping.validGSTRates
  }
}

// ============================================
// RULE 2: RESTRICTED GOODS DETECTION
// ============================================

function detectRestrictedGoods(
  hsCode: string
): { restricted: boolean; status: string; message: string } {
  const hsGSTMapping = HS_GST_MASTER.find(m => m.hsCode === hsCode)
  
  if (!hsGSTMapping) {
    return {
      restricted: false,
      status: "UNKNOWN",
      message: "HS code not in master - cannot validate restriction status"
    }
  }
  
  return {
    restricted: hsGSTMapping.restrictedStatus !== "FREELY_EXPORTABLE",
    status: hsGSTMapping.restrictedStatus,
    message:
      hsGSTMapping.restrictedStatus === "FREELY_EXPORTABLE"
        ? `✅ ${hsCode} - Freely exportable, no license required`
        : `⚠️  ${hsCode} - ${hsGSTMapping.restrictedStatus}, may require license or documentation`
  }
}

// ============================================
// RULE 3: DGFT LICENSE REQUIREMENT FLAG
// ============================================

function flagDGFTLicenseRequirement(
  hsCode: string
): { requiresLicense: boolean; licenseType: string; details: string } {
  const dgftItem = DGFT_LICENSE_MASTER.find(item => item.hsCode === hsCode)
  
  if (!dgftItem) {
    return {
      requiresLicense: false,
      licenseType: "NONE",
      details: "No DGFT license flagged for this HS code"
    }
  }
  
  return {
    requiresLicense: true,
    licenseType: dgftItem.licenseType,
    details: `🚩 License Required: ${dgftItem.licenseCode} - ${dgftItem.restrictionDetails}`
  }
}

// ============================================
// RULE 4: SION REQUIREMENT FLAG
// ============================================

function flagSIONRequirement(
  hsCode: string
): { sionRequired: boolean; sionCode: string; details: string } {
  const sionItem = SION_REQUIREMENTS_MASTER.find(item => item.hsCode === hsCode)
  
  if (!sionItem) {
    return {
      sionRequired: false,
      sionCode: "",
      details: "No SION requirement for this HS code"
    }
  }
  
  let warning = `🏛️  SION Required: ${sionItem.sionCode}`
  
  if (sionItem.odal) {
    warning += " | Odal registration mandatory"
  }
  
  if (sionItem.sanctuaryRestriction) {
    warning += " | Sanctuary areas restricted"
  }
  
  if (sionItem.seasonalRestriction.restricted) {
    warning += ` | ${sionItem.seasonalRestriction.season}`
  }
  
  return {
    sionRequired: true,
    sionCode: sionItem.sionCode,
    details: warning
  }
}

// ============================================
// RULE 5: EXPORT PROHIBITION DETECTION
// ============================================

function detectExportProhibition(hsCode: string): {
  prohibited: boolean
  reason: string
  banEndDate: Date | null
  allowException: string
} {
  const prohibition = EXPORT_PROHIBITION_MASTER.find(p => p.hsCode === hsCode)
  
  if (!prohibition) {
    return {
      prohibited: false,
      reason: "",
      banEndDate: null,
      allowException: ""
    }
  }
  
  if (!prohibition.banned) {
    return {
      prohibited: false,
      reason: "",
      banEndDate: null,
      allowException: ""
    }
  }
  
  const today = new Date()
  const isBanActive =
    today >= prohibition.banStartDate &&
    (!prohibition.banEndDate || today <= prohibition.banEndDate)
  
  if (!isBanActive) {
    return {
      prohibited: false,
      reason: "Ban expired",
      banEndDate: prohibition.banEndDate || null,
      allowException: ""
    }
  }
  
  return {
    prohibited: true,
    reason: `🚫 EXPORT PROHIBITED - Reason: ${prohibition.banReason} - Effective: ${prohibition.banStartDate.toDateString()}${prohibition.banEndDate ? ` to ${prohibition.banEndDate.toDateString()}` : " (indefinite)"}`,
    banEndDate: prohibition.banEndDate || null,
    allowException: prohibition.allowedException || "No exceptions"
  }
}

// ============================================
// MAIN VALIDATION FUNCTION
// ============================================

export async function validateTradeClassification(
  input: TradeClassificationInput
): Promise<TradeClassificationResult> {
  const auditLog: TradeClassificationResult["auditLog"] = []
  const errors: TradeClassificationResult["errors"] = []
  const warnings: TradeClassificationResult["warnings"] = []
  
  const startTime = new Date()
  
  // RULE 1: HS ↔ GST Alignment
  const hsGSTCheck = validateHSGSTAlignment(input.hsCode, input.gstRate)
  auditLog.push({
    timestamp: new Date(),
    ruleCode: "HS_GST_ALIGNMENT",
    ruleName: "HS Code ↔ GST Rate Alignment",
    result: hsGSTCheck.aligned,
    message: hsGSTCheck.message
  })
  
  if (!hsGSTCheck.aligned) {
    errors.push({
      code: "GST_MISMATCH",
      message: `GST rate ${input.gstRate}% does not align with HS code ${input.hsCode}. Correct rates: ${hsGSTCheck.validRates.join(", ")}%`,
      severity: "BLOCKER"
    })
  }
  
  // RULE 2: Restricted Goods Detection
  const restrictedCheck = detectRestrictedGoods(input.hsCode)
  auditLog.push({
    timestamp: new Date(),
    ruleCode: "RESTRICTED_GOODS_DETECTION",
    ruleName: "Restricted Goods Check",
    result: !restrictedCheck.restricted,
    message: restrictedCheck.message
  })
  
  if (restrictedCheck.restricted) {
    if (restrictedCheck.status === "PROHIBITED") {
      errors.push({
        code: "RESTRICTED_COMMODITY",
        message: `${input.commodity} (HS ${input.hsCode}) is ${restrictedCheck.status} and cannot be exported`,
        severity: "BLOCKER"
      })
    } else {
      warnings.push({
        code: "RESTRICTED_COMMODITY",
        message: `${input.commodity} (HS ${input.hsCode}) is ${restrictedCheck.status}`
      })
    }
  }
  
  // RULE 3: DGFT License Requirement
  const licenseCheck = flagDGFTLicenseRequirement(input.hsCode)
  auditLog.push({
    timestamp: new Date(),
    ruleCode: "DGFT_LICENSE_REQUIREMENT",
    ruleName: "DGFT License Flag",
    result: !licenseCheck.requiresLicense,
    message: licenseCheck.details
  })
  
  if (licenseCheck.requiresLicense) {
    warnings.push({
      code: "DGFT_LICENSE_FLAGGED",
      message: licenseCheck.details
    })
  }
  
  // RULE 4: SION Requirement
  const sionCheck = flagSIONRequirement(input.hsCode)
  auditLog.push({
    timestamp: new Date(),
    ruleCode: "SION_REQUIREMENT",
    ruleName: "SION Requirement Flag",
    result: !sionCheck.sionRequired,
    message: sionCheck.details
  })
  
  if (sionCheck.sionRequired) {
    warnings.push({
      code: "SION_REQUIRED",
      message: sionCheck.details
    })
  }
  
  // RULE 5: Export Prohibition Detection
  const prohibitionCheck = detectExportProhibition(input.hsCode)
  auditLog.push({
    timestamp: new Date(),
    ruleCode: "EXPORT_PROHIBITION_CHECK",
    ruleName: "Export Prohibition Detection",
    result: !prohibitionCheck.prohibited,
    message: prohibitionCheck.prohibited
      ? prohibitionCheck.reason
      : `✅ No export prohibition for HS ${input.hsCode}`
  })
  
  if (prohibitionCheck.prohibited) {
    errors.push({
      code: "EXPORT_PROHIBITED",
      message: `${input.commodity} (HS ${input.hsCode}) - ${prohibitionCheck.reason}. Exception: ${prohibitionCheck.allowException}`,
      severity: "BLOCKER"
    })
  }
  
  // ============================================
  // COMPILE RESULTS
  // ============================================
  
  const isValid = errors.length === 0
  
  return {
    isValid,
    isRestricted: restrictedCheck.restricted,
    requiresLicense: licenseCheck.requiresLicense,
    sionRequired: sionCheck.sionRequired,
    exportProhibited: prohibitionCheck.prohibited,
    gstAligned: hsGSTCheck.aligned,
    
    errors,
    warnings,
    
    classification: {
      hsCode: input.hsCode,
      gstRate: input.gstRate,
      classificationStatus: prohibitionCheck.prohibited
        ? "PROHIBITED"
        : restrictedCheck.status as
            | "FREELY_EXPORTABLE"
            | "RESTRICTED"
            | "LICENSED"
            | "PROHIBITED",
      applicableLicenses: licenseCheck.requiresLicense ? [licenseCheck.licenseType] : [],
      applicableRestrictions: restrictedCheck.restricted ? [restrictedCheck.status] : []
    },
    
    auditLog,
    validationTimestamp: startTime
  }
}

// ============================================
// HELPER: CAN GENERATE INVOICE DOCUMENTS?
// ============================================

export async function canGenerateInvoiceDocuments_TradeClassification(
  invoiceId: string,
  hsCode: string,
  gstRate: number,
  countryOfDestination: string,
  commodity: string
): Promise<{
  allowed: boolean
  blockers: Array<{ code: string; message: string }>
  warnings: string[]
}> {
  const result = await validateTradeClassification({
    hsCode,
    gstRate,
    countryOfDestination,
    commodity
  })
  
  return {
    allowed: result.isValid,
    blockers: result.errors.filter(e => e.severity === "BLOCKER"),
    warnings: result.warnings.map(w => w.message)
  }
}

// ============================================
// HELPER: GENERATE COMPLIANCE REPORT
// ============================================

export function generateTradeClassificationReport(
  result: TradeClassificationResult
): string {
  const lines: string[] = []
  
  lines.push("=" .repeat(60))
  lines.push("TRADE CLASSIFICATION VALIDATION REPORT")
  lines.push("=".repeat(60))
  lines.push("")
  
  lines.push(`HS Code: ${result.classification.hsCode}`)
  lines.push(`GST Rate: ${result.classification.gstRate}%`)
  lines.push(`Status: ${result.classification.classificationStatus}`)
  lines.push(`Validation Time: ${result.validationTimestamp.toISOString()}`)
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
    })
    lines.push("")
  }
  
  lines.push("AUDIT LOG:")
  result.auditLog.forEach(log => {
    lines.push(`  ${log.timestamp.toISOString()} | ${log.ruleCode.padEnd(30)} | ${log.result ? "✅" : "❌"} | ${log.message}`)
  })
  
  lines.push("")
  lines.push("=".repeat(60))
  
  return lines.join("\n")
}
