/**
 * HS + GST + TARIFF VALIDATION SERVICE
 * ======================================
 * 
 * Enforces harmonized tariff compliance:
 * - HS code ↔ GST rate alignment
 * - Restricted goods detection (FTP Schedule)
 * - DGFT licensing requirements
 * - SION (Shipping Information on Notifications) triggers
 * 
 * ICEGATE Dependencies:
 * 1. HS code must match ITC HS Classification
 * 2. GST rate must correspond to correct HS bracket
 * 3. Restricted goods flagged → DGFT approval required
 * 4. Certain goods → SION filing mandatory
 * 5. Shipping Bill must reference correct HS
 * 
 * Regulatory Framework:
 * - ITC HS Classification (2023/2024/2025)
 * - GST Act Schedule III (HSN-wise GST rates)
 * - FTP Schedules 1, 2 (Prohibited/Restricted items)
 * - DGFT Notices (Restricted items, licensing)
 * - SION Guidelines (Certain categories)
 */

// ============================================
// HS CODE MASTER DATA
// Minimal master for demonstration
// Real implementation: Load from ITC database
// ============================================

export interface HSCodeMaster {
  hsCode: string // 8-digit HS code
  hsCodeFull: string // 10-digit with ITC prefix
  description: string
  gstRate: number // 0 | 5 | 12 | 18 | 28
  gstCategory: "Exempted" | "Nil Rated" | "5%" | "12%" | "18%" | "28%"
  unit: "KG" | "PCS" | "L" | "M" | "CBM" | "Pair" // Primary unit
  restrictions: "None" | "Restricted" | "Prohibited" | "License Required"
  dgftFlag: boolean // true = DGFT approval needed
  sionTrigger: boolean // true = SION mandatory for this item
  sionCategory?: "Core" | "Engineering" | "Software" | "Other"
}

// ITC HS Classification Master (Simplified)
export const HS_CODE_MASTER: Record<string, HSCodeMaster> = {
  "52082000": {
    hsCode: "52082000",
    hsCodeFull: "5208.2000",
    description: "Cotton Woven Fabric (plain weave, noncrepe)",
    gstRate: 5,
    gstCategory: "5%",
    unit: "M",
    restrictions: "None",
    dgftFlag: false,
    sionTrigger: false,
  },
  "64012000": {
    hsCode: "64012000",
    hsCodeFull: "6401.2000",
    description: "Waterproof footwear (rubber/plastic)",
    gstRate: 12,
    gstCategory: "12%",
    unit: "Pair",
    restrictions: "None",
    dgftFlag: false,
    sionTrigger: false,
  },
  "10010010": {
    hsCode: "10010010",
    hsCodeFull: "1001.0010",
    description: "Wheat (for milling)",
    gstRate: 0,
    gstCategory: "Exempted",
    unit: "KG",
    restrictions: "Restricted",
    dgftFlag: true,
    sionTrigger: false,
  },
  "07031000": {
    hsCode: "07031000",
    hsCodeFull: "0703.1000",
    description: "Onions (fresh)",
    gstRate: 0,
    gstCategory: "Exempted",
    unit: "KG",
    restrictions: "Restricted", // April-November seasonal restriction
    dgftFlag: false,
    sionTrigger: true,
    sionCategory: "Core",
  },
  "42021211": {
    hsCode: "42021211",
    hsCodeFull: "4202.1211",
    description: "Leather handbags with shoulder strap",
    gstRate: 18,
    gstCategory: "18%",
    unit: "PCS",
    restrictions: "License Required", // AUTH certificate required
    dgftFlag: true,
    sionTrigger: false,
  },
  "84733080": {
    hsCode: "84733080",
    hsCodeFull: "8473.3080",
    description: "Parts of automatic data-processing machines",
    gstRate: 5,
    gstCategory: "5%",
    unit: "PCS",
    restrictions: "None",
    dgftFlag: false,
    sionTrigger: true,
    sionCategory: "Engineering",
  },
  "30040090": {
    hsCode: "30040090",
    hsCodeFull: "3004.0090",
    description: "Medicaments (excluding specified)",
    gstRate: 12,
    gstCategory: "12%",
    unit: "KG",
    restrictions: "License Required", // DCGI approval may be needed
    dgftFlag: true,
    sionTrigger: false,
  },
  "28051100": {
    hsCode: "28051100",
    hsCodeFull: "2805.1100",
    description: "Sodium (alkali metal)",
    gstRate: 18,
    gstCategory: "18%",
    unit: "KG",
    restrictions: "Restricted",
    dgftFlag: true,
    sionTrigger: false,
  },
}

