/**
 * AD CODE + PORT VALIDATION SERVICE
 * ==================================
 * 
 * Prevents Shipping Bill rejections by enforcing:
 * 1. AD Code mandatory for specific ports
 * 2. Port of Loading consistency (Invoice ↔ Shipping Bill)
 * 3. Exporter-AD mapping validation
 * 4. Custom House vs Sea Port vs Air Port rules
 * 
 * Shipping Bill Rejection Causes (This Service Fixes):
 * - AD Code missing/invalid for declared port
 * - Port in invoice ≠ Port in Shipping Bill
 * - Exporter not mapped to AD for chosen port
 * - AD Code inactive/expired for shipment date
 * - Port not accessible from exporter's location
 * 
 * Regulatory Framework:
 * - FEMA (Foreign Exchange Management Act) - AD registration
 * - Customs Act - Shipping Bill requirements
 * - ICEGATE - Port accessibility matrix
 */

// ============================================
// PORT MASTER DATA (India Customs)
// ============================================

export type PortType = "Sea" | "Air" | "Land" | "ICD" | "CFS"

export interface PortMaster {
  portCode: string // ICEGATE code (INMAA1, INDEF1, etc.)
  portName: string
  portType: PortType
  state: string
  adCodeRequired: boolean // true = AD code MUST be mentioned in Shipping Bill
  adCodeOptional: boolean // true = AD code optional but recommended
  operatingHours: string // "24x7" | "0600-2200" etc
  facilities: string[] // ["Bonded Warehouse", "Cold Storage", etc]
  majorCommodities?: string[] // ["Textiles", "Engineering", etc]
  icegateActive: boolean
}

export const PORT_MASTER: Record<string, PortMaster> = {
  // ===== SEA PORTS (Major) =====
  "INMAA1": {
    portCode: "INMAA1",
    portName: "MARMUGAO",
    portType: "Sea",
    state: "Goa",
    adCodeRequired: true,
    adCodeOptional: false,
    operatingHours: "24x7",
    facilities: ["Bonded Warehouse", "Container Terminal"],
    majorCommodities: ["Iron Ore", "Minerals", "General Cargo"],
    icegateActive: true,
  },
  "INMAA2": {
    portCode: "INMAA2",
    portName: "MANGALORE",
    portType: "Sea",
    state: "Karnataka",
    adCodeRequired: true,
    adCodeOptional: false,
    operatingHours: "24x7",
    facilities: ["Bonded Warehouse", "Container Terminal", "Oil Terminal"],
    majorCommodities: ["Textiles", "Engineering", "Chemicals"],
    icegateActive: true,
  },
  "INMAA3": {
    portCode: "INMAA3",
    portName: "COCHIN",
    portType: "Sea",
    state: "Kerala",
    adCodeRequired: true,
    adCodeOptional: false,
    operatingHours: "24x7",
    facilities: ["Bonded Warehouse", "Container Terminal", "Spice Market"],
    majorCommodities: ["Spices", "General Cargo", "Textiles"],
    icegateActive: true,
  },
  "INMAA5": {
    portCode: "INMAA5",
    portName: "JAWAHARLAL NEHRU (Nhava Sheva)",
    portType: "Sea",
    state: "Maharashtra",
    adCodeRequired: true,
    adCodeOptional: false,
    operatingHours: "24x7",
    facilities: ["Bonded Warehouse", "Container Terminal", "Multipurpose Terminal"],
    majorCommodities: ["All categories - largest port"],
    icegateActive: true,
  },
  "INMAA6": {
    portCode: "INMAA6",
    portName: "KANDLA",
    portType: "Sea",
    state: "Gujarat",
    adCodeRequired: true,
    adCodeOptional: false,
    operatingHours: "24x7",
    facilities: ["Bonded Warehouse", "Container Terminal"],
    majorCommodities: ["General Cargo", "Engineering", "Chemicals"],
    icegateActive: true,
  },

  // ===== AIR PORTS (Customs Houses) =====
  "INDEF1": {
    portCode: "INDEF1",
    portName: "INDIRA GANDHI INTERNATIONAL (NEW DELHI)",
    portType: "Air",
    state: "Delhi",
    adCodeRequired: true,
    adCodeOptional: false,
    operatingHours: "24x7",
    facilities: ["Air Cargo Complex", "Bonded Warehouse", "Cold Chain"],
    majorCommodities: ["Software", "Jewelry", "Pharmaceuticals", "Light Engineering"],
    icegateActive: true,
  },
  "INDEF2": {
    portCode: "INDEF2",
    portName: "BOMBAY INTERNATIONAL (MUMBAI)",
    portType: "Air",
    state: "Maharashtra",
    adCodeRequired: true,
    adCodeOptional: false,
    operatingHours: "24x7",
    facilities: ["Air Cargo Complex", "Bonded Warehouse", "Cold Chain", "Perishables"],
    majorCommodities: ["Pharmaceuticals", "Jewelry", "Engineering", "Textiles"],
    icegateActive: true,
  },
  "INDEF3": {
    portCode: "INDEF3",
    portName: "BANGALORE INTERNATIONAL",
    portType: "Air",
    state: "Karnataka",
    adCodeRequired: true,
    adCodeOptional: false,
    operatingHours: "24x7",
    facilities: ["Air Cargo Complex", "Bonded Warehouse", "IT Hub"],
    majorCommodities: ["IT/Software", "Electronics", "Pharmaceuticals"],
    icegateActive: true,
  },
  "INDEF5": {
    portCode: "INDEF5",
    portName: "CHHATRAPATI SHIVAJI INTERNATIONAL (CHENNAI)",
    portType: "Air",
    state: "Tamil Nadu",
    adCodeRequired: true,
    adCodeOptional: false,
    operatingHours: "24x7",
    facilities: ["Air Cargo Complex", "Bonded Warehouse"],
    majorCommodities: ["Textiles", "Engineering", "Automotive"],
    icegateActive: true,
  },

  // ===== ICD (Inland Container Depots) =====
  "INCCD": {
    portCode: "INCCD",
    portName: "CONTAINER CORPORATION (Delhi)",
    portType: "ICD",
    state: "Delhi",
    adCodeRequired: true,
    adCodeOptional: false,
    operatingHours: "0600-2200",
    facilities: ["Container Parking", "CFS", "Bonded Warehouse"],
    majorCommodities: ["General Cargo", "Engineering", "Chemicals"],
    icegateActive: true,
  },
}

