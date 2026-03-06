/**
 * ENGINE 5: AD-PORT VALIDATION ENGINE
 * 
 * Validates customs port compliance and AD (Authorization Holder) mappings.
 * Ensures port consistency between invoice and shipping bill.
 * 
 * 4 Rules:
 * 1. Invoice port == Shipping Bill port (consistency)
 * 2. AD Code present if port requires it (mandatory flag)
 * 3. AD Code registered for exporter (database validation)
 * 4. Port code valid per ICEGATE (master list validation)
 * 
 * Returns: portValid, adCodeValid, adCodeRegistered, errors[]
 * Blocks invoice generation on any blocker.
 * 
 * Data Sources:
 * - ExporterADMapping table (Prisma)
 * - ICEGATE Port Master (internal + live API later)
 */

import { prisma } from "@/lib/db"

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface PortComplianceInput {
  invoiceId: string
  exporterId: string
  invoicePortOfLoading: string
  invoicePortOfDischarge?: string
  shippingBillPortOfLoading: string
  shippingBillPortOfDischarge?: string
  adCode?: string
  modeOfTransport: string
}

export interface PortComplianceResult {
  isValid: boolean
  portConsistent: boolean
  adCodeValid: boolean
  adCodeRegistered: boolean
  portCodeValid: boolean
  
  errors: Array<{
    code: string
    message: string
    severity: "BLOCKER" | "WARNING"
  }>
  
  warnings: Array<{
    code: string
    message: string
  }>
  
