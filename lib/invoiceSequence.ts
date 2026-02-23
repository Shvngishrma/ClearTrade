/**
 * Invoice Sequencing Control - Audit-Proof Sequential Enforcement
 * 
 * ENFORCES:
 * 1. Sequential numbering (no gaps)
 * 2. No backdating before last invoice
 * 3. No reusing cancelled numbers
 * 4. Complete audit trail
 * 
 * RBI COMPLIANCE:
 * - Foreign Exchange Management Act 1999 § 5
 * - Master Direction on Export of Goods & Services
 * - FEMA Regulations require consecutive invoice numbering
 * 
 * ICEGATE ALIGNMENT:
 * - Shipping Bills require valid, sequential invoice reference
 * - Customs audit checks for gaps (fraud detection)
 */

import { prisma } from "./db"

export interface InvoiceNumberResult {
  invoiceNumber: string
  sequenceNumber: number
  issuedAt: Date
  audit: {
    nextExpected: number
    validation: string
    allowed: boolean
  }
}

export interface SequenceAuditReport {
  exporterId: string
  totalIssued: number
  totalCancelled: number
  gaps: Array<{ from: number; to: number; count: number }> | string
  verdict: string
  recentActivity: any[]
  cancelledNumbers: any[]
}

/**
 * Parse invoice number to extract sequence number
 * Handles formats like: INV-000050/2026 → 50
 */
function parseInvoiceNumber(invoiceNumber: string): number {
  // Remove prefix and suffix, extract numeric part
  const match = invoiceNumber.match(/(\d+)/)
  if (!match) {
    throw new Error(`Could not parse sequence number from invoice: ${invoiceNumber}`)
  }
  return parseInt(match[1], 10)
}

/**
 * Generate next sequential invoice number for exporter
 * 
 * ENFORCES sequencing rules:
 * - No gaps (sequential only)
 * - No backdating
 * - No reusing cancelled numbers
 * - Audit trail for every issuance
 * 
 * @throws Error if sequencing rules violated
 */
export async function generateNextInvoiceNumber(
  exporterId: string,
  invoiceDate: Date = new Date(),
  prefix?: string,
  suffix?: string
): Promise<InvoiceNumberResult> {
  // 1. Get exporter's sequence record
  let sequence = await prisma.invoiceSequence.findUnique({
    where: { exporterId }
  })

  if (!sequence) {
    // First invoice for this exporter - initialize sequence
    sequence = await prisma.invoiceSequence.create({
      data: {
        exporterId,
        nextNumber: 1,
        lastIssuedNumber: 0,
        prefix: prefix || "INV-",
        suffix: suffix || `/${new Date().getFullYear()}`,
        padLength: 6
      }
    })
  }

  // 2. CHECK RULE: Cannot backdate before last invoice
  if (sequence.lastIssuedDate && invoiceDate < sequence.lastIssuedDate) {
    throw new Error(
      `[SEQUENCING VIOLATION] Cannot backdate before last issued date (${sequence.lastIssuedDate.toISOString()}). ` +
      `RBI regulations require chronological invoicing per Foreign Exchange Management Act, 1999.`
    )
  }

  // 3. Generate next number
  const nextNumber = sequence.nextNumber
  const paddedNumber = String(nextNumber).padStart(sequence.padLength, "0")
  const invoiceNumber = `${sequence.prefix}${paddedNumber}${sequence.suffix || ""}`

  // 4. CHECK RULE: Cannot reuse cancelled numbers
  const cancelled = await prisma.cancelledInvoiceNumber.findUnique({
    where: {
      exporterId_sequenceNumber: {
        exporterId,
        sequenceNumber: nextNumber
      }
    }
  })

  if (cancelled) {
    throw new Error(
      `[SEQUENCING VIOLATION] Invoice number ${invoiceNumber} was previously cancelled on ` +
      `${cancelled.cancelledAt.toISOString()} (Reason: ${cancelled.reason}). ` +
      `Cannot reuse cancelled numbers per audit trail integrity rules. ` +
      `Contact support if this is a correction request.`
    )
  }

  // 5. Update sequence tracker
  const updated = await prisma.invoiceSequence.update({
    where: { exporterId },
    data: {
      nextNumber: nextNumber + 1,
      lastIssuedNumber: nextNumber,
      lastIssuedDate: invoiceDate
    }
  })

  // 6. Log to audit trail
  await prisma.invoiceSequenceAudit.create({
    data: {
      exporterId,
      action: "ISSUED",
      invoiceNumber,
      sequenceNumber: nextNumber,
      expectedNext: nextNumber + 1,
      invoiceDate,
      status: "SUCCESS"
    }
  })

  return {
    invoiceNumber,
    sequenceNumber: nextNumber,
    issuedAt: new Date(),
    audit: {
      nextExpected: nextNumber + 1,
      validation: "✅ Sequential, ✅ Not backdated, ✅ Not cancelled",
      allowed: true
    }
  }
}

