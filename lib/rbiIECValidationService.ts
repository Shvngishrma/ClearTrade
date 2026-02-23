/**
 * RBI IEC + EDPMS LINKAGE VALIDATION SERVICE
 * ==========================================
 * 
 * RBI compliance for AD Code + Port validation:
 * - RBI IEC (Importer Exporter Code) verification
 * - AD Code registration checking
 * - EDPMS (Electronic Data Processing & Management System) flag validation
 * - AD expiration enforcement
 * - Exporter-AD-Port chain validation
 * 
 * CRITICAL: Prevents "AD 0001 registered to IEC 0123456788, invoice uses 0123456789" rejections
 */

import { prisma } from "@/lib/db"

export interface RBIIECRecord {
  iec: string           // 10-digit code
  exporterName: string
  addressLine1: string
  city: string
  state: string
  pincode: string
  registeredDate: Date
  status: "Active" | "Inactive" | "Suspended" | "Cancelled"
  edpmsFlags: {
    blacklisted: boolean
    antiDumpingCase: boolean
    dutyDefault: boolean
    customsFlexibility: boolean
    fraudMarked: boolean
  }
  adCodesAuthorized: string[]  // List of AD codes linked to this IEC
}

export interface RBIADCodeRecord {
  adCode: string
  ieCode: string              // Linked IEC
  status: "Active" | "Inactive" | "Suspended" | "Expired"
  registeredDate: Date
  expiryDate?: Date
  authorizedPorts: string[]   // ICCD codes
  authorizedCommodities?: string[]  // HS codes
  trustedPartner?: boolean
  edpmsMarks?: {
    fraudRisk: boolean
    suppressionRisk: boolean
    invoiceAnomaly: boolean
  }
}

export interface PortAuthorization {
  port: string              // ICCD code
  portName: string
  state: string
  adCodesAuthorized: string[]
  status: "Operational" | "Restricted"
  restrictions?: string
}

// ============================================
// RBI IEC MASTER (Mock - Production: Query RBI Live)
// ============================================

const RBI_IEC_MASTER: Record<string, RBIIECRecord> = {
  "0123456788": {
    iec: "0123456788",
    exporterName: "Bhavya Trading Ltd",
    addressLine1: "123 Trade Plaza",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    registeredDate: new Date("2020-01-15"),
    status: "Active",
    edpmsFlags: {
      blacklisted: false,
      antiDumpingCase: false,
      dutyDefault: false,
      customsFlexibility: true,
      fraudMarked: false
    },
    adCodesAuthorized: ["AD0001", "AD0002", "AD0005"]
  },
  "0123456789": {
    iec: "0123456789",
    exporterName: "Different Trading Co",
    addressLine1: "456 Commerce Street",
    city: "Delhi",
    state: "Delhi",
    pincode: "110001",
    registeredDate: new Date("2021-06-20"),
    status: "Active",
    edpmsFlags: {
      blacklisted: false,
      antiDumpingCase: false,
      dutyDefault: true,    // FLAGS: Duty default on record
      customsFlexibility: false,
      fraudMarked: false
    },
    adCodesAuthorized: ["AD0003"]
  },
  "0987654321": {
    iec: "0987654321",
    exporterName: "Premium Export House",
    addressLine1: "789 Export Avenue",
    city: "Bangalore",
    state: "Karnataka",
    pincode: "560001",
    registeredDate: new Date("2018-03-10"),
    status: "Suspended",   // FLAGS: Suspended status
    edpmsFlags: {
      blacklisted: true,
      antiDumpingCase: true,
      dutyDefault: false,
      customsFlexibility: false,
      fraudMarked: true
    },
    adCodesAuthorized: []
  }
}

// ============================================
// RBI AD CODE MASTER
// ============================================

