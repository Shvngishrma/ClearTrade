/**
 * HTML template for Commercial Invoice
 * Generates a styled HTML string optimized for PDF rendering via Puppeteer
 * A4 size: 210mm × 297mm
 */

import { getDocumentAuditMetadata } from "@/lib/auditMetadata"
import { renderSignatureBlock, signatureBlockStyles } from "@/lib/renderSignatureBlock"
import {
  renderHeaderBlock,
  renderSectionTitle,
  sharedFooterStyles,
  sharedHeaderStyles,
  sharedPageStyles,
  sharedSectionStyles,
  sharedSummaryStyles,
  sharedTableStyles,
} from "@/lib/renderDocumentLayout"

export function generateInvoiceHTML(invoice: any, usage?: any): string {
  const {
    exporter,
    buyer,
    items,
    incoterm,
    totalValue,
    currency,
    portOfLoading,
    portOfDischarge,
    modeOfTransport,
    freightCharges = 0,
    insuranceCharges = 0,
    documentTimestamp = new Date().toISOString(),
    documentHash = '',
    auditId = '',
    brandName = 'Export Docs',
  } = invoice

  const shouldShowWatermark = usage?.isPro === false
  const auditMetadata = getDocumentAuditMetadata("INVOICE", invoice)

  // Calculate item totals
  const itemRows = items
    .map((item: any) => {
      const itemTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
      return {
        ...item,
        total: itemTotal,
      }
    })
    .sort((a: any, b: any) => a.description.localeCompare(b.description))

  const subtotal = itemRows.reduce((sum: number, item: any) => sum + item.total, 0)
  const formattedSubtotal = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(subtotal)

  const formattedTotalValue = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(totalValue || subtotal)

  const invoiceDateValue = invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date()
  const formattedInvoiceDate = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(invoiceDateValue)

  const formattedTimestamp = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(documentTimestamp))

  const hasExchangeDisclosure =
    currency !== 'INR' &&
    Number(totalValue) > 0 &&
    Number(invoice.totalValueINR) > 0

  const derivedExchangeRate = hasExchangeDisclosure
    ? Number(invoice.totalValueINR) / Number(totalValue)
    : null

  const exchangeReferenceDate = hasExchangeDisclosure
    ? new Date(invoice.exchangeRateDate || invoice.invoiceDate || new Date())
    : null

  const formattedExchangeRate = derivedExchangeRate
    ? derivedExchangeRate.toFixed(2)
    : null

  const formattedExchangeRefDate = exchangeReferenceDate
    ? new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(exchangeReferenceDate)
    : null

  const normalizedVesselOrFlight = (invoice.vesselOrFlightNumber || '').trim()
  const normalizedBlOrAwb = (invoice.blNumber || invoice.awbNumber || '').trim()
  const normalizedContainerNumber = (invoice.containerNumber || '').trim()
  const normalizedMarksAndNumbers = (invoice.marksAndNumbers || '').trim()

  const transportDetailsRows = [
    { label: 'Vessel / Flight', value: normalizedVesselOrFlight },
    { label: 'BL / AWB No', value: normalizedBlOrAwb },
    { label: 'Container No', value: normalizedContainerNumber },
    { label: 'Marks & Numbers', value: normalizedMarksAndNumbers },
  ].filter(row => row.value)

  const transportDetailsHTML = transportDetailsRows.length > 0
    ? `
    <div class="transport-details">
      ${renderSectionTitle('Transport Details')}
      ${transportDetailsRows
        .map(
          row => `
      <div class="transport-item">
        <span class="transport-item-label">${row.label}:</span>
        <span class="transport-item-value">${row.value}</span>
      </div>`
        )
        .join('')}
    </div>`
    : ''

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Commercial Invoice</title>
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

    /* Shipment details */
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

    .transport-details {
      margin-top: -10px;
      margin-bottom: 28px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      page-break-inside: avoid;
    }

    .transport-item {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 4px;
      font-size: 13px;
    }

    .transport-item-label {
      font-weight: 600;
      color: #6b7280;
      min-width: 130px;
    }

    .transport-item-value {
      color: #374151;
      font-weight: 500;
    }

    /* Items Table */
    .items-section {
      margin-bottom: 32px;
      page-break-inside: avoid;
    }

${sharedTableStyles}
${sharedSummaryStyles}

    .exchange-disclosure {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      font-size: 10px;
      color: #6b7280;
      line-height: 1.5;
      text-align: right;
      letter-spacing: 0.2px;
    }

    .exchange-disclosure-line {
      margin: 0;
    }