// ============================================
// GST CLASSIFICATION ALIGNMENT
// ============================================

export interface GSTClassification {
  hsCode: string
  hsRange: string // e.g., "5208.20-5208.29"
  gstRate: number
  gstCategory: string
  eligibleForIGST: boolean // Can be for export (IGST applicable)
  inbondWarehouse: boolean // Can enter bonded warehouse
  subjectToAntidumping: boolean
  subjectToCountervailing: boolean
}

// GST-HS Alignment Matrix
export const GST_HS_ALIGNMENT: Record<string, GSTClassification> = {
  "52082000": {
    hsCode: "52082000",
    hsRange: "5208.20-5208.29",
    gstRate: 5,
    gstCategory: "5%",
    eligibleForIGST: true,
    inbondWarehouse: true,
    subjectToAntidumping: false,
    subjectToCountervailing: false,
  },
  "64012000": {
    hsCode: "64012000",
    hsRange: "6401.10-6401.92",
    gstRate: 12,
    gstCategory: "12%",
    eligibleForIGST: true,
    inbondWarehouse: true,
    subjectToAntidumping: true,
    subjectToCountervailing: false,
  },
  "10010010": {
    hsCode: "10010010",
    hsRange: "1001.00-1001.99",
    gstRate: 0,
    gstCategory: "Exempted",
    eligibleForIGST: false, // No IGST on exempted
    inbondWarehouse: false,
    subjectToAntidumping: false,
    subjectToCountervailing: false,
  },
  "42021211": {
    hsCode: "42021211",
    hsRange: "4202.12-4202.29",
    gstRate: 18,
    gstCategory: "18%",
    eligibleForIGST: true,
    inbondWarehouse: true,
    subjectToAntidumping: false,
    subjectToCountervailing: false,
  },
}

// ============================================
// FTP SCHEDULES - RESTRICTED/PROHIBITED ITEMS
// ============================================

export interface FTPRestriction {
  hsCode: string
  category: "Prohibited" | "Restricted" | "License Required" | "Special Terms"
  ftpSchedule: "Schedule 1" | "Schedule 2" // 1=Prohibited, 2=Restricted
  dgftNotice: string // e.g., "DGFT/Noti/2024-03-15"
  restriction: string // Description of restriction
  licensingAuthority: string // "DGFT" | "DCGI" | "Other"
  exceptions?: string[] // e.g., ["AUTH Certificate", "Authorized Exporter"]
  validFrom: Date
  validUpto?: Date // null = indefinite
}