// ============================================
// EXPORTER ↔ AD MAPPING TABLE
// Links exporters to their Authorized Dealers per port
// ============================================

export interface ExporterADMapping {
  id: string
  exporterId: string
  exporterName: string
  exporterIEC: string
  adCode: string // Authorized Dealer code (0001-9999)
  adBankName: string
  adCity: string
  adState: string
  primaryPort: string // INMAA1, INMAA5, etc (ICEGATE code)
  secondaryPorts?: string[] // Other ports this AD can handle
  adActivationDate: Date
  adExpirationDate?: Date
  status: "Active" | "Inactive" | "Suspended"
  verifiedAt: Date
  verificationReference: string // e.g., "FEMA/RBI/AUTH/2024-001"
}

// Example mappings (real data would come from RBI/FEMA database)
export const EXPORTER_AD_MAPPINGS: ExporterADMapping[] = [
  {
    id: "map-001",
    exporterId: "exp-001", // TCS Tech Exports
    exporterName: "TCS Tech Exports Ltd",
    exporterIEC: "0123456789",
    adCode: "0001",
    adBankName: "CITIBANK NA, NEW DELHI",
    adCity: "New Delhi",
    adState: "Delhi",
    primaryPort: "INDEF1",
    secondaryPorts: ["INMAA5"],
    adActivationDate: new Date("2023-01-15"),
    status: "Active",
    verifiedAt: new Date("2023-01-15"),
    verificationReference: "FEMA/RBI/AUTH/2023-001",
  },
  {
    id: "map-002",
    exporterId: "exp-001", // TCS Tech Exports (secondary AD)
    exporterName: "TCS Tech Exports Ltd",
    exporterIEC: "0123456789",
    adCode: "0005",
    adBankName: "HSBC BANK Mumbai",
    adCity: "Mumbai",
    adState: "Maharashtra",
    primaryPort: "INMAA5",
    secondaryPorts: ["INMAA2", "INMAA3"],
    adActivationDate: new Date("2023-02-01"),
    status: "Active",
    verifiedAt: new Date("2023-02-01"),
    verificationReference: "FEMA/RBI/AUTH/2023-002",
  },
  {
    id: "map-003",
    exporterId: "exp-002", // Cotton Textiles
    exporterName: "Cotton Textiles Exports",
    exporterIEC: "9876543210",
    adCode: "0010",
    adBankName: "STATE BANK OF INDIA",
    adCity: "Bangalore",
    adState: "Karnataka",
    primaryPort: "INDEF3",
    secondaryPorts: ["INMAA2"],
    adActivationDate: new Date("2022-06-01"),
    status: "Active",
    verifiedAt: new Date("2022-06-01"),
    verificationReference: "FEMA/RBI/AUTH/2022-001",
  },
  {
    id: "map-004",
    exporterId: "exp-003", // Spice Exporter
    exporterName: "Spice World Exports",
    exporterIEC: "5555555555",
    adCode: "0015",
    adBankName: "FEDERAL BANK Kochi",
    adCity: "Kochi",
    adState: "Kerala",
    primaryPort: "INMAA3",
    secondaryPorts: ["INMAA2"],
    adActivationDate: new Date("2023-03-15"),
    status: "Active",
    verifiedAt: new Date("2023-03-15"),
    verificationReference: "FEMA/RBI/AUTH/2023-003",
  },
]

