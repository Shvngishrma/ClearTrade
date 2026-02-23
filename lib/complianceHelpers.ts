/**
 * Compliance Helpers
 * Utility functions for using the compliance blocks engine
 */

import { generateComplianceBlocks, formatDeclarationDocument, validateComplianceConfig } from "./complianceBlocks"
import type { ComplianceConfig } from "./complianceBlocks"
import { DEFAULT_EXCHANGE_RATES } from "./calculations"

/**
 * Determine GST type from user data or defaults
 * This would typically come from user profile/company registration
 */
export function determineGSTType(data: {
  gstNumber?: string
  isRegistered?: boolean
  isCompositionScheme?: boolean
  isSEZ?: boolean
  isDeemedExport?: boolean
}): string {
  if (data.isSEZ) return "sez"
  if (data.isDeemedExport) return "deemed_export"
  if (data.isCompositionScheme) return "composition"
  if (data.isRegistered === false) return "unregistered"
  return "registered" // Default
}

/**
 * Build compliance config from invoice and user data
 */
export function buildComplianceConfig(invoiceData: {
  paymentTerms: string
  incoterm: string
  lcNumber?: string
  portOfLoading?: string
  portOfDischarge?: string
  currency?: string
  hasRestrictedGoods?: boolean
  hasHazardousGoods?: boolean
  hasCOO?: boolean
}, gstType: string = "registered"): ComplianceConfig {
  const config: ComplianceConfig = {
    paymentTerms: invoiceData.paymentTerms,
    incoterm: invoiceData.incoterm,
    gstType: gstType,
    lcNumber: invoiceData.lcNumber,
    portOfLoading: invoiceData.portOfLoading,
    portOfDischarge: invoiceData.portOfDischarge,
    currency: invoiceData.currency || "USD",
    exchangeRate: DEFAULT_EXCHANGE_RATES[invoiceData.currency || "USD"] || 83.45,
    hasRestrictedGoods: invoiceData.hasRestrictedGoods || false,
    hasHazardousGoods: invoiceData.hasHazardousGoods || false,
    hasCOO: invoiceData.hasCOO || false,
  }

  return config
}

/**
 * Generate complete compliance document text
 */
export function generateComplianceDocument(
  config: ComplianceConfig,
  exporterName: string,
  exporterAddress: string,
  buyerName: string,
  buyerCountry: string,
  date: string,
  place: string
): string {
  // Validate config
  const validationErrors = validateComplianceConfig(config)
  if (validationErrors.length > 0) {
    console.warn("Compliance config validation warnings:", validationErrors)
  }

  // Generate blocks
  const blocks = generateComplianceBlocks(config)

  // Format document
  return formatDeclarationDocument(
    exporterName,
    exporterAddress,
    buyerName,
    buyerCountry,
    blocks,
    date,
    place
  )
}

/**
 * Get compliance summary for display
 */
export function getComplianceSummary(config: ComplianceConfig): string {
  const parts: string[] = []

  parts.push(`Payment: ${config.paymentTerms}`)
  if (config.paymentTerms === "LC" && config.lcNumber) {
    parts.push(`(${config.lcNumber})`)
  }

  parts.push(`Incoterm: ${config.incoterm}`)
  parts.push(`GST: ${config.gstType.replace(/_/g, " ").toUpperCase()}`)

  if (config.hasHazardousGoods) parts.push("🔴 Hazardous Goods")
  if (config.hasRestrictedGoods) parts.push("🟠 Restricted Goods")
  if (config.hasCOO) parts.push("📄 Certificate of Origin")

  return parts.join(" | ")
}