export const FTP_RESTRICTIONS: Record<string, FTPRestriction> = {
  "10010010": {
    hsCode: "10010010",
    category: "Restricted",
    ftpSchedule: "Schedule 2",
    dgftNotice: "DGFT/Noti/2024-02-15",
    restriction: "Wheat exports restricted; requires DGFT advance license or exemption",
    licensingAuthority: "DGFT",
    exceptions: ["Government procured wheat", "Advance license holders"],
    validFrom: new Date("2024-02-15"),
    validUpto: undefined,
  },
  "07031000": {
    hsCode: "07031000",
    category: "Restricted",
    ftpSchedule: "Schedule 2",
    dgftNotice: "DGFT/Noti/2023-03-01",
    restriction: "Onion exports restricted April-November; allowed December-March only",
    licensingAuthority: "DGFT",
    exceptions: ["During permitted season", "Government approval"],
    validFrom: new Date("2023-03-01"),
    validUpto: undefined,
  },
  "42021211": {
    hsCode: "42021211",
    category: "License Required",
    ftpSchedule: "Schedule 2",
    dgftNotice: "DGFT/Noti/2024-01-10",
    restriction: "Leather goods (handbags, shoes) require AUTH (Authorized Economic Operator) Certificate",
    licensingAuthority: "DGFT",
    exceptions: ["AUTH Certificate holders", "Deemed EOU"],
    validFrom: new Date("2024-01-10"),
    validUpto: undefined,
  },
  "30040090": {
    hsCode: "30040090",
    category: "License Required",
    ftpSchedule: "Schedule 2",
    dgftNotice: "DGFT/Noti/2024-01-05",
    restriction: "Pharmaceutical medicaments require DCGI registration and export approval",
    licensingAuthority: "DCGI",
    exceptions: ["DCGI registered", "Approved laboratories"],
    validFrom: new Date("2024-01-05"),
    validUpto: undefined,
  },
  "28051100": {
    hsCode: "28051100",
    category: "Restricted",
    ftpSchedule: "Schedule 2",
    dgftNotice: "DGFT/Noti/2024-02-01",
    restriction: "Alkali metals (sodium, potassium) restricted; hazardous goods classification",
    licensingAuthority: "DGFT",
    exceptions: ["Hazmat certification", "Advanced license"],
    validFrom: new Date("2024-02-01"),
    validUpto: undefined,
  },
}

// ============================================
// SION (SHIPPING INFORMATION ON NOTIFICATIONS)
// Items requiring SION filing per ICEGATE
// ============================================

export interface SIONRequirement {
  hsCode: string
  category: "Core" | "Engineering" | "Software" | "Agricultural" | "Other"
  sionMandatory: boolean
  sionFileTiming: string // "Before shipment" | "Within 24 hours" | "Before customs clearance"
  sionDetails: string
  icegateReference: string // ICEGATE circular number
}

export const SION_REQUIREMENTS: Record<string, SIONRequirement> = {
  "07031000": {
    hsCode: "07031000",
    category: "Agricultural",
    sionMandatory: true,
    sionFileTiming: "Before shipment",
    sionDetails: "Onion shipment must be notified to APEDA/ICEGATE with quantity, destination, shipper details",
    icegateReference: "ICEGATE/APEDA/Circ/2024-01",
  },
  "84733080": {
    hsCode: "84733080",
    category: "Engineering",
    sionMandatory: true,
    sionFileTiming: "Before customs clearance",
    sionDetails: "Engineering components require SION notification with technical specifications",
    icegateReference: "ICEGATE/ENGG/Circ/2024-02",
  },
  "52082000": {
    hsCode: "52082000",
    category: "Core",
    sionMandatory: false,
    sionFileTiming: "N/A",
    sionDetails: "Cotton textiles not subject to SION",
    icegateReference: "ICEGATE/TXT/Circ/2024-01",
  },
}

// ============================================
// VALIDATION RESULT TYPES
// ============================================

export interface HSCodeValidationResult {
  isValid: boolean
  hsCode: string
  description: string
  gstRate: number
  gstCategory: string
  issues: Array<{
    type: "Warning" | "Error" | "Info"
    code: string
    message: string
    resolution?: string
  }>
}

export interface GSTPriceLinkageCheck {
  hsCode: string
  invoicedGSTRate: number
  correctGSTRate: number
  aligned: boolean
  issue?: string
  resolution?: string
}

export interface RestrictedGoodsCheck {
  hsCode: string
  isRestricted: boolean
  restrictionCategory?: string
  ftpSchedule?: string
  dgftApprovalRequired: boolean
  licensingAuthority?: string
  exceptions?: string[]
  currentStatus: "Allowed" | "Restricted" | "Prohibited" | "License Required"
}