// ============================================
// VALIDATION RESULT TYPES
// ============================================

export interface ADCodeValidation {
  adCode: string
  isValid: boolean
  issues: Array<{
    type: "Error" | "Warning"
    code: string
    message: string
    resolution?: string
  }>
  bankName?: string
  bankCity?: string
  activeState: "Active" | "Inactive" | "Expired" | "Suspended"
  expiryDate?: Date
}

export interface PortValidation {
  portCode: string
  isValid: boolean
  portName?: string
  portType?: PortType
  adCodeRequired: boolean
  issues: Array<{
    type: "Error" | "Warning"
    message: string
    resolution?: string
  }>
}

export interface ExporterPortADFit {
  exporterId: string
  portCode: string
  adCode?: string
  isFit: boolean // true = exporter can use this port with this AD
  issues: Array<{
    severity: "Error" | "Warning"
    message: string
    resolution?: string
  }>
  suggestedADCodes?: string[] // Alternative ADs if primary fails
}

export interface PortConsistencyCheck {
  invoicePortCode: string
  shippingBillPortCode: string
  consistent: boolean
  issues?: Array<{
    type: "Error" | "Warning"
    message: string
    resolution?: string
  }>
}

export interface CompleteADPortValidation {
  exporterId: string
  invoicePortCode: string
  shippingBillPortCode: string
  adCode?: string
  
  // Validations
  adCodeExists: boolean
  adCodeActive: boolean
  portExists: boolean
  portADRequired: boolean
  exporterPortADFit: boolean
  portConsistency: boolean
  
  // Gate
  canProceed: boolean // true = Shipping Bill can be filed
  
  issues: Array<{
    category: "AD Code" | "Port" | "Exporter-Port-AD Fit" | "Port Consistency"
    severity: "Error" | "Warning"
    message: string
    resolution?: string
  }>
  
  // Suggestions
  recommendedADCode?: string
  alternativeADCodes?: string[]
  alternativePorts?: string[]
  
  validatedAt: Date
}

// ============================================
// CORE VALIDATION FUNCTIONS
// ============================================

/**
 * VALIDATION 1: AD Code Exists & Active
 */
