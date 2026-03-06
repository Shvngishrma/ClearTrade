import { getDocumentAuditMetadata } from "@/lib/auditMetadata"
import {
  renderSectionTitle,
  sharedFooterStyles,
  sharedHeaderStyles,
  sharedPageStyles,
  sharedSectionStyles,
  sharedSummaryStyles,
  sharedTableStyles,
} from "@/lib/renderDocumentLayout"
import { signatureBlockStyles } from "@/lib/renderSignatureBlock"
import { documentSkeletonStyles, renderDocumentSkeleton } from "@/lib/renderDocumentSkeleton"
import { normalizeShippingBillCargoType } from "@/lib/shippingBillCargoType"

export function generateShippingBillHTML(invoice: any, sb: any, usage?: any): string {
  const {
    exporter,
    buyer,
    items,
    currency,
    documentTimestamp = new Date().toISOString(),
    brandName = "Export Docs",
  } = invoice

  const shouldShowWatermark = usage?.isPro === false
  const auditMetadata = getDocumentAuditMetadata("SHIPPING_BILL", invoice)

  const exportDateValue = invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date()
  const formattedExportDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(exportDateValue)

  const formattedTimestamp = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(documentTimestamp))

  const shippingBillNo = `SB-${String(sb?.id || "DRAFT").slice(0, 8).toUpperCase()}`

  const adCode = (sb?.adCode || exporter?.adCode || "").trim().toUpperCase()

  const lineValueByItem = (items || []).map((item: any) => {
    const qty = Number(item.quantity) || 0
    const unitPrice = Number(item.unitPrice) || 0
    return qty * unitPrice
  })

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0)

  const computedFOB = lineValueByItem.reduce((sum: number, value: number) => sum + value, 0)
  const freight = Number(invoice.freight || 0)
  const insurance = Number(invoice.insurance || 0)
  const totalInvoiceValue = Number(invoice.totalValue || computedFOB)

  const exchangeRate =
    invoice.currency && invoice.currency !== "INR" && Number(invoice.totalValueINR || 0) > 0 && totalInvoiceValue > 0
      ? Number(invoice.totalValueINR) / totalInvoiceValue
      : null

  const schemeCode = sb?.schemeCode || (sb?.drawback ? "Drawback" : "N/A")
  const cargoType = normalizeShippingBillCargoType(sb?.cargoType)

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shipping Bill</title>
  <style>
    ${sharedPageStyles}

    .document-watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-32deg);
      transform-origin: center;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
      font-size: 44px;
      font-weight: 500;
      letter-spacing: 3px;
      white-space: nowrap;
      color: #000000;
      opacity: 0.055;
      pointer-events: none;
      user-select: none;
      z-index: 0;
    }

${sharedHeaderStyles}
${sharedSectionStyles}

    .shipment-details {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 40px;
      margin-bottom: 32px;
      page-break-inside: avoid;
    }

    .shipment-item {
      font-size: 13px;
    }

    .shipment-item-label {
      font-weight: 600;
      color: #6b7280;
      display: block;
      margin-bottom: 6px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }

    .shipment-item-value {
      color: #374151;
      font-size: 13px;
      font-weight: 400;
    }

    .items-section {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }

${sharedTableStyles}
${sharedSummaryStyles}
${signatureBlockStyles}
${documentSkeletonStyles}
${sharedFooterStyles}

    @page {
      size: A4;
      margin: 6mm 10mm 6mm 10mm;
    }

    .document-header {
      margin-bottom: 24px;
    }

    .info-grid {
      margin-bottom: 20px;
    }

    .info-content {
      line-height: 1.55;
    }

    .info-content p {
      margin-bottom: 4px;
    }

    .shipment-details {
      margin-bottom: 18px;
      gap: 24px;
    }

    .items-section {
      margin-bottom: 14px;
    }

    .section-title {
      margin-bottom: 8px;
      padding-bottom: 8px;
    }

    table {
      margin-top: 10px;
    }

    th,
    td {
      padding-top: 8px;
      padding-bottom: 8px;
    }

    .summary {
      margin-top: 14px;
      margin-bottom: 14px;
    }

    .summary-row {
      padding: 6px 0;
    }

    .summary-row.divider {
      padding: 8px 0 6px 0;
      margin: 2px 0;
    }

    .summary-row.total {
      padding: 8px 0 6px 0;
    }

    .signature-block {
      margin-top: 12px;
      margin-bottom: 10px;
    }

    .footer {
      margin-top: 10px;
      padding-top: 10px;
    }

    .declaration {
      margin-top: 4px;
      font-size: 11px;
      color: #374151;
      line-height: 1.4;
      page-break-inside: avoid;
    }

    .document-wrapper {
      width: 100%;
    }

    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      .container,
      .signature-block,
      .footer {
        page-break-inside: avoid;
        break-inside: avoid;
        page-break-before: avoid;
        break-before: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="document-wrapper">
    <div class="container">
      ${shouldShowWatermark ? `<div class="document-watermark">GENERATED VIA PLATFORM</div>` : ""}
      ${renderDocumentSkeleton({
        exporter,
        headerData: {
          documentTitle: "SHIPPING BILL (DRAFT)",
          subtitle: "(For ICEGATE Filing Reference Only)",
          metadataRows: [
            { label: "SHIPPING BILL NO:", value: shippingBillNo, valueClass: "invoice-number" },
            { label: "INVOICE REF:", value: invoice.invoiceNumber || "N/A", valueClass: "invoice-date" },
            { label: "AD CODE:", value: adCode || "N/A", valueClass: "header-meta-value" },
            { label: "PORT OF LOADING:", value: sb?.portOfLoading || invoice.portOfLoading || "N/A", valueClass: "header-meta-value" },
            { label: "DESTINATION COUNTRY:", value: buyer?.country || "N/A", valueClass: "header-meta-value" },
            { label: "SCHEME:", value: schemeCode, valueClass: "header-meta-value" },
            { label: "DATE:", value: formattedExportDate, valueClass: "invoice-date" },
          ],
        },
        content: `
          <div class="info-grid">
            <div class="info-section">
              ${renderSectionTitle("Exporter / Shipper")}
              <div class="info-content">
                <p><strong>${exporter?.name || "N/A"}</strong></p>
                <p>${exporter?.address || "Address not provided"}</p>
                ${exporter?.iec ? `<p><strong>IEC:</strong> ${exporter.iec}</p>` : ""}
              </div>
            </div>

            <div class="info-section">
              ${renderSectionTitle("Buyer / Importer")}
              <div class="info-content">
                <p><strong>${buyer?.name || "N/A"}</strong></p>
                <p>${buyer?.address || "Address not provided"}</p>
                ${buyer?.country ? `<p><strong>Country:</strong> ${buyer.country}</p>` : ""}
              </div>
            </div>
          </div>

          <div class="shipment-details">
            <div class="shipment-item">
              <span class="shipment-item-label">Port of Discharge</span>
              <span class="shipment-item-value">${sb?.portOfDischarge || invoice.portOfDischarge || "Not specified"}</span>
            </div>
            <div class="shipment-item">
              <span class="shipment-item-label">Cargo Type</span>
              <span class="shipment-item-value">${cargoType}</span>
            </div>
          </div>

          <div class="items-section">
            ${renderSectionTitle("Goods Details")}
            <table>
              <thead>
                <tr>
                  <th class="text-serial">Sr</th>
                  <th class="text-left">Description</th>
                  <th class="text-monospace">HS Code</th>
                  <th class="text-numeric">Qty</th>
                  <th class="text-unit">Unit</th>
                  <th class="text-numeric">FOB Value</th>
                </tr>
              </thead>
              <tbody>
                ${(items || [])
                  .map(
                    (item: any, idx: number) => `
                <tr>
                  <td class="text-serial">${idx + 1}</td>
                  <td class="text-left">${item.description || "Unspecified"}</td>
                  <td class="text-monospace">${item.hsCode || "—"}</td>
                  <td class="text-numeric">${item.quantity || 0}</td>
                  <td class="text-unit">${item.unit || "PCS"}</td>
                  <td class="text-numeric">${currency} ${formatMoney(lineValueByItem[idx] || 0)}</td>
                </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        `,
        summarySection: `
          ${renderSectionTitle("Valuation")}
          <div class="summary">
            <div class="summary-box">
              <div class="summary-row">
                <span class="summary-label">FOB Value:</span>
                <span class="summary-value">${currency} ${formatMoney(computedFOB)}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Freight:</span>
                <span class="summary-value">${currency} ${formatMoney(freight)}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Insurance:</span>
                <span class="summary-value">${currency} ${formatMoney(insurance)}</span>
              </div>
              <div class="summary-row divider"></div>
              <div class="summary-row total">
                <span class="summary-label">Total Invoice Value:</span>
                <span class="summary-value">${currency} ${formatMoney(totalInvoiceValue)}</span>
              </div>
            </div>
          </div>

          ${renderSectionTitle("Declaration")}
          <p class="declaration">
            We hereby declare that the particulars given above are true and correct, and the goods are intended for export as per applicable customs and FEMA regulations.
          </p>
        `,
        footerData: {
          brandName,
          timestamp: formattedTimestamp,
          documentId: auditMetadata.documentId,
          hash: auditMetadata.hash,
        },
      })}
    </div>
  </div>
</body>
</html>
  `.trim()
}