export interface DGFTFlaggingResult {
  hsCode: string
  hsDescription: string
  requiresDGFT: boolean
  dgftNotice?: string
  approvalType?: string
  timelineToApproval?: string
  blockingIssue: boolean // true = can't proceed without DGFT
}

export interface SIONTriggerResult {
  hsCode: string
  sionRequired: boolean
  sionCategory?: string
  sionFilingDeadline?: string
  sionDetails?: string
  icegateReference?: string
  blockingIssue: boolean // true = shipping blocked without SION filing
}

export interface TariffCompleteValidation {
  invoiceLineNumber: number
  hsCode: string
  description: string
  
  // Validations
  hsCodeValid: boolean
  gstAligned: boolean
  restrictedStatus: "Allowed" | "Restricted" | "Prohibited" | "License Required"
  dgftRequired: boolean
  sionRequired: boolean
  
  // Combined result
  canProceed: boolean // true if no blocking issues
  issues: Array<{
    severity: "Error" | "Warning" | "Info"
    category: "HS Code" | "GST" | "Restrictions" | "DGFT" | "SION"
    message: string
    resolution?: string
  }>
  
  // Blocking requirements
  requiredDocuments?: string[]
  requiredApprovals?: string[]
  
  // Audit
  validatedAt: Date
}

// ============================================
// CORE VALIDATION FUNCTIONS
// ============================================

/**
 * VALIDATION 1: HS Code Format & Master Lookup
 * Checks if HS code exists in ITC classification
 */
export function validateHSCodeMaster(hsCode: string): HSCodeValidationResult {
  const issues: HSCodeValidationResult["issues"] = []
  
  // Basic format check: 8 digits
  if (!hsCode || !/^\d{8}$/.test(hsCode)) {
    issues.push({
      type: "Error",
      code: "INVALID_FORMAT",
      message: `HS code must be 8 digits; received: ${hsCode}`,
      resolution: "Verify HS code from ITC classification manual"
    })
    
    return {
      isValid: false,
      hsCode,
      description: "",
      gstRate: 0,
      gstCategory: "",
      issues
    }
  }
  
  // Master lookup
  const master = HS_CODE_MASTER[hsCode]
  
  if (!master) {
    issues.push({
      type: "Error",
      code: "HS_NOT_FOUND",
      message: `HS code ${hsCode} not found in ITC classification master`,
      resolution: "Verify HS code against latest ITC HS Classification; may require import from live database"
    })
    
    return {
      isValid: false,
      hsCode,
      description: "",
      gstRate: 0,
      gstCategory: "",
      issues
    }
  }
  
  return {
    isValid: true,
    hsCode,
    description: master.description,
    gstRate: master.gstRate,
    gstCategory: master.gstCategory,
    issues: []
  }
}

/**
 * VALIDATION 2: HS ↔ GST Alignment
 * Ensures HS code matches its GST rate in invoice
 */
export function validateGSTAlignment(
  hsCode: string,
  invoicedGSTRate: number
): GSTPriceLinkageCheck {
  const master = HS_CODE_MASTER[hsCode]
  
  if (!master) {
    return {
      hsCode,
      invoicedGSTRate,
      correctGSTRate: 0,
      aligned: false,
      issue: `HS code ${hsCode} not found in master`,
      resolution: "Verify HS code validity"
    }
  }
  
  const aligned = invoicedGSTRate === master.gstRate
  
  return {
    hsCode,
    invoicedGSTRate,
    correctGSTRate: master.gstRate,
    aligned,
    issue: aligned ? undefined : `GST rate mismatch for HS ${hsCode}: invoiced ${invoicedGSTRate}% but should be ${master.gstRate}%`,
    resolution: aligned ? undefined : `Correct GST rate in invoice to ${master.gstRate}% per ITC classification`
  }
}

/**
 * VALIDATION 3: Restricted Goods Detection (FTP Schedules)
 */