export function validateADCodeStatus(adCode: string, checkDate: Date = new Date()): ADCodeValidation {
  const issues: ADCodeValidation["issues"] = []

  // Format check
  if (!adCode || !/^\d{4}$/.test(adCode)) {
    issues.push({
      type: "Error",
      code: "INVALID_FORMAT",
      message: "AD Code must be 4 digits (0001-9999)",
      resolution: "Verify AD Code from bank correspondence",
    })

    return {
      adCode,
      isValid: false,
      issues,
      activeState: "Inactive",
    }
  }

  // Find first active mapping with this AD code
  const mapping = EXPORTER_AD_MAPPINGS.find(
    (m) => m.adCode === adCode && m.status === "Active"
  )

  if (!mapping) {
    issues.push({
      type: "Error",
      code: "AD_NOT_FOUND",
      message: `AD Code ${adCode} not found in active mappings`,
      resolution: "Verify with your bank or Authorized Dealer",
    })

    return {
      adCode,
      isValid: false,
      issues,
      activeState: "Inactive",
    }
  }

  // Check expiration
  if (mapping.adExpirationDate && checkDate > mapping.adExpirationDate) {
    issues.push({
      type: "Error",
      code: "AD_EXPIRED",
      message: `AD Code ${adCode} expired on ${mapping.adExpirationDate.toDateString()}`,
      resolution: "Contact bank to renew AD Code authorization",
    })

    return {
      adCode,
      isValid: false,
      issues,
      bankName: mapping.adBankName,
      bankCity: mapping.adCity,
      activeState: "Expired",
      expiryDate: mapping.adExpirationDate,
    }
  }

  // Check activation
  if (checkDate < mapping.adActivationDate) {
    issues.push({
      type: "Warning",
      code: "AD_NOT_YET_ACTIVE",
      message: `AD Code ${adCode} becomes active on ${mapping.adActivationDate.toDateString()}`,
      resolution: "Use different AD Code or wait until activation date",
    })

    return {
      adCode,
      isValid: false,
      issues,
      bankName: mapping.adBankName,
      bankCity: mapping.adCity,
      activeState: "Inactive",
    }
  }

  return {
    adCode,
    isValid: true,
    issues: [],
    bankName: mapping.adBankName,
    bankCity: mapping.adCity,
    activeState: "Active",
    expiryDate: mapping.adExpirationDate,
  }
}

/**
 * VALIDATION 2: Port Exists & Get Requirements
 */
export function validatePortAvailability(portCode: string): PortValidation {
  const issues: PortValidation["issues"] = []

  if (!portCode || portCode.trim() === "") {
    issues.push({
      type: "Error",
      message: "Port code is missing",
      resolution: "Specify port code (e.g., INMAA5, INDEF1)",
    })

    return {
      portCode,
      isValid: false,
      adCodeRequired: false,
      issues,
    }
  }

  const port = PORT_MASTER[portCode.toUpperCase()]

  if (!port) {
    issues.push({
      type: "Error",
      message: `Port code ${portCode} not found in ICEGATE master`,
      resolution: "Use valid port code from ICEGATE port list",
    })

    return {
      portCode: portCode.toUpperCase(),
      isValid: false,
      adCodeRequired: false,
      issues,
    }
  }

  if (!port.icegateActive) {
    issues.push({
      type: "Warning",
      message: `Port ${port.portName} is not currently active in ICEGATE`,
      resolution: "Contact customs authority or use alternative port",
    })
  }

  return {
    portCode: port.portCode,
    isValid: true,
    portName: port.portName,
    portType: port.portType,
    adCodeRequired: port.adCodeRequired,
    issues,
  }
}

/**
 * VALIDATION 3: Exporter-Port-AD Fit
 * Checks if exporter is authorized to use this port via this AD
 */