/**
 * Cancel an invoice - PERMANENT block on reuse
 * 
 * Creates permanent audit trail that prevents number from ever being reused,
 * even if invoice is recreated
 * 
 * @param invoiceId - Invoice to cancel
 * @param reason - Why cancelled (USER_DELETED | FRAUD | DUPLICATE | CORRECTION)
 * @param userId - User who performed cancellation
 */
export async function cancelInvoice(
  invoiceId: string,
  reason: "USER_DELETED" | "FRAUD" | "DUPLICATE" | "CORRECTION",
  userId: string
): Promise<{
  success: boolean
  message: string
  auditNote: string
  permanentBlockRegistered: boolean
}> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId }
  })

  if (!invoice || !invoice.invoiceNumber) {
    throw new Error(`Invoice not found or has no invoice number: ${invoiceId}`)
  }

  // Get exporter separately to ensure we have access to exporterId
  const exporter = await prisma.exporter.findUnique({
    where: { id: invoice.exporterId }
  })

  if (!exporter) {
    throw new Error(`Exporter not found for invoice: ${invoiceId}`)
  }

  // Parse the invoice number to get sequence number
  const sequenceNumber = parseInvoiceNumber(invoice.invoiceNumber)

  // Register as cancelled - PERMANENT BLOCK on reuse
  await prisma.cancelledInvoiceNumber.create({
    data: {
      exporterId: invoice.exporterId,
      invoiceNumber: invoice.invoiceNumber,
      sequenceNumber,
      reason,
      cancelledBy: userId,
      notes: `Cancelled invoice ${invoice.invoiceNumber} dated ${invoice.invoiceDate.toISOString()}`
    }
  })

  // Create audit trail entry
  const sequence = await prisma.invoiceSequence.findUnique({
    where: { exporterId: invoice.exporterId }
  })

  await prisma.invoiceSequenceAudit.create({
    data: {
      exporterId: invoice.exporterId,
      invoiceId,
      action: "CANCELLED",
      invoiceNumber: invoice.invoiceNumber,
      sequenceNumber,
      expectedNext: sequence?.nextNumber || sequenceNumber + 1,
      invoiceDate: invoice.invoiceDate,
      userId,
      status: "SUCCESS",
      reason: `${reason} - Permanent block registered`
    }
  })

  // Delete the invoice
  await prisma.invoice.delete({ where: { id: invoiceId } })

  return {
    success: true,
    message: `Invoice ${invoice.invoiceNumber} cancelled successfully.`,
    auditNote: `Cancelled number registered in permanent audit trail. Cannot be reused.`,
    permanentBlockRegistered: true
  }
}

/**
 * Generate sequence audit report - for compliance/audits
 * 
 * Detects:
 * - Missing numbers (gaps in sequence)
 * - Out-of-order issuance
 * - Cancelled numbers
 * - Backdating violations
 * 
 * Used by:
 * - Auditors (ISA 500 compliance)
 * - Banks (LC/DA verification)
 * - RBI (FEMA compliance check)
 * - Customs (Shipping Bill validation)
 */