export function detectRestrictedGoods(hsCode: string): RestrictedGoodsCheck {
  const master = HS_CODE_MASTER[hsCode]
  const ftpRestriction = FTP_RESTRICTIONS[hsCode]
  
  if (!master) {
    return {
      hsCode,
      isRestricted: false,
      dgftApprovalRequired: false,
      currentStatus: "Allowed"
    }
  }
  
  const isRestricted = master.restrictions !== "None"
  
  return {
    hsCode,
    isRestricted,
    restrictionCategory: isRestricted ? master.restrictions : undefined,
    ftpSchedule: ftpRestriction ? ftpRestriction.ftpSchedule : undefined,
    dgftApprovalRequired: master.dgftFlag,
    licensingAuthority: ftpRestriction ? ftpRestriction.licensingAuthority : undefined,
    exceptions: ftpRestriction ? ftpRestriction.exceptions : undefined,
    currentStatus: isRestricted ? master.restrictions as any : "Allowed"
  }
}

/**
 * VALIDATION 4: DGFT Licensing Requirements
 */
export function flagDGFTRequirements(hsCode: string): DGFTFlaggingResult {
  const master = HS_CODE_MASTER[hsCode]
  const ftpRestriction = FTP_RESTRICTIONS[hsCode]
  
  if (!master) {
    return {
      hsCode,
      hsDescription: "",
      requiresDGFT: false,
      blockingIssue: false
    }
  }
  
  const requiresDGFT = master.dgftFlag
  
  return {
    hsCode,
    hsDescription: master.description,
    requiresDGFT,
    dgftNotice: ftpRestriction ? ftpRestriction.dgftNotice : undefined,
    approvalType: ftpRestriction ? ftpRestriction.licensingAuthority : undefined,
    timelineToApproval: requiresDGFT ? "2-5 business days" : undefined,
    blockingIssue: master.restrictions === "Prohibited" || master.restrictions === "License Required"
  }
}

/**
 * VALIDATION 5: SION Trigger (Notifications for ICEGATE)
 */
export function triggerSIONRequirement(hsCode: string): SIONTriggerResult {
  const master = HS_CODE_MASTER[hsCode]
  const sionReq = SION_REQUIREMENTS[hsCode]
  
  if (!master) {
    return {
      hsCode,
      sionRequired: false,
      blockingIssue: false
    }
  }
  
  const sionRequired = master.sionTrigger
  
  return {
    hsCode,
    sionRequired,
    sionCategory: sionReq ? sionReq.category : undefined,
    sionFilingDeadline: sionReq ? sionReq.sionFileTiming : undefined,
    sionDetails: sionReq ? sionReq.sionDetails : undefined,
    icegateReference: sionReq ? sionReq.icegateReference : undefined,
    blockingIssue: sionRequired // SION filing is blocking without notification
  }
}

// ============================================
// MASTER VALIDATION: COMPLETE TARIFF CHECK
// ============================================

export interface CompleteTariffCheckInput {
  lineNumber: number
  hsCode: string
  quantity: number
  unitPrice: number
  gstRate: number
  description?: string
}

/**
 * Run all 5 validations + return complete compliance result
 */
