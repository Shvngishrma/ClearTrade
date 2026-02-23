import crypto from "crypto"
import { prisma } from "@/lib/db"
import { InvoiceLifecycleStatus } from "@prisma/client"

type IntegritySnapshot = {
  invoice: Record<string, unknown>
  packing: Record<string, unknown> | null
  lc: Record<string, unknown> | null
  exchange: Record<string, unknown>
}

async function buildIntegritySnapshot(invoiceId: string): Promise<IntegritySnapshot> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: true,
      packingLists: {
        include: { cartons: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      lettersOfCredit: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!invoice) {
    throw new Error(`INVOICE_NOT_FOUND: ${invoiceId}`)
  }

  const latestPacking = invoice.packingLists[0] || null
  const latestLC = invoice.lettersOfCredit[0] || null

  return {
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate.toISOString(),
      currency: invoice.currency,
      incoterm: invoice.incoterm,
      paymentTerms: invoice.paymentTerms,
      portOfLoading: invoice.portOfLoading,
      portOfDischarge: invoice.portOfDischarge,
      countryOfOrigin: invoice.countryOfOrigin,
      totalValue: invoice.totalValue.toString(),
      totalValueINR: invoice.totalValueINR?.toString() || null,
      items: invoice.items.map((item) => ({
        id: item.id,
        description: item.description,
        hsCode: item.hsCode,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
      })),
    },
    packing: latestPacking
      ? {
          id: latestPacking.id,
          totalBoxes: latestPacking.totalBoxes,
          totalQuantity: latestPacking.totalQuantity,
          netWeight: latestPacking.netWeight.toString(),
          grossWeight: latestPacking.grossWeight.toString(),
          totalCBM: latestPacking.totalCBM?.toString() || null,
          cartons: latestPacking.cartons.map((carton) => ({
            cartonNumber: carton.cartonNumber,
            quantity: carton.quantity,
            marks: carton.marks,
            lengthCm: carton.lengthCm?.toString() || null,
            widthCm: carton.widthCm?.toString() || null,
            heightCm: carton.heightCm?.toString() || null,
            netWeightKg: carton.netWeightKg.toString(),
            grossWeightKg: carton.grossWeightKg.toString(),
            cbm: carton.cbm?.toString() || null,
          })),
        }
      : null,
    lc: latestLC
      ? {
          id: latestLC.id,
          lcNumber: latestLC.lcNumber,
          lcDescriptionText: latestLC.lcDescriptionText,
          latestShipmentDate: latestLC.latestShipmentDate.toISOString(),
          presentationDays: latestLC.presentationDays,
          partialShipmentAllowed: latestLC.partialShipmentAllowed,
          tolerancePercent: latestLC.tolerancePercent,
          governedBy: latestLC.governedBy,
        }
      : null,
    exchange: {
      invoiceCurrency: invoice.currency,
      totalValue: invoice.totalValue.toString(),
      totalValueINR: invoice.totalValueINR?.toString() || null,
      exchangeRateDate: invoice.exchangeRateDate?.toISOString() || null,
    },
  }
}

function hashSnapshot(snapshot: IntegritySnapshot): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(snapshot))
    .digest("hex")
    .toUpperCase()
}

export async function initializeInvoiceLifecycle(invoiceId: string, changedBy?: string): Promise<void> {
  const snapshot = await buildIntegritySnapshot(invoiceId)

  await prisma.invoiceVersion.create({
    data: {
      invoiceId,
      version: 1,
      status: InvoiceLifecycleStatus.DRAFT,
      changeType: "DRAFT",
      changedBy: changedBy || null,
      snapshot: snapshot as any,
    },
  })
}

export async function markInvoiceReady(invoiceId: string, changedBy?: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, status: true, version: true },
  })

  if (!invoice || invoice.status === InvoiceLifecycleStatus.READY || invoice.status === InvoiceLifecycleStatus.LOCKED) {
    return
  }

  const snapshot = await buildIntegritySnapshot(invoiceId)

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceLifecycleStatus.READY,
        readyAt: new Date(),
      },
    }),
    prisma.invoiceVersion.create({
      data: {
        invoiceId,
        version: invoice.version,
        status: InvoiceLifecycleStatus.READY,
        changeType: "READY",
        changedBy: changedBy || null,
        snapshot: snapshot as any,
      },
    }),
  ])
}

export async function lockInvoiceOnFirstPdfDownload(invoiceId: string, changedBy?: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      status: true,
      version: true,
      documentHash: true,
      parentInvoiceId: true,
    },
  })

  if (!invoice) {
    throw new Error(`INVOICE_NOT_FOUND: ${invoiceId}`)
  }

  if (invoice.status === InvoiceLifecycleStatus.LOCKED && invoice.documentHash) {
    return
  }

  const snapshot = await buildIntegritySnapshot(invoiceId)
  const integrityHash = hashSnapshot(snapshot)
  const now = new Date()

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceLifecycleStatus.LOCKED,
        readyAt: now,
        lockedAt: now,
        documentHash: integrityHash,
        hashGeneratedAt: now,
        integritySnapshot: snapshot as any,
        parentInvoiceId: invoice.parentInvoiceId || invoice.id,
      },
    }),
    prisma.invoiceVersion.create({
      data: {
        invoiceId,
        version: invoice.version,
        status: InvoiceLifecycleStatus.LOCKED,
        changeType: "LOCKED",
        changedBy: changedBy || null,
        snapshot: snapshot as any,
        documentHash: integrityHash,
      },
    }),
  ])
}

export async function markInvoiceAmended(invoiceId: string, reason: string, changedBy?: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      version: true,
      parentInvoiceId: true,
    },
  })

  if (!invoice) {
    throw new Error(`INVOICE_NOT_FOUND: ${invoiceId}`)
  }

  const nextVersion = invoice.version + 1
  const snapshot = await buildIntegritySnapshot(invoiceId)

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceLifecycleStatus.AMENDED,
        version: nextVersion,
        amendedAt: new Date(),
        parentInvoiceId: invoice.parentInvoiceId || invoice.id,
      },
    }),
    prisma.invoiceVersion.create({
      data: {
        invoiceId,
        version: nextVersion,
        status: InvoiceLifecycleStatus.AMENDED,
        changeType: "AMENDED",
        reason,
        changedBy: changedBy || null,
        snapshot: snapshot as any,
      },
    }),
  ])
}