export function validateExporterPortADFit(
  exporterId: string,
  portCode: string,
  adCode?: string
): ExporterPortADFit {
  const issues: ExporterPortADFit["issues"] = []
  let suggestedADCodes: string[] = []

  // Find all ADs for this exporter
  const exporterADs = EXPORTER_AD_MAPPINGS.filter((m) => m.exporterId === exporterId && m.status === "Active")

  if (exporterADs.length === 0) {
    issues.push({
      severity: "Error",
      message: `No active AD codes found for exporter ${exporterId}`,
      resolution: "Update AD mapping with bank",
    })

    return {
      exporterId,
      portCode,
      isFit: false,
      issues,
    }
  }

  // Check if exporter can use this port
  const eligibleADs = exporterADs.filter(
    (m) => m.primaryPort === portCode || (m.secondaryPorts && m.secondaryPorts.includes(portCode))
  )

  if (eligibleADs.length === 0) {
    suggestedADCodes = exporterADs.map((m) => m.adCode)

    issues.push({
      severity: "Error",
      message: `Exporter not authorized for port ${portCode}. Current ports: ${exporterADs.map((m) => m.primaryPort).join(", ")}`,
      resolution: `Use port(s): ${exporterADs.map((m) => m.primaryPort).join(", ")} or update AD mapping`,
    })

    return {
      exporterId,
      portCode,
      isFit: false,
      issues,
      suggestedADCodes,
    }
  }

  // If AD code provided, verify it matches exporter & port
  if (adCode) {
    const matchingAD = eligibleADs.find((m) => m.adCode === adCode)

    if (!matchingAD) {
      issues.push({
        severity: "Error",
        message: `AD Code ${adCode} NOT authorized for this exporter at port ${portCode}`,
        resolution: `Use one of these AD codes: ${eligibleADs.map((m) => m.adCode).join(", ")}`,
      })

      return {
        exporterId,
        portCode,
        adCode,
        isFit: false,
        issues,
        suggestedADCodes: eligibleADs.map((m) => m.adCode),
      }
    }

    return {
      exporterId,
      portCode,
      adCode,
      isFit: true,
      issues: [],
      suggestedADCodes: eligibleADs.map((m) => m.adCode),
    }
  }

  // If no AD code provided, suggest first eligible
  const suggestedAD = eligibleADs[0]

  return {
    exporterId,
    portCode,
    adCode: suggestedAD?.adCode,
    isFit: true,
    issues: [],
    suggestedADCodes: eligibleADs.map((m) => m.adCode),
  }
}

/**
 * VALIDATION 4: Port Consistency Check
 * Ensures invoice port matches shipping bill port
 */
export function validatePortConsistency(
  invoicePortCode: string,
  shippingBillPortCode: string
): PortConsistencyCheck {
  const issues: PortConsistencyCheck["issues"] = []

  // Normalize codes
  const invoicePort = invoicePortCode?.toUpperCase() || ""
  const shippingPort = shippingBillPortCode?.toUpperCase() || ""

  if (!invoicePort) {
    issues.push({
      type: "Error",
      message: "Invoice port code missing",
      resolution: "Specify port in invoice",
    })
  }

  if (!shippingPort) {
    issues.push({
      type: "Error",
      message: "Shipping Bill port code missing",
      resolution: "Specify port in Shipping Bill",
    })
  }

  if (invoicePort && shippingPort && invoicePort !== shippingPort) {
    issues.push({
      type: "Error",
      message: `Port mismatch: Invoice=${invoicePort}, Shipping Bill=${shippingPort}`,
      resolution: "Correct one port to match the other",
    })
  }

  return {
    invoicePortCode: invoicePort,
    shippingBillPortCode: shippingPort,
    consistent: invoicePort === shippingPort && invoicePort !== "",
    issues: issues.length > 0 ? issues : undefined,
  }
}

// ============================================
// MASTER VALIDATION: COMPLETE AD + PORT CHECK
// ============================================

export interface CompleteADPortCheckInput {
  exporterId: string
  invoicePortCode: string
  shippingBillPortCode: string
  adCode?: string
  shippingDate: Date
}

/**
 * Run all 4 validations + return complete compliance
 */