export function validateCompleteTariff(input: CompleteTariffCheckInput): TariffCompleteValidation {
  const issues: TariffCompleteValidation["issues"] = []
  let canProceed = true
  const requiredDocuments: string[] = []
  const requiredApprovals: string[] = []
  
  // VALIDATION 1: HS Code Master
  const hsCodeCheck = validateHSCodeMaster(input.hsCode)
  if (!hsCodeCheck.isValid) {
    canProceed = false
    issues.push({
      severity: "Error",
      category: "HS Code",
      message: hsCodeCheck.issues[0].message,
      resolution: hsCodeCheck.issues[0].resolution
    })
  }
  
  // VALIDATION 2: GST Alignment
  const gstCheck = validateGSTAlignment(input.hsCode, input.gstRate)
  const gstAligned = gstCheck.aligned
  if (!gstAligned) {
    issues.push({
      severity: "Error",
      category: "GST",
      message: gstCheck.issue || "GST rate mismatch",
      resolution: gstCheck.resolution
    })
    canProceed = false
  }
  
  // VALIDATION 3: Restricted Goods
  const restrictedCheck = detectRestrictedGoods(input.hsCode)
  const restrictedStatus = restrictedCheck.currentStatus
  if (restrictedCheck.isRestricted && restrictedStatus !== "Allowed") {
    const severity: "Error" | "Warning" = restrictedStatus === "Prohibited" ? "Error" : restrictedStatus === "License Required" ? "Error" : "Warning"
    issues.push({
      severity,
      category: "Restrictions",
      message: `Goods classified as ${restrictedStatus}. FTP Schedule: ${restrictedCheck.ftpSchedule}`,
      resolution: `Obtain required approval from ${restrictedCheck.licensingAuthority}`
    })
    
    if (severity === "Error") {
      canProceed = false
    }
    
    if (restrictedCheck.exceptions) {
      requiredApprovals.push(...restrictedCheck.exceptions)
    }
  }
  
  // VALIDATION 4: DGFT Flagging
  const dgftCheck = flagDGFTRequirements(input.hsCode)
  if (dgftCheck.requiresDGFT) {
    const severity = dgftCheck.blockingIssue ? "Error" : "Warning"
    issues.push({
      severity,
      category: "DGFT",
      message: `DGFT approval required "${dgftCheck.approvalType}". Notice: ${dgftCheck.dgftNotice}`,
      resolution: `Submit advance license application to DGFT; approval timeline: ${dgftCheck.timelineToApproval}`
    })
    
    if (dgftCheck.blockingIssue) {
      canProceed = false
      requiredApprovals.push("DGFT Advance License")
    }
  }
  
  // VALIDATION 5: SION Trigger
  const sionCheck = triggerSIONRequirement(input.hsCode)
  if (sionCheck.sionRequired) {
    issues.push({
      severity: "Error", // SION is blocking for customs clearance
      category: "SION",
      message: `SION notification required for this item (${sionCheck.sionCategory}). Filing deadline: ${sionCheck.sionFilingDeadline}`,
      resolution: `File SION notification in ICEGATE before ${sionCheck.sionFilingDeadline}. Reference: ${sionCheck.icegateReference}`
    })
    
    if (sionCheck.blockingIssue) {
      canProceed = false
      requiredDocuments.push("SION Notification filing in ICEGATE")
    }
  }
  
  return {
    invoiceLineNumber: input.lineNumber,
    hsCode: input.hsCode,
    description: hsCodeCheck.description || input.description || "",
    
    hsCodeValid: hsCodeCheck.isValid,
    gstAligned,
    restrictedStatus: restrictedStatus || "Allowed",
    dgftRequired: dgftCheck.requiresDGFT,
    sionRequired: sionCheck.sionRequired,
    
    canProceed,
    issues,
    
    requiredDocuments: requiredDocuments.length > 0 ? requiredDocuments : undefined,
    requiredApprovals: requiredApprovals.length > 0 ? requiredApprovals : undefined,
    
    validatedAt: new Date()
  }
}

/**
 * Validate complete invoice HS codes (all line items)
 */
export function validateInvoiceTariff(
  items: CompleteTariffCheckInput[]
): Array<TariffCompleteValidation> {
  return items.map((item, idx) =>
    validateCompleteTariff({
      ...item,
      lineNumber: idx + 1
    })
  )
}

/**
 * Check if invoice can proceed to customs (all blocking issues resolved)
 */
export function canInvoiceProceedToCustoms(validations: TariffCompleteValidation[]): {
  canProceed: boolean
  blockingIssues: Array<{ line: number; issue: string }>
  warnings: Array<{ line: number; warning: string }>
} {
  const blockingIssues: Array<{ line: number; issue: string }> = []
  const warnings: Array<{ line: number; warning: string }> = []
  
  for (const validation of validations) {
    if (!validation.canProceed) {
      validation.issues
        .filter(i => i.severity === "Error")
        .forEach(issue => {
          blockingIssues.push({
            line: validation.invoiceLineNumber,
            issue: issue.message
          })
        })
    } else {
      validation.issues
        .filter(i => i.severity === "Warning")
        .forEach(issue => {
          warnings.push({
            line: validation.invoiceLineNumber,
            warning: issue.message
          })
        })
    }
  }
  
  return {
    canProceed: blockingIssues.length === 0,
    blockingIssues,
    warnings
  }
}