const RBI_AD_CODE_MASTER: Record<string, RBIADCodeRecord> = {
  "AD0001": {
    adCode: "AD0001",
    ieCode: "0123456788",   // Linked to correct IEC
    status: "Active",
    registeredDate: new Date("2020-02-01"),
    expiryDate: new Date("2028-01-31"),
    authorizedPorts: ["INMAA1", "INMCT1"],  // Mumbai, Chennai
    authorizedCommodities: ["6203", "5208"], // Shirts, fabric
    trustedPartner: true,
    edpmsMarks: {
      fraudRisk: false,
      suppressionRisk: false,
      invoiceAnomaly: false
    }
  },
  "AD0002": {
    adCode: "AD0002",
    ieCode: "0123456788",
    status: "Active",
    registeredDate: new Date("2021-05-15"),
    expiryDate: new Date("2027-05-14"),
    authorizedPorts: ["INDEL1", "INBOM1"],  // Delhi, Bombay
    authorizedCommodities: ["8703"], // Motor vehicles
    trustedPartner: false,
    edpmsMarks: {
      fraudRisk: false,
      suppressionRisk: true,  // FLAGS: Suppression risk
      invoiceAnomaly: false
    }
  },
  "AD0003": {
    adCode: "AD0003",
    ieCode: "0123456789",
    status: "Expired",     // FLAGS: Expired AD code
    registeredDate: new Date("2020-01-01"),
    expiryDate: new Date("2024-12-31"),
    authorizedPorts: ["INMAA1"],
    authorizedCommodities: ["1001"],
    trustedPartner: false
  },
  "AD0005": {
    adCode: "AD0005",
    ieCode: "0123456788",
    status: "Active",
    registeredDate: new Date("2022-01-01"),
    expiryDate: new Date("2030-12-31"),
    authorizedPorts: ["INBOM1", "INMCT1", "INKOL1"],
    authorizedCommodities: ["2709", "2711"], // Oils
    trustedPartner: true
  }
}

// ============================================
// PORT MASTER (ICCD)
// ============================================

const PORT_MASTER: Record<string, PortAuthorization> = {
  "INMAA1": {
    port: "INMAA1",
    portName: "Port of Mumbai (Jawaharlal Nehru Port)",
    state: "Maharashtra",
    adCodesAuthorized: ["AD0001", "AD0002", "AD0005"],
    status: "Operational"
  },
  "INMCT1": {
    port: "INMCT1",
    portName: "Port of Chennai",
    state: "Tamil Nadu",
    adCodesAuthorized: ["AD0001", "AD0005"],
    status: "Operational"
  },
  "INDEL1": {
    port: "INDEL1",
    portName: "Inland Waterway Terminal",
    state: "Delhi",
    adCodesAuthorized: ["AD0002"],
    status: "Operational"
  },
  "INBOM1": {
    port: "INBOM1",
    portName: "Bombay Port",
    state: "Maharashtra",
    adCodesAuthorized: ["AD0002", "AD0005"],
    status: "Operational"
  },
  "INKOL1": {
    port: "INKOL1",
    portName: "Port of Kolkata",
    state: "West Bengal",
    adCodesAuthorized: ["AD0005"],
    status: "Operational"
  }
}

// ============================================
// RBI QUERY FUNCTIONS
// ============================================

/**
 * Query RBI for IEC status and details
 * PRODUCTION: Use RBI API with mTLS
 */
export async function queryRBIIEC(iec: string): Promise<RBIIECRecord | null> {
  // Mock: Return from master
  if (RBI_IEC_MASTER[iec]) {
    return RBI_IEC_MASTER[iec]
  }

  // PRODUCTION:
  // const response = await fetch(`https://rbi.gov.in/api/v1/iec/${iec}`, {
  //   cert: fs.readFileSync("/path/to/client.crt"),
  //   key: fs.readFileSync("/path/to/client.key")
  // })
  // return response.json()

  return null
}

/**
 * Query RBI for AD Code details
 */
export async function queryRBIADCode(adCode: string): Promise<RBIADCodeRecord | null> {
  if (RBI_AD_CODE_MASTER[adCode]) {
    return RBI_AD_CODE_MASTER[adCode]
  }

  // PRODUCTION:
  // const response = await fetch(`https://rbi.gov.in/api/v1/ad-code/${adCode}`)
  // return response.json()

  return null
}

/**
 * Query port authorization
 */
export async function queryPort(portCode: string): Promise<PortAuthorization | null> {
  if (PORT_MASTER[portCode]) {
    return PORT_MASTER[portCode]
  }

  return null
}

// ============================================
// PRIMARY VALIDATION FUNCTION
// ============================================