export function validateCompleteADPort(input: CompleteADPortCheckInput): CompleteADPortValidation {
  const issues: CompleteADPortValidation["issues"] = []
  let canProceed = true

  // VALIDATION 1: AD Code Status
  const adValidation = input.adCode ? validateADCodeStatus(input.adCode, input.shippingDate) : { isValid: !!input.adCode, activeState: "Active", issues: [] }
  const adCodeExists = !!input.adCode
  const adCodeActive = adValidation.isValid

  if (input.adCode && !adCodeActive) {
    issues.push({
      category: "AD Code",
      severity: "Error",
      message: adValidation.issues[0]?.message || "AD Code is not valid",
      resolution: adValidation.issues[0]?.resolution,
    })
    canProceed = false
  }

  // VALIDATION 2: Port Availability
  const invoicePortValidation = validatePortAvailability(input.invoicePortCode)
  const portExists = invoicePortValidation.isValid
  const portADRequired = invoicePortValidation.adCodeRequired

  if (!portExists) {
    issues.push({
      category: "Port",
      severity: "Error",
      message: invoicePortValidation.issues[0]?.message || "Port not found",
      resolution: invoicePortValidation.issues[0]?.resolution,
    })
    canProceed = false
  }

  // VALIDATION 3: Exporter-Port-AD Fit
  const fitValidation = validateExporterPortADFit(input.exporterId, input.invoicePortCode, input.adCode)
  const exporterPortADFit = fitValidation.isFit

  if (!exporterPortADFit) {
    issues.push({
      category: "Exporter-Port-AD Fit",
      severity: "Error",
      message: fitValidation.issues[0]?.message || "Exporter not fit for this port-AD combination",
      resolution: fitValidation.issues[0]?.resolution,
    })
    canProceed = false
  }

  // VALIDATION 4: Port Consistency
  const consistencyCheck = validatePortConsistency(input.invoicePortCode, input.shippingBillPortCode)
  const portConsistency = consistencyCheck.consistent

  if (!portConsistency) {
    issues.push({
      category: "Port Consistency",
      severity: "Error",
      message: consistencyCheck.issues?.[0]?.message || "Port mismatch",
      resolution: consistencyCheck.issues?.[0]?.resolution,
    })
    canProceed = false
  }

  // Check AD Code requirement
  if (portADRequired && !adCodeExists) {
    issues.push({
      category: "AD Code",
      severity: "Error",
      message: `AD Code is MANDATORY for port ${input.invoicePortCode}`,
      resolution: `Provide AD Code for this port. Available: ${fitValidation.suggestedADCodes?.join(", ")}`,
    })
    canProceed = false
  }

  return {
    exporterId: input.exporterId,
    invoicePortCode: input.invoicePortCode,
    shippingBillPortCode: input.shippingBillPortCode,
    adCode: input.adCode,

    adCodeExists,
    adCodeActive,
    portExists,
    portADRequired,
    exporterPortADFit,
    portConsistency,

    canProceed,
    issues,

    recommendedADCode: fitValidation.suggestedADCodes?.[0],
    alternativeADCodes: fitValidation.suggestedADCodes,

    validatedAt: new Date(),
  }
}

/**
 * Get AD mappings for exporter (for UI dropdown)
 */
export function getExporterADOptions(exporterId: string, portCode?: string): ExporterADMapping[] {
  let mappings = EXPORTER_AD_MAPPINGS.filter(
    (m) => m.exporterId === exporterId && m.status === "Active"
  )

  if (portCode) {
    mappings = mappings.filter(
      (m) => m.primaryPort === portCode || (m.secondaryPorts && m.secondaryPorts.includes(portCode))
    )
  }

  return mappings
}

/**
 * Get available ports for exporter
 */
export function getExporterAvailablePorts(exporterId: string): PortMaster[] {
  const exporterMappings = EXPORTER_AD_MAPPINGS.filter(
    (m) => m.exporterId === exporterId && m.status === "Active"
  )

  const portCodes = new Set<string>()
  exporterMappings.forEach((m) => {
    portCodes.add(m.primaryPort)
    m.secondaryPorts?.forEach((p) => portCodes.add(p))
  })

  return Array.from(portCodes)
    .map((code) => PORT_MASTER[code])
    .filter(Boolean)
}

/**
 * Get shipping bill filing readiness
 */
export interface ShippingBillReadiness {
  invoiceId: string
  exporterId: string
  invoicePortCode: string
  adCode?: string
  canFileShippingBill: boolean
  blockers: string[]
  warnings: string[]
  status: "Ready" | "Blocked" | "Warning"
}

export function checkShippingBillReadiness(
  invoiceId: string,
  exporterId: string,
  invoicePortCode: string,
  shippingBillPortCode: string,
  adCode?: string
): ShippingBillReadiness {
  const validation = validateCompleteADPort({
    exporterId,
    invoicePortCode,
    shippingBillPortCode,
    adCode,
    shippingDate: new Date(),
  })

  const blockers: string[] = []
  const warnings: string[] = []

  validation.issues.forEach((issue) => {
    if (issue.severity === "Error") {
      blockers.push(issue.message)
    } else {
      warnings.push(issue.message)
    }
  })

  const status = blockers.length > 0 ? "Blocked" : warnings.length > 0 ? "Warning" : "Ready"

  return {
    invoiceId,
    exporterId,
    invoicePortCode,
    adCode,
    canFileShippingBill: validation.canProceed,
    blockers,
    warnings,
    status,
  }
}