/**
 * Generate SION notification data for ICEGATE filing
 */
export interface SIONNotificationData {
  invoiceNumber: string
  lcNumber?: string
  exporterIEC: string
  buyerCountry: string
  hsCode: string
  hsDescription: string
  quantity: number
  unit: string
  unitPrice: number
  totalValue: number
  currency: string
  shipmentDate: Date
  destinationPort: string
  sionCategory: string
  sionFilingDeadline: Date
}

export function generateSIONNotificationData(
  invoice: any,
  items: CompleteTariffCheckInput[]
): SIONNotificationData[] {
  const sionItems = items.filter(item => {
    const sionCheck = triggerSIONRequirement(item.hsCode)
    return sionCheck.sionRequired
  })
  
  return sionItems.map(item => {
    const sionReq = SION_REQUIREMENTS[item.hsCode]
    const master = HS_CODE_MASTER[item.hsCode]
    
    return {
      invoiceNumber: invoice.invoiceNumber,
      lcNumber: invoice.lcNumber,
      exporterIEC: invoice.exporterIEC,
      buyerCountry: invoice.buyerCountry,
      hsCode: item.hsCode,
      hsDescription: master?.description || "",
      quantity: item.quantity,
      unit: master?.unit || "PCS",
      unitPrice: item.unitPrice,
      totalValue: item.quantity * item.unitPrice,
      currency: invoice.currency || "USD",
      shipmentDate: new Date(invoice.shipmentDate),
      destinationPort: invoice.portOfDischarge,
      sionCategory: sionReq?.category || "Other",
      sionFilingDeadline: new Date(
        new Date(invoice.shipmentDate).getTime() -
        (sionReq?.sionFileTiming.includes("Before") ? 24 * 60 * 60 * 1000 : 0)
      )
    }
  })
}

/**
 * Get compliance summary for invoice (for bank/customs)
 */
export interface TariffComplianceSummary {
  invoiceNumber: string
  totalLines: number
  hsCodesValid: number
  gstAligned: number
  restrictedItems: number
  dgftApprovalRequired: number
  sionNotificationRequired: number
  canProceedToCustoms: boolean
  issues: Array<{ severity: string; message: string; lineNumbers: number[] }>
}

export function generateTariffComplianceSummary(
  invoiceNumber: string,
  validations: TariffCompleteValidation[]
): TariffComplianceSummary {
  const issueMap: Record<string, { severity: string; lineNumbers: number[] }> = {}
  
  for (const validation of validations) {
    for (const issue of validation.issues) {
      const key = `${issue.severity}:${issue.message}`
      if (!issueMap[key]) {
        issueMap[key] = { severity: issue.severity, lineNumbers: [] }
      }
      issueMap[key].lineNumbers.push(validation.invoiceLineNumber)
    }
  }
  
  const issues = Object.entries(issueMap).map(([_, value]) => ({
    severity: value.severity,
    message: _.split(":")[1],
    lineNumbers: value.lineNumbers
  }))
  
  return {
    invoiceNumber,
    totalLines: validations.length,
    hsCodesValid: validations.filter(v => v.hsCodeValid).length,
    gstAligned: validations.filter(v => v.gstAligned).length,
    restrictedItems: validations.filter(v => v.restrictedStatus !== "Allowed").length,
    dgftApprovalRequired: validations.filter(v => v.dgftRequired).length,
    sionNotificationRequired: validations.filter(v => v.sionRequired).length,
    canProceedToCustoms: validations.every(v => v.canProceed),
    issues
  }
}