export interface IECValidationResult {
  iecExists: boolean
  iec: string
  exporterName?: string
  status: "Active" | "Inactive" | "Suspended" | "Cancelled" | "Unknown"
  adCodes: string[]  // AD codes authorized for this IEC
  edpmsFlags: {
    blacklisted: boolean
    antiDumpingCase: boolean
    dutyDefault: boolean
    customsFlexibility: boolean
    fraudMarked: boolean
  } | null
  issues: Array<{
    severity: "Error" | "Warning"
    field: string
    message: string
    resolution?: string
  }>
}

/**
 * Validate IEC at RBI
 */
export async function validateIECAtRBI(iec: string): Promise<IECValidationResult> {
  const issues: IECValidationResult["issues"] = []

  // Query RBI
  const rbiRecord = await queryRBIIEC(iec)

  if (!rbiRecord) {
    return {
      iecExists: false,
      iec,
      status: "Unknown",
      adCodes: [],
      edpmsFlags: null,
      issues: [
        {
          severity: "Error",
          field: "iec",
          message: `IEC ${iec} not found in RBI master`,
          resolution: "Verify IEC is correct. Check RBI ICEGATE portal."
        }
      ]
    }
  }

  // Check status flags
  if (rbiRecord.status === "Suspended") {
    issues.push({
      severity: "Error",
      field: "status",
      message: `❌ CRITICAL: IEC ${iec} is SUSPENDED on RBI records`,
      resolution: "Cannot export until IEC is reactivated by RBI"
    })
  }

  if (rbiRecord.status === "Cancelled") {
    issues.push({
      severity: "Error",
      field: "status",
      message: `❌ CRITICAL: IEC ${iec} has been CANCELLED on RBI records`,
      resolution: "Must register new IEC to continue export business"
    })
  }

  if (rbiRecord.status === "Inactive") {
    issues.push({
      severity: "Warning",
      field: "status",
      message: `⚠️ IEC ${iec} is INACTIVE on RBI records (no recent exports)`,
      resolution: "May need reactivation - check with RBI. Bank may hold scrutiny."
    })
  }

  // Check EDPMS flags
  if (rbiRecord.edpmsFlags.blacklisted) {
    issues.push({
      severity: "Error",
      field: "edpms.blacklisted",
      message: `❌ CRITICAL: IEC ${iec} is BLACKLISTED on EDPMS`,
      resolution: "Cannot export. File appeal with RBI/Customs."
    })
  }

  if (rbiRecord.edpmsFlags.antiDumpingCase) {
    issues.push({
      severity: "Warning",
      field: "edpms.antiDumpingCase",
      message: `⚠️ Anti-dumping case filed against IEC ${iec}`,
      resolution: "Anti-dumping duties may apply. Check DGFT orders."
    })
  }

  if (rbiRecord.edpmsFlags.dutyDefault) {
    issues.push({
      severity: "Warning",
      field: "edpms.dutyDefault",
      message: `⚠️ IEC ${iec} has duty default history on EDPMS`,
      resolution: "Bank may impose higher scrutiny & security deposit requirement"
    })
  }

  if (rbiRecord.edpmsFlags.fraudMarked) {
    issues.push({
      severity: "Error",
      field: "edpms.fraudMarked",
      message: `❌ CRITICAL: IEC ${iec} is marked for FRAUD on EDPMS`,
      resolution: "Cannot export pending fraud investigation"
    })
  }

  return {
    iecExists: true,
    iec,
    exporterName: rbiRecord.exporterName,
    status: rbiRecord.status,
    adCodes: rbiRecord.adCodesAuthorized,
    edpmsFlags: rbiRecord.edpmsFlags,
    issues
  }
}

// ============================================
// AD CODE + IEC + PORT CHAIN VALIDATION
// ============================================

export interface ADIECPortChainValidation {
  iec: string
  adCode: string
  port: string
  valid: boolean
  iecStatus: IECValidationResult
  adStatus: {
    exists: boolean
    status: string
    linkedIEC: string | null
    expiryDate: Date | null
    authorizedPorts: string[]
    authorizedCommodities: string[]
    edpmsMarks: any
  }
  portStatus: {
    exists: boolean
    authorizesSO_AD_PORT_TRIPLE: boolean
  }
  chainIntegrity: boolean
  issues: Array<{
    severity: "Error" | "Warning"
    message: string
    resolution?: string
  }>
}