${signatureBlockStyles}

    /* Compliance Footer Block */
    .compliance-footer {
      margin-top: 16px;
      margin-bottom: 16px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px 40px;
      font-size: 11px;
      color: #6b7280;
      padding: 16px 0;
      border-top: 1px solid #f3f4f6;
      border-bottom: 1px solid #f3f4f6;
      page-break-inside: avoid;
      break-inside: avoid;
      page-break-before: avoid;
      break-before: avoid;
    }

    .compliance-footer-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .compliance-footer-label {
      font-size: 10px;
      font-weight: 600;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .compliance-footer-value {
      font-size: 11px;
      font-weight: 400;
      color: #374151;
    }

    .compliance-footer-text {
      font-size: 9.5px;
      font-weight: 400;
      color: #6b7280;
      opacity: 0.85;
      line-height: 1.5;
      grid-column: 1 / -1;
    }

${sharedFooterStyles}

    /* Page Number */
    .page-number {
      position: absolute;
      bottom: 20px;
      right: 20px;
      font-size: 10px;
      font-weight: 400;
      color: #9ca3af;
    }

    .container {
      position: relative;
    }

    .invoice-wrapper {
      width: 100%;
    }

    /* Print safely */
    @media print {
      body {
        margin: 0;
        padding: 0;
      }
      .container {
        page-break-inside: avoid;
        break-inside: avoid;
      }

      .signature-block,
      .compliance-footer,
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
  <div class="invoice-wrapper">
  <div class="container">
    ${shouldShowWatermark ? `<div class="document-watermark">GENERATED VIA PLATFORM</div>` : ''}

    <!-- Page Number -->
    <div class="page-number">Page 1 of 1</div>
    
    ${renderHeaderBlock({
      exporter,
      documentTitle: 'COMMERCIAL INVOICE',
      paymentTerms: invoice.paymentTerms,
      metadataRows: [
        { label: 'INVOICE NO:', value: invoice.invoiceNumber, valueClass: 'invoice-number' },
        { label: 'DATE:', value: formattedInvoiceDate, valueClass: 'invoice-date' },
      ],
    })}

    <!-- Exporter and Buyer Info -->
    <div class="info-grid">
      <!-- Exporter -->
      <div class="info-section">
        ${renderSectionTitle('Exporter / Shipper')}
        <div class="info-content">
          <p><strong>${exporter.name || 'N/A'}</strong></p>
          <p>${exporter.address || 'Address not provided'}</p>
          ${exporter.iec ? `<p><strong>IEC:</strong> ${exporter.iec}</p>` : ''}
          ${exporter.gstIN ? `<p><strong>GSTIN:</strong> ${exporter.gstIN}</p>` : ''}
        </div>
      </div>

      <!-- Buyer -->
      <div class="info-section">
        ${renderSectionTitle('Buyer / Importer')}
        <div class="info-content">
          <p><strong>${buyer.name || 'N/A'}</strong></p>
          <p>${buyer.address || 'Address not provided'}</p>
          ${buyer.country ? `<p><strong>Country:</strong> ${buyer.country}</p>` : ''}
          ${buyer.buyerTaxId ? `<p><strong>Tax ID:</strong> ${buyer.buyerTaxId}</p>` : ''}
          ${buyer.buyerVAT ? `<p><strong>VAT:</strong> ${buyer.buyerVAT}</p>` : ''}
          ${buyer.buyerRegistrationNumber ? `<p><strong>Registration No:</strong> ${buyer.buyerRegistrationNumber}</p>` : ''}
        </div>
      </div>
    </div>

    <!-- Shipment Details -->
    <!-- FROZEN SHIPMENT & TRADE BLOCK -->
    <div class="shipment-details">
      <div class="shipment-item">
        <span class="shipment-item-label">Incoterm</span>
        <span class="shipment-item-value">${incoterm || 'Not specified'}</span>
      </div>
      <div class="shipment-item">
        <span class="shipment-item-label">Port of Loading</span>
        <span class="shipment-item-value">${portOfLoading || 'Not specified'}</span>
      </div>
      <div class="shipment-item">
        <span class="shipment-item-label">Port of Discharge</span>
        <span class="shipment-item-value">${portOfDischarge || 'Not specified'}</span>
      </div>
      <div class="shipment-item">
        <span class="shipment-item-label">Country of Origin</span>
        <span class="shipment-item-value">${invoice.countryOfOrigin}</span>
      </div>
      <div class="shipment-item">
        <span class="shipment-item-label">Mode of Transport</span>
        <span class="shipment-item-value">${modeOfTransport || 'Not specified'}</span>
      </div>
    </div>

    ${transportDetailsHTML}

    <!-- Items Table -->
    <div class="items-section">
      ${renderSectionTitle('Invoice Items')}
      <!-- FROZEN ITEMS TABLE (INSTITUTIONAL) -->
      <table>
        <thead>
          <tr>
            <th class="text-serial">Sr</th>
            <th class="text-left">Description</th>
            <th class="text-monospace">HS Code</th>
            <th class="text-numeric">Qty</th>
            <th class="text-unit">Unit</th>
            <th class="text-numeric">Unit Price</th>
            <th class="text-numeric">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows
            .map(
              (item: any, idx: number) => `
          <tr>
            <td class="text-serial">${idx + 1}</td>
            <td class="text-left">${item.description || 'Unspecified'}</td>
            <td class="text-monospace">${item.hsCode || '—'}</td>
            <td class="text-numeric">${item.quantity || 0}</td>
            <td class="text-unit">${item.unit || 'PCS'}</td>
            <td class="text-numeric">${currency} ${new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(item.unitPrice || 0)}</td>
            <td class="text-numeric">${currency} ${new Intl.NumberFormat('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(item.total)}</td>
          </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>

    <!-- Summary -->
    <div class="summary">
      <div class="summary-box">
        <div class="summary-row">
          <span class="summary-label">Subtotal:</span>
          <span class="summary-value">${currency} ${formattedSubtotal}</span>
        </div>
        ${freightCharges > 0 ? `
        <div class="summary-row">
          <span class="summary-label">Freight:</span>
          <span class="summary-value">${currency} ${new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(freightCharges)}</span>
        </div>
        ` : ''}
        ${insuranceCharges > 0 ? `
        <div class="summary-row">
          <span class="summary-label">Insurance:</span>
          <span class="summary-value">${currency} ${new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(insuranceCharges)}</span>
        </div>
        ` : ''}
        <div class="summary-row divider"></div>
        <div class="summary-row total">
          <span class="summary-label">Total Invoice Value:</span>
          <span class="summary-value">${currency} ${formattedTotalValue}</span>
        </div>
        ${hasExchangeDisclosure ? `
        <div class="exchange-disclosure">
          <p class="exchange-disclosure-line">Exchange Rate: 1 ${currency} = ₹${formattedExchangeRate}</p>
          <p class="exchange-disclosure-line">Reference Date: ${formattedExchangeRefDate}</p>
        </div>
        ` : ''}
      </div>
    </div>

    ${renderSignatureBlock(exporter)}

    <!-- Compliance Footer (Small, Classic) -->
    <div class="compliance-footer">
      ${exporter.iecNo ? `
      <div class="compliance-footer-item">
        <div class="compliance-footer-label">IEC</div>
        <div class="compliance-footer-value">${exporter.iecNo}</div>
      </div>
      ` : ''}
      ${exporter.adCode ? `
      <div class="compliance-footer-item">
        <div class="compliance-footer-label">AD Code</div>
        <div class="compliance-footer-value">${exporter.adCode}</div>
      </div>
      ` : ''}
      ${exporter.exchangeRateRef ? `
      <div class="compliance-footer-item">
        <div class="compliance-footer-label">Exchange Rate Ref</div>
        <div class="compliance-footer-value">${exporter.exchangeRateRef}</div>
      </div>
      ` : ''}
      ${exporter.realizedValue ? `
      <div class="compliance-footer-item">
        <div class="compliance-footer-label">Realized Value</div>
        <div class="compliance-footer-value">${currency} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(exporter.realizedValue)}</div>
      </div>
      ` : ''}
      <div class="compliance-footer-text">This document was prepared in accordance with applicable trade and tax regulations. The exporter certifies the accuracy of information provided and assumes responsibility for compliance with all relevant trade laws.</div>
    </div>

    <!-- Footer Compliance Strip -->
    <div class="footer">
      <div class="footer-content">
        <span class="footer-item">System Generated</span>
        <span class="footer-separator">|</span>
        <span class="footer-item">Document ID: ${auditMetadata.documentId}</span>
        <span class="footer-separator">|</span>
        <span class="footer-item footer-hash">Hash: ${auditMetadata.hash}</span>
      </div>
    </div>
  </div>
</div>
</body>
</html>
  `.trim()
}
