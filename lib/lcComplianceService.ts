import { prisma } from "@/lib/db"
import {
  validateLCCompliance,
  type InvoiceData,
  type LCTerms,
  type LCComplianceCheckResult,
} from "@/lib/lcComplianceEngine"

export type LCValidationContext = {
  invoice: InvoiceData
  lc: LCTerms
}

function buildLCValidationContext(rawInvoice: any): LCValidationContext {
  const lcRecord = rawInvoice.lettersOfCredit[0]
  const firstItem = rawInvoice.items[0]

  return {
    invoice: {
      invoiceNumber: rawInvoice.invoiceNumber || "UNKNOWN",
      invoiceDate: rawInvoice.invoiceDate,
      description: firstItem.description,
      quantity: Number(firstItem.quantity),
      shipmentDate: new Date(),
      currencyCode: rawInvoice.currency,
      invoiceValue: Number(rawInvoice.totalValue),
    },
    lc: {
      lcNumber: lcRecord.lcNumber,
      lcDescriptionText: lcRecord.lcDescriptionText,
      latestShipmentDate: lcRecord.latestShipmentDate,
      presentationDays: lcRecord.presentationDays,
      partialShipmentAllowed: lcRecord.partialShipmentAllowed,
      tolerancePercent: lcRecord.tolerancePercent || undefined,
      governedBy: lcRecord.governedBy,
    },
  }
}

export async function fetchLCValidationContext(invoiceId: string): Promise<LCValidationContext | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lettersOfCredit: true,
      items: true,
    },
  })

  const lc = invoice?.lettersOfCredit?.[0]

  if (!invoice || !lc) {
    throw new Error("Missing LC or Invoice data")
  }

  if (!invoice.items || invoice.items.length === 0) {
    throw new Error("No items in invoice")
  }

  return buildLCValidationContext(invoice)
}

export async function runLCComplianceForInvoice(invoiceId: string): Promise<LCComplianceCheckResult | null> {
  console.log("Running LC compliance for invoice:", invoiceId)
  const context = await fetchLCValidationContext(invoiceId)
  if (!context) return null

  return validateLCCompliance(context.invoice, context.lc)
}

export async function validateLCComplianceWithContext(
  context: LCValidationContext
): Promise<LCComplianceCheckResult> {
  return validateLCCompliance(context.invoice, context.lc)
}

export async function canGenerateInvoiceDocuments(
  invoiceId: string
): Promise<{
  allowed: boolean
  blockers: string[]
  warnings: string[]
}> {
  try {
    const compliance = await runLCComplianceForInvoice(invoiceId)

    if (!compliance) {
      return {
        allowed: true,
        blockers: [],
        warnings: [],
      }
    }

    return {
      allowed: compliance.allowDocumentGeneration,
      blockers: compliance.blockers.map((b) => b.message),
      warnings: compliance.warnings.map((w) => w.message),
    }
  } catch (error: any) {
    return {
      allowed: false,
      blockers: [`LC compliance check failed: ${error.message}`],
      warnings: [],
    }
  }
}

export async function storeLC(invoiceId: string, lc: LCTerms): Promise<string> {
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
        governedBy: lc.governedBy || "UCP 600",
      },
    })

    return stored.id
  } catch (error: any) {
    throw new Error(`Failed to store LC: ${error.message}`)
  }
}