/**
 * Master validation: IEC + AD Code + Port trinity check
 */
export async function validateADIECPortChain(
  iec: string,
  adCode: string,
  port: string,
  invoiceCommodities?: string[]  // HS codes
): Promise<ADIECPortChainValidation> {
  const issues: ADIECPortChainValidation["issues"] = []

  // Step 1: Validate IEC
  const iecValidation = await validateIECAtRBI(iec)
  issues.push(...iecValidation.issues)

  // Step 2: Validate AD Code exists and is linked to IEC
  const adRecord = await queryRBIADCode(adCode)
  let adStatus: ADIECPortChainValidation["adStatus"] = {
    exists: false,
    status: "NotFound",
    linkedIEC: null,
    expiryDate: null,
    authorizedPorts: [],
    authorizedCommodities: [],
    edpmsMarks: null
  }

  if (!adRecord) {
    issues.push({
      severity: "Error",
      message: `AD Code ${adCode} not found in RBI master`,
      resolution: "Verify AD code is correct"
    })
  } else {
    adStatus = {
      exists: true,
      status: adRecord.status,
      linkedIEC: adRecord.ieCode,
      expiryDate: adRecord.expiryDate || null,
      authorizedPorts: adRecord.authorizedPorts || [],
      authorizedCommodities: adRecord.authorizedCommodities || [],
      edpmsMarks: adRecord.edpmsMarks
    }

    // Check IEC linkage
    if (adRecord.ieCode !== iec) {
      issues.push({
        severity: "Error",
        message: `❌ CRITICAL: AD Code ${adCode} is registered to IEC ${adRecord.ieCode}, but invoice using IEC ${iec}`,
        resolution: "AD code and IEC mismatch. Check invoice IEC or use correct AD code."
      })
    }

    // Check AD expiry
    if (adRecord.status === "Expired" || (adRecord.expiryDate && adRecord.expiryDate < new Date())) {
      issues.push({
        severity: "Error",
        message: `❌ AD Code ${adCode} has EXPIRED (expiry: ${adRecord.expiryDate})`,
        resolution: "Renew AD code with RBI before shipping"
      })
    }

    if (adRecord.status === "Inactive") {
      issues.push({
        severity: "Warning",
        message: `⚠️ AD Code ${adCode} is INACTIVE`,
        resolution: "Reactivate AD code or use active AD code"
      })
    }

    // Check commodity restrictions
    if (invoiceCommodities && adRecord.authorizedCommodities) {
      const unauthorizedCommodities = invoiceCommodities.filter(
        hs => !adRecord.authorizedCommodities?.includes(hs)
      )
      if (unauthorizedCommodities.length > 0) {
        issues.push({
          severity: "Warning",
          message: `⚠️ AD Code ${adCode} not authorized for commodities: ${unauthorizedCommodities.join(", ")}`,
          resolution: `Use different AD code or restrict shipment to: ${adRecord.authorizedCommodities.join(", ")}`
        })
      }
    }

    // Check EDPMS marks
    if (adRecord.edpmsMarks?.fraudRisk) {
      issues.push({
        severity: "Warning",
        message: `⚠️ AD Code ${adCode} marked as FRAUD RISK on EDPMS`,
        resolution: "Bank may demand additional security deposit"
      })
    }

    if (adRecord.edpmsMarks?.suppressionRisk) {
      issues.push({
        severity: "Warning",
        message: `⚠️ AD Code ${adCode} marked for SUPPRESSION RISK on EDPMS`,
        resolution: "Enhanced customs scrutiny expected"
      })
    }
  }

  // Step 3: Validate Port
  const portRecord = await queryPort(port)
  let portStatus: ADIECPortChainValidation["portStatus"] = {
    exists: false,
    authorizesSO_AD_PORT_TRIPLE: false
  }

  if (!portRecord) {
    issues.push({
      severity: "Warning",
      message: `Port code ${port} not found in master`,
      resolution: "Verify port ICCD code"
    })
  } else {
    portStatus = {
      exists: true,
      authorizesSO_AD_PORT_TRIPLE: portRecord.adCodesAuthorized.includes(adCode)
    }

    if (!portStatus.authorizesSO_AD_PORT_TRIPLE) {
      issues.push({
        severity: "Error",
        message: `❌ Port ${portRecord.portName} (${port}) is NOT authorized for AD Code ${adCode}`,
        resolution: `Use authorized ports: ${portRecord.adCodesAuthorized.join(", ")} OR use different port's AD code`
      })
    }

    if (portRecord.status === "Restricted") {
      issues.push({
        severity: "Warning",
        message: `⚠️ Port ${portRecord.portName} (${port}) is currently RESTRICTED`,
        resolution: portRecord.restrictions || "Check with port authority"
      })
    }
  }

  // Chain integrity check
  const chainIntegrity = iecValidation.iecExists && adStatus.exists && portStatus.exists

  return {
    iec,
    adCode,
    port,
    valid: issues.filter(i => i.severity === "Error").length === 0,
    iecStatus: iecValidation,
    adStatus,
    portStatus,
    chainIntegrity,
    issues
  }
}

