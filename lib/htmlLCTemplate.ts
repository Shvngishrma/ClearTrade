import { getDocumentAuditMetadata } from "@/lib/auditMetadata"
import { signatureBlockStyles } from "@/lib/renderSignatureBlock"
import {
  renderSectionTitle,
  sharedFooterStyles,
  sharedHeaderStyles,
  sharedPageStyles,
  sharedSectionStyles,
  sharedSummaryStyles,
} from "@/lib/renderDocumentLayout"
import { documentSkeletonStyles, renderDocumentSkeleton } from "@/lib/renderDocumentSkeleton"

export function generateLetterOfCreditHTML(invoice: any, lc: any): string {
  const exporter = invoice?.exporter || {}
  const brandName = invoice?.brandName || "Export Docs"
  const auditMetadata = getDocumentAuditMetadata("LC_SUPPORT", invoice)

  const lcNumber = String(lc?.lcNumber || invoice?.lcNumber || "N/A").trim()
  const issuingBank = String(lc?.issuingBank || "N/A").trim()
  const advisingBank = String(lc?.advisingBank || "N/A").trim()
  const lcCurrency = String(lc?.lcCurrency || invoice?.currency || "N/A").trim()
  const lcAmount = Number(lc?.lcAmount || invoice?.totalValue || 0)
  const tolerancePercent = Number(lc?.tolerancePercent || 0)
  const presentationDays = Number(lc?.presentationPeriodDays || lc?.presentationDays || 21)
  const partialShipmentAllowed = lc?.partialShipmentAllowed ? "Yes" : "No"

  const formatDate = (dateLike: unknown) => {
    if (!dateLike) return "N/A"
    const date = new Date(String(dateLike))
    if (Number.isNaN(date.getTime())) return "N/A"
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date)
  }

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0)

  const shipmentDeadline = formatDate(lc?.shipmentDeadline || lc?.latestShipmentDate)
  const formattedInvoiceDate = formatDate(invoice?.invoiceDate)
  const formattedTimestamp = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date())

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Letter of Credit Summary</title>
  <style>
    ${sharedPageStyles}
${sharedHeaderStyles}
${sharedSectionStyles}
${sharedSummaryStyles}
${signatureBlockStyles}
${documentSkeletonStyles}
${sharedFooterStyles}

    .container {
      height: auto !important;
      min-height: auto !important;
      overflow: visible !important;
    }

    .compact-grid {
      margin-bottom: 10px;
      gap: 24px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .declaration-block {
      margin-top: 8px;
      margin-bottom: 4px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .declaration-text {
      font-size: 13px;
      color: #374151;
      line-height: 1.7;
    }
  </style>
</head>
<body>
  <div class="container">
    ${renderDocumentSkeleton({
      exporter,
      headerData: {
        documentTitle: "LETTER OF CREDIT SUMMARY",
        subtitle: "(Issued for Shipment & Documentation Compliance)",
        paymentTerms: invoice?.paymentTerms,
        metadataRows: [
          { label: "LC NO:", value: lcNumber, valueClass: "invoice-number" },
          { label: "INVOICE REF:", value: invoice?.invoiceNumber || "N/A", valueClass: "header-meta-value" },
          { label: "INVOICE DATE:", value: formattedInvoiceDate, valueClass: "invoice-date" },
        ],
      },
      content: `
        <div class="info-grid compact-grid">
          <div class="info-section">
            ${renderSectionTitle("Letter of Credit Details")}
            <div class="info-content">
              <p><strong>Issuing Bank:</strong> ${issuingBank}</p>
              <p><strong>Advising Bank:</strong> ${advisingBank}</p>
              <p><strong>LC Currency:</strong> ${lcCurrency}</p>
              <p><strong>LC Amount:</strong> ${lcCurrency} ${formatMoney(lcAmount)}</p>
            </div>
          </div>

          <div class="info-section">
            ${renderSectionTitle("Shipment Terms")}
            <div class="info-content">
              <p><strong>Shipment Deadline:</strong> ${shipmentDeadline}</p>
              <p><strong>Presentation Period:</strong> ${presentationDays} days</p>
              <p><strong>Partial Shipment Allowed:</strong> ${partialShipmentAllowed}</p>
              <p><strong>Tolerance:</strong> ±${Number.isFinite(tolerancePercent) ? tolerancePercent.toFixed(2) : "0.00"}%</p>
            </div>
          </div>
        </div>

        <div class="info-section declaration-block">
          ${renderSectionTitle("LC Compliance Declaration")}
          <div class="info-content declaration-text">
            <p>This document summarizes the essential Letter of Credit terms under which the shipment and documentation must comply.</p>
          </div>
        </div>
      `,
      summarySection: `
        <div class="summary" style="margin-top: 8px; margin-bottom: 10px;">
          <div class="summary-box">
            <div class="summary-row divider"></div>
            <div class="summary-row total">
              <span class="summary-label">LC Face Value:</span>
              <span class="summary-value">${lcCurrency} ${formatMoney(lcAmount)}</span>
            </div>
          </div>
        </div>
      `,
      footerData: {
        brandName,
        timestamp: formattedTimestamp,
        documentId: auditMetadata.documentId,
        hash: auditMetadata.hash,
      },
    })}
  </div>
</body>
</html>
  `.trim()
}
