import crypto from "crypto"

function normalizeDocumentId(rawInvoiceNumber?: string, fallbackId?: string): string {
  const invoiceNumber = (rawInvoiceNumber || "").trim()
  if (invoiceNumber) {
    return invoiceNumber
      .replace(/[\s\/]+/g, "-")
      .replace(/[^A-Za-z0-9\-]/g, "")
      .toUpperCase()
  }

  const idTail = (fallbackId || "").replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase()
  const year = new Date().getFullYear()
  return `INV-${year}-${idTail || "UNKNOWN"}`
}

function compactHash(hash: string): string {
  const cleaned = (hash || "").replace(/[^a-fA-F0-9]/g, "").toUpperCase()
  if (cleaned.length < 8) return cleaned || "NA"
  return `${cleaned.slice(0, 4)}...${cleaned.slice(-4)}`
}

export function getDocumentAuditMetadata(documentType: string, invoice: any): {
  documentId: string
  hash: string
  fullHash: string
  footerText: string
} {
  const documentId = normalizeDocumentId(invoice?.invoiceNumber, invoice?.id)

  const lockedHash = (invoice?.documentHash || "").toString().trim()
  if (lockedHash) {
    const hash = compactHash(lockedHash)
    return {
      documentId,
      hash,
      fullHash: lockedHash,
      footerText: `System Generated | Doc ID: ${documentId} | Integrity Hash: ${hash}`,
    }
  }

  const hashPayload = {
    documentType,
    documentId,
    invoiceId: invoice?.id || "",
    invoiceDate: invoice?.invoiceDate ? new Date(invoice.invoiceDate).toISOString() : "",
    totalValue: String(invoice?.totalValue ?? ""),
    currency: String(invoice?.currency ?? ""),
    exporterId: String(invoice?.exporterId ?? ""),
    buyerId: String(invoice?.buyerId ?? ""),
    itemCount: Array.isArray(invoice?.items) ? invoice.items.length : 0,
  }

  const fullHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(hashPayload))
    .digest("hex")
    .toUpperCase()

  const hash = compactHash(fullHash)
  const footerText = `System Generated | Doc ID: ${documentId} | Integrity Hash: ${hash}`

  return {
    documentId,
    hash,
    fullHash,
    footerText,
  }
}