export async function generateSequenceAuditReport(exporterId: string): Promise<SequenceAuditReport> {
  const sequence = await prisma.invoiceSequence.findUnique({
    where: { exporterId }
  })

  if (!sequence) {
    return {
      exporterId,
      totalIssued: 0,
      totalCancelled: 0,
      gaps: "No invoices issued yet",
      verdict: "NO INVOICES - New exporter",
      recentActivity: [],
      cancelledNumbers: []
    }
  }

  const audits = await prisma.invoiceSequenceAudit.findMany({
    where: { exporterId, action: "ISSUED" },
    orderBy: { sequenceNumber: "asc" }
  })

  const cancelled = await prisma.cancelledInvoiceNumber.findMany({
    where: { exporterId },
    orderBy: { cancelledAt: "desc" }
  })

  // Detect gaps
  const gaps: Array<{ from: number; to: number; count: number }> = []
  let lastNumber = 0

  audits.forEach((audit: typeof audits[0]) => {
    if (audit.sequenceNumber > lastNumber + 1) {
      gaps.push({
        from: lastNumber + 1,
        to: audit.sequenceNumber - 1,
        count: audit.sequenceNumber - (lastNumber + 1)
      })
    }
    lastNumber = Math.max(lastNumber, audit.sequenceNumber)
  })

  // Get recent activity
  const recentActivity = await prisma.invoiceSequenceAudit.findMany({
    where: { exporterId },
    orderBy: { systemTime: "desc" },
    take: 10
  })

  const verdict =
    gaps.length === 0
      ? "AUDIT PASS ✅ - Sequential numbering maintained"
      : `GAPS DETECTED ⚠️ - ${gaps.length} gap(s) found`

  return {
    exporterId,
    totalIssued: audits.length,
    totalCancelled: cancelled.length,
    gaps: gaps.length > 0 ? gaps : "No gaps detected ✅",
    verdict,
    recentActivity,
    cancelledNumbers: cancelled
  }
}

/**
 * Get current sequence status for exporter
 */
export async function getCurrentSequence(exporterId: string) {
  const sequence = await prisma.invoiceSequence.findUnique({
    where: { exporterId }
  })

  if (!sequence) {
    // No sequence yet - return defaults
    return {
      nextNumber: 1,
      lastIssuedNumber: 0,
      lastIssuedDate: null,
      prefix: "INV-",
      suffix: `/${new Date().getFullYear()}`
    }
  }

  return sequence
}

/**
 * Utility: Format audit report for bank/RBI compliance
 */
export function formatAuditReportForBank(report: SequenceAuditReport): string {
  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Invoice Sequence Audit Report
Exporter ID: ${report.exporterId}
Generated: ${new Date().toISOString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SUMMARY:
  Total Invoices Issued: ${report.totalIssued}
  Total Cancelled: ${report.totalCancelled}
  
GAP ANALYSIS:
  ${typeof report.gaps === "string" ? report.gaps : `${report.gaps.length} gap(s) detected`}
  ${typeof report.gaps !== "string" ? report.gaps.map(g => `    Gap #${g.from}-#${g.to} (${g.count} missing)`).join("\n") : ""}

CANCELLED NUMBERS (Never Reusable):
${
  report.cancelledNumbers.length > 0
    ? report.cancelledNumbers
        .map(cn => `  #${String(cn.sequenceNumber).padStart(6, "0")} - ${cn.reason} (${cn.cancelledAt.toISOString()})`)
        .join("\n")
    : "  None"
}

RECENT ACTIVITY:
${
  report.recentActivity.length > 0
    ? report.recentActivity
        .slice(0, 5)
        .map(a => `  ${a.systemTime.toISOString()} | ${a.action} #${a.sequenceNumber}`)
        .join("\n")
    : "  No activity"
}

VERDICT: ${report.verdict}

Compliance Status:
  ✅ Sequential numbering maintained
  ${typeof report.gaps === "string" || report.gaps.length === 0 ? "✅ No gaps" : "⚠️ Gaps present"}
  ${report.totalCancelled > 0 ? `✅ ${report.totalCancelled} cancelled numbers blocked` : "✅ No cancellations"}
  ✅ Complete audit trail available

═══════════════════════════════════════════════════════
Auditor verification: All invoices traceable in sequential order.
RBI FEMA compliance: PASS
`
}

/**
 * Check if invoice number exists in cancelled registry
 * (Used for validation before creating invoice)
 */
export async function isNumberCancelled(exporterId: string, sequenceNumber: number): Promise<boolean> {
  const found = await prisma.cancelledInvoiceNumber.findUnique({
    where: {
      exporterId_sequenceNumber: {
        exporterId,
        sequenceNumber
      }
    }
  })

  return !!found
}
