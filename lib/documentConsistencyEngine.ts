import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

type ValidationResult = {
  valid: boolean
  errors: string[]
  warnings: string[]
}

type InvoiceDoc = {
  totalValue: Prisma.Decimal
  currency: string
  countryOfOrigin: string | null
  items: {
    quantity: number
  }[]
  netWeight?: Prisma.Decimal | null
  grossWeight?: Prisma.Decimal | null
}

type PackingListDoc = {
  totalBoxes?: number | null
  netWeight: Prisma.Decimal
  grossWeight: Prisma.Decimal
  cartons?: {
    quantity: number
  }[]
}

export function validateInvoicePackingConsistency(
  invoice: InvoiceDoc,
  packing: PackingListDoc
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // --------------------------------
  // 1️⃣ Total Quantity Check
  // --------------------------------

  const invoiceQty = invoice.items.reduce((sum, i) => sum + i.quantity, 0)

  const cartonQty = packing.cartons
    ? packing.cartons.reduce((sum, c) => sum + c.quantity, 0)
    : null

  if (cartonQty !== null) {
    if (invoiceQty !== cartonQty) {
      errors.push(
        `Quantity mismatch: Invoice (${invoiceQty}) vs Cartons (${cartonQty})`
      )
    }
  }

  // --------------------------------
  // 2️⃣ Net Weight Match (Strict)
  // --------------------------------

  if (
    invoice.netWeight &&
    !invoice.netWeight.equals(packing.netWeight)
  ) {
    errors.push(
      `Net Weight mismatch: Invoice (${invoice.netWeight}) vs Packing (${packing.netWeight})`
    )
  }

  // --------------------------------
  // 3️⃣ Gross Weight Match (Strict)
  // --------------------------------

  if (
    invoice.grossWeight &&
    !invoice.grossWeight.equals(packing.grossWeight)
  ) {
    errors.push(
      `Gross Weight mismatch: Invoice (${invoice.grossWeight}) vs Packing (${packing.grossWeight})`
    )
  }

  // --------------------------------
  // 4️⃣ Currency Match (Strict)
  // --------------------------------

  if (!invoice.currency) {
    errors.push("Invoice currency missing.")
  }

  // Packing list should inherit invoice currency
  // If later added explicitly:
  // if (invoice.currency !== packing.currency) { ... }

  // --------------------------------
  // 5️⃣ Country of Origin (Strict)
  // --------------------------------

  if (!invoice.countryOfOrigin) {
    errors.push("Country of Origin missing in Invoice.")
  }

  // If later added to packing list:
  // if (invoice.countryOfOrigin !== packing.countryOfOrigin) { ... }

  // --------------------------------
  // 6️⃣ Total Value (Warning Only)
  // --------------------------------

  // Packing list does not require total match
  // But we log if discrepancy logic added later

  // --------------------------------
  // Final Result
  // --------------------------------

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

export async function validateInvoicePackingAlignment(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: true,
      packingLists: {
        include: {
          cartons: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  })

  if (!invoice) {
    throw new Error(`DOCUMENT_MISMATCH: Invoice not found (${invoiceId})`)
  }

  const packing = invoice.packingLists?.[0]
  if (!packing) {
    return
  }

  const hasCompleteInvoiceNet = invoice.items.length > 0 && invoice.items.every((item) => item.netWeight !== null)
  const hasCompleteInvoiceGross = invoice.items.length > 0 && invoice.items.every((item) => item.grossWeight !== null)

  const invoiceNetWeight = hasCompleteInvoiceNet
    ? invoice.items.reduce((sum, item) => sum.add(item.netWeight as Prisma.Decimal), new Prisma.Decimal(0))
    : null

  const invoiceGrossWeight = hasCompleteInvoiceGross
    ? invoice.items.reduce((sum, item) => sum.add(item.grossWeight as Prisma.Decimal), new Prisma.Decimal(0))
    : null

  const result = validateInvoicePackingConsistency(
    {
      totalValue: invoice.totalValue,
      currency: invoice.currency,
      countryOfOrigin: invoice.countryOfOrigin,
      items: invoice.items.map((item) => ({
        quantity: Number(item.quantity) || 0,
      })),
      netWeight: invoiceNetWeight,
      grossWeight: invoiceGrossWeight,
    },
    {
      totalBoxes: packing.totalBoxes,
      netWeight: packing.netWeight,
      grossWeight: packing.grossWeight,
      cartons: packing.cartons.map((carton) => ({ quantity: Number((carton as any).quantity) || 0 })),
    }
  )

  if (!result.valid) {
    throw new Error(`DOCUMENT_MISMATCH: ${result.errors.join(" | ")}`)
  }
}