  validation: {
    invoicePortOfLoading: string
    shippingBillPortOfLoading: string
    portsMatch: boolean
    adCodeRequired: boolean
    adCodeProvided: boolean
    adCodeInMaster: boolean
    portCodeValid: boolean
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
// MASTER DATA: ICEGATE PORT CODES
// ============================================

interface ICEGATEPort {
  portCode: string
  portName: string
  area: string
  state: string
  portType: "Sea" | "Air" | "Land" | "Inland"
  requiresAD: boolean // Does this port require AD code?
  allowedADs: string[] // If requiresAD = true, which AD codes are valid here?
}

const ICEGATE_PORT_MASTER: ICEGATEPort[] = [
  // Major Sea Ports - Most require AD codes
  {
    portCode: "INMAA",
    portName: "Jawaharlal Nehru Port, Mumbai",
    area: "Western",
    state: "Maharashtra",
    portType: "Sea",
    requiresAD: true,
    allowedADs: ["DTA", "EPCG", "SEZ", "100%EOU", "Special"]
  },
  {
    portCode: "INMAA1",
    portName: "Mumbai Port (APM Terminals)",
    area: "Western",
    state: "Maharashtra",
    portType: "Sea",
    requiresAD: true,
    allowedADs: ["DTA", "EPCG", "SEZ"]
  },
  {
    portCode: "INMAB",
    portName: "Port of Paradip",
    area: "Eastern",
    state: "Odisha",
    portType: "Sea",
    requiresAD: true,
    allowedADs: ["DTA", "EPCG"]
  },
  {
    portCode: "INMAB1",
    portName: "Port of Paradip - Terminal 2",
    area: "Eastern",
    state: "Odisha",
    portType: "Sea",
    requiresAD: true,
    allowedADs: ["DTA", "EPCG", "100%EOU"]
  },
  {
    portCode: "INMAE",
    portName: "Cochin Port",
    area: "Southern",
    state: "Kerala",
    portType: "Sea",
    requiresAD: true,
    allowedADs: ["DTA", "EPCG", "SEZ"]
  },
  {
    portCode: "INMAR1",
    portName: "Port of Chennai",
    area: "Southern",
    state: "Tamil Nadu",
    portType: "Sea",
    requiresAD: true,
    allowedADs: ["DTA", "EPCG", "SEZ"]
  },
  {
    portCode: "INMAC",
    portName: "Port of Vishakhapatnam",
    area: "Southern",
    state: "Andhra Pradesh",
    portType: "Sea",
    requiresAD: true,
    allowedADs: ["DTA", "EPCG"]
  },
  
  // Air Ports - Often don't require AD codes for standard exports
  {
    portCode: "INMUL",
    portName: "Indira Gandhi International Airport, Delhi",
    area: "Northern",
    state: "Delhi",
    portType: "Air",
    requiresAD: false,
    allowedADs: []
  },
  {
    portCode: "INBOM",
    portName: "Bombay Airport, Mumbai",
    area: "Western",
    state: "Maharashtra",
    portType: "Air",
    requiresAD: false,
    allowedADs: []
  },
  {
    portCode: "INMAA12",
    portName: "Bangalore International Airport",
    area: "Southern",
    state: "Karnataka",
    portType: "Air",
    requiresAD: false,
    allowedADs: []
  },
  
  // Land Borders - Special handling
  {
    portCode: "INHA1",
    portName: "Wagah Border, Amritsar",
    area: "Northern",
    state: "Punjab",
    portType: "Land",
    requiresAD: false,
    allowedADs: []
  },
  {
    portCode: "INCD",
    portName: "Chilika LCS (Inland)",
    area: "Eastern",
    state: "Odisha",
    portType: "Inland",
    requiresAD: false,
    allowedADs: []
  }
]

// ============================================
// RULE 1: PORT CONSISTENCY CHECK
// ============================================

function validatePortConsistency(
  invoicePort: string,
  shippingBillPort: string
): { consistent: boolean; message: string } {
  const invoiceNormalized = invoicePort?.trim().toUpperCase()
  const billNormalized = shippingBillPort?.trim().toUpperCase()
  
  if (!invoiceNormalized || !billNormalized) {
    return {
      consistent: false,
      message: "Missing port information in invoice or shipping bill"
    }
  }
  
  const consistent = invoiceNormalized === billNormalized
  
  return {
    consistent,
    message: consistent
      ? `✅ Ports consistent: ${invoiceNormalized}`
      : `❌ Port mismatch - Invoice: ${invoiceNormalized} vs Shipping Bill: ${billNormalized}`
  }
}

// ============================================
// RULE 2: AD CODE REQUIREMENT CHECK
// ============================================

function checkADRequirement(portCode: string): {
  required: boolean
  allowedADs: string[]
  message: string
} {
  const port = ICEGATE_PORT_MASTER.find(
    p => p.portCode.toUpperCase() === portCode?.toUpperCase()
  )
  
  if (!port) {
    return {
      required: false,
      allowedADs: [],
      message: `⚠️  Port code ${portCode} not found in ICEGATE master - cannot determine AD requirement`
    }
  }
  
  return {
    required: port.requiresAD,
    allowedADs: port.allowedADs,
    message: port.requiresAD
      ? `🚩 AD Code Required for ${port.portName} - Allowed: ${port.allowedADs.join(", ")}`
      : `✅ No AD Code required for ${port.portName}`
  }
}

// ============================================
// RULE 3: AD CODE REGISTRATION CHECK
// ============================================

async function validateADCodeRegistration(
  exporterId: string,
  adCode: string,
  portCode: string
): Promise<{
  registered: boolean
  message: string
}> {
  if (!adCode || adCode.trim() === "") {
    return {
      registered: false,
      message: "AD Code not provided"
    }
  }
  
  try {
    const mapping = await prisma.exporterADMapping.findUnique({
      where: {
        exporterId_adCode_portCode: {
          exporterId,
          adCode: adCode.toUpperCase(),
          portCode: portCode.toUpperCase()
        }
      }
    })
    
    if (!mapping) {
      return {
        registered: false,
        message: `❌ AD Code ${adCode} not registered for this exporter at port ${portCode}`
      }
    }
    
    if (!mapping.isActive) {
      return {
        registered: false,
        message: `❌ AD Code ${adCode} is INACTIVE for this exporter at port ${portCode}`
      }
    }
    
    return {
      registered: true,
      message: `✅ AD Code ${adCode} verified for exporter at port ${portCode}`
    }
  } catch (error) {
    return {
      registered: false,
      message: `Error checking AD Code registration: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  }
}

// ============================================
// RULE 4: PORT CODE VALIDATION
// ============================================

function validatePortCode(portCode: string): {
  valid: boolean
  portName: string
  message: string
} {
  if (!portCode || portCode.trim() === "") {
    return {
      valid: false,
      portName: "",
      message: "Port code is empty"
    }
  }
  
  const port = ICEGATE_PORT_MASTER.find(
    p => p.portCode.toUpperCase() === portCode.toUpperCase()
  )
  
  if (!port) {
    return {
      valid: false,
      portName: "",
      message: `❌ Port code ${portCode} not found in ICEGATE master - Invalid port`
    }
  }
  
  return {
    valid: true,
    portName: port.portName,
    message: `✅ Port ${portCode} valid: ${port.portName} (${port.area})`
  }
}

// ============================================
// MAIN VALIDATION FUNCTION
// ============================================

export async function validatePortCompliance(
  input: PortComplianceInput
): Promise<PortComplianceResult> {
  const auditLog: PortComplianceResult["auditLog"] = []
  const errors: PortComplianceResult["errors"] = []
  const warnings: PortComplianceResult["warnings"] = []
  
  const startTime = new Date()
  
  // RULE 1: Port Consistency
  const portConsistencyCheck = validatePortConsistency(
    input.invoicePortOfLoading,
    input.shippingBillPortOfLoading
  )
  
  auditLog.push({
    timestamp: new Date(),
    ruleCode: "PORT_CONSISTENCY",
    ruleName: "Port Consistency Check",
    result: portConsistencyCheck.consistent,
    message: portConsistencyCheck.message
  })
  
  if (!portConsistencyCheck.consistent) {
    errors.push({
      code: "PORT_MISMATCH",
      message: portConsistencyCheck.message,
      severity: "BLOCKER"
    })
  }
  
  const normalizedPort = input.invoicePortOfLoading?.trim().toUpperCase() || ""
  
  // RULE 2: AD Code Requirement
  const adRequirementCheck = checkADRequirement(normalizedPort)
  
  auditLog.push({
    timestamp: new Date(),
    ruleCode: "AD_CODE_REQUIREMENT",
    ruleName: "AD Code Requirement Check",
    result: !adRequirementCheck.required || !!input.adCode,
    message: adRequirementCheck.message
  })
  
  if (adRequirementCheck.required && !input.adCode) {
    errors.push({
      code: "AD_CODE_REQUIRED",
      message: `${normalizedPort} requires AD Code. Provided: None. Required AD codes: ${adRequirementCheck.allowedADs.join(", ")}`,
      severity: "BLOCKER"
    })
  }
  
  // RULE 3: AD Code Registration (only if AD code is provided)
  let adCodeRegistered = true
  if (input.adCode) {
    const adRegistrationCheck = await validateADCodeRegistration(
      input.exporterId,
      input.adCode,
      normalizedPort
    )
    
    auditLog.push({
      timestamp: new Date(),
      ruleCode: "AD_CODE_REGISTRATION",
      ruleName: "AD Code Registration Check",
      result: adRegistrationCheck.registered,
      message: adRegistrationCheck.message
    })
    
    if (!adRegistrationCheck.registered) {
      errors.push({
        code: "AD_CODE_NOT_REGISTERED",
        message: adRegistrationCheck.message,
        severity: "BLOCKER"
      })
      adCodeRegistered = false
    }
  }
  
  // RULE 4: Port Code Validity
  const portValidityCheck = validatePortCode(normalizedPort)
  
  auditLog.push({
    timestamp: new Date(),
    ruleCode: "PORT_CODE_VALIDITY",
    ruleName: "Port Code Validity Check",
    result: portValidityCheck.valid,
    message: portValidityCheck.message
  })
  
  if (!portValidityCheck.valid) {
    errors.push({
      code: "INVALID_PORT_CODE",
      message: portValidityCheck.message,
      severity: "BLOCKER"
    })
  }
  
  // ============================================
  // COMPILE RESULTS
  // ============================================
  
  const isValid = errors.length === 0
  
  return {
    isValid,
    portConsistent: portConsistencyCheck.consistent,
    adCodeValid: !adRequirementCheck.required || !!input.adCode,
    adCodeRegistered,
    portCodeValid: portValidityCheck.valid,
    
    errors,
    warnings,
    
    validation: {
      invoicePortOfLoading: input.invoicePortOfLoading,
      shippingBillPortOfLoading: input.shippingBillPortOfLoading,
      portsMatch: portConsistencyCheck.consistent,
      adCodeRequired: adRequirementCheck.required,
      adCodeProvided: !!input.adCode,
      adCodeInMaster: adCodeRegistered,
      portCodeValid: portValidityCheck.valid
    },
    
    auditLog,
    validationTimestamp: startTime
  }
}

// ============================================
// HELPER: CAN GENERATE INVOICE DOCUMENTS?
// ============================================

export async function canGenerateInvoiceDocuments_PortCompliance(
  invoiceId: string,
  exporterId: string,
  invoicePortOfLoading: string,
  shippingBillPortOfLoading: string,
  adCode?: string,
  modeOfTransport: string = "Sea"
): Promise<{
  allowed: boolean
  blockers: Array<{ code: string; message: string }>
  warnings: string[]
}> {
  const result = await validatePortCompliance({
    invoiceId,
    exporterId,
    invoicePortOfLoading,
    shippingBillPortOfLoading,
    adCode,
    modeOfTransport
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

export function generatePortComplianceReport(
  result: PortComplianceResult
): string {
  const lines: string[] = []
  
  lines.push("=".repeat(60))
  lines.push("PORT COMPLIANCE VALIDATION REPORT")
  lines.push("=".repeat(60))
  lines.push("")
  
  lines.push(`Port of Loading: ${result.validation.invoicePortOfLoading}`)
  lines.push(`Ports Match: ${result.validation.portsMatch ? "✅ Yes" : "❌ No"}`)
  lines.push(`AD Code Required: ${result.validation.adCodeRequired ? "Yes" : "No"}`)
  lines.push(`AD Code Provided: ${result.validation.adCodeProvided ? "Yes" : "No"}`)
  lines.push(`AD Code Valid: ${result.validation.adCodeInMaster ? "✅ Yes" : "❌ No"}`)
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
    lines.push(`  ${log.timestamp.toISOString()} | ${log.ruleCode.padEnd(25)} | ${log.result ? "✅" : "❌"} | ${log.message}`)
  })
  
  lines.push("")
  lines.push("=".repeat(60))
  
  return lines.join("\n")
}

// ============================================
// HELPER: REGISTER EXPORTER AD CODE
// ============================================

export async function registerExporterADMapping(
  exporterId: string,
  adCode: string,
  portCode: string,
  isActive: boolean = true
): Promise<{ success: boolean; message: string }> {
  try {
    const existingExporter = await prisma.exporter.findUnique({
      where: { id: exporterId },
      select: { id: true }
    })

    if (!existingExporter) {
      await prisma.exporter.create({
        data: {
          id: exporterId,
          name: `Test Exporter ${exporterId}`,
          address: "Test Address",
          iec: "1234567890",
        }
      })
    }

    await prisma.exporterADMapping.upsert({
      where: {
        exporterId_adCode_portCode: {
          exporterId,
          adCode: adCode.toUpperCase(),
          portCode: portCode.toUpperCase()
        }
      },
      update: {
        isActive
      },
      create: {
        exporterId,
        adCode: adCode.toUpperCase(),
        portCode: portCode.toUpperCase(),
        isActive
      }
    })
    
    return {
      success: true,
      message: `✅ AD mapping registered: ${adCode} → ${portCode} for exporter`
    }
  } catch (error) {
    return {
      success: false,
      message: `Error registering AD mapping: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  }
}

// ============================================
// HELPER: GET EXPORTER AD MAPPINGS
// ============================================

export async function getExporterADMappings(
  exporterId: string
): Promise<
  Array<{
    adCode: string
    portCode: string
    isActive: boolean
  }>
> {
  const mappings = await prisma.exporterADMapping.findMany({
    where: { exporterId },
    select: { adCode: true, portCode: true, isActive: true }
  })
  
  return mappings
}