// ============================================
// REPORT GENERATION
// ============================================

export function generateADIECPortValidationReport(
  invoiceNumber: string,
  iec: string,
  adCode: string,
  port: string,
  validation: ADIECPortChainValidation
): string {
  const lines: string[] = [
    "═".repeat(90),
    "RBI IEC + AD CODE + PORT CHAIN VALIDATION REPORT",
    "═".repeat(90),
    `Invoice: ${invoiceNumber}`,
    `IEC: ${iec} (${validation.iecStatus.exporterName || "Unknown"})`,
    `AD Code: ${adCode}`,
    `Delivery Port: ${port}`,
    "",
    "VALIDATION RESULTS:",
    `  IEC Status: ${validation.iecStatus.status}`,
    `  AD Code Status: ${validation.adStatus.status}`,
    `  Port Authorization: ${validation.portStatus.authorizesSO_AD_PORT_TRIPLE ? "✅ Authorized" : "❌ Not Authorized"}`,
    `  Overall Chain Integrity: ${validation.chainIntegrity ? "✅ Valid" : "❌ Broken"}`,
    ""
  ]

  if (validation.issues.length > 0) {
    lines.push("ISSUES FOUND:")
    validation.issues.forEach(issue => {
      lines.push(`  [${issue.severity}] ${issue.message}`)
      if (issue.resolution) {
        lines.push(`    → ${issue.resolution}`)
      }
    })
    lines.push("")
  }

  if (validation.iecStatus.edpmsFlags) {
    lines.push("EDPMS FLAGS:")
    Object.entries(validation.iecStatus.edpmsFlags).forEach(([flag, value]) => {
      if (value) {
        lines.push(`  ⚠️ ${flag}: Yes`)
      }
    })
    lines.push("")
  }

  lines.push("═".repeat(90))

  return lines.join("\n")
}

/**
 * Quick bank acceptance check
 */
export function canInvoicePassRBIIECScrutiny(
  validation: ADIECPortChainValidation
): {
  acceptable: boolean
  bankAction: "Negotiate" | "Reject" | "Enhanced"
  reasoning: string
} {
  const errors = validation.issues.filter(i => i.severity === "Error")
  const warnings = validation.issues.filter(i => i.severity === "Warning")

  if (errors.length > 0) {
    return {
      acceptable: false,
      bankAction: "Reject",
      reasoning: `Critical errors: ${errors.map(e => e.message).join("; ")}`
    }
  }

  if (warnings.length > 0) {
    const flagErrors = validation.iecStatus.edpmsFlags && Object.values(validation.iecStatus.edpmsFlags).some(f => f)

    if (flagErrors) {
      return {
        acceptable: true,
        bankAction: "Enhanced",
        reasoning: `EDPMS flags detected - enhanced scrutiny and higher security deposit required`
      }
    }

    return {
      acceptable: true,
      bankAction: "Enhanced",
      reasoning: `Minor issues - possible LC amendment and additional documents needed`
    }
  }

  return {
    acceptable: true,
    bankAction: "Negotiate",
    reasoning: `IEC + AD Code + Port chain fully valid and verified`
  }
}
