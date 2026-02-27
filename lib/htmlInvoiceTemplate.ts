/**
 * HTML template for Commercial Invoice
 * Generates a styled HTML string optimized for PDF rendering via Puppeteer
 * A4 size: 210mm × 297mm
 */

import { getDocumentAuditMetadata } from "@/lib/auditMetadata"

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
      <div class="transport-title">Transport Details</div>
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
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      width: 210mm;
      height: 297mm;
      overflow: hidden;
    }

    body {
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
      font-size: 13px;
      line-height: 1.6;
      color: #374151;
      background: white;
    }

    @page {
      size: A4;
      margin: 0;
    }

    .container {
      width: 100%;
      max-width: 100%;
      page-break-inside: avoid;
    }

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

    /* Brand Header */
    /* Document Header System - Standardized Two-Column Layout */
    .document-header {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-bottom: 40px;
      padding-bottom: 0;
      page-break-inside: avoid;
    }

    .header-left {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      gap: 12px;
    }

    .exporter-name {
      font-size: 13px;
      font-weight: 600;
      color: #111827;
      line-height: 1.4;
    }

    .exporter-address {
      font-size: 12px;
      font-weight: 400;
      color: #374151;
      line-height: 1.4;
    }

    .exporter-iec {
      font-size: 12px;
      font-weight: 500;
      color: #111827;
      letter-spacing: 0.3px;
    }

    .exporter-gstin {
      font-size: 12px;
      font-weight: 500;
      color: #111827;
      letter-spacing: 0.3px;
    }

    .exporter-ad-code {
      font-size: 11px;
      font-weight: 500;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .exporter-country {
      font-size: 12px;
      font-weight: 400;
      color: #374151;
    }

    .payment-terms {
      font-size: 12px;
      font-weight: 600;
      color: #111827;
      padding: 8px 0;
      border-top: 1px solid #e5e7eb;
      margin-top: 4px;
    }

    .header-right {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      gap: 8px;
      border-left: 2px solid #e5e7eb;
      padding-left: 24px;
      align-items: flex-end;
    }

    .document-title {
      font-size: 26px;
      font-weight: 700;
      color: #111827;
      letter-spacing: 0.5px;
      line-height: 1.2;
      margin: 0;
      padding-bottom: 12px;
      border-bottom: 1px solid #111827;
    }

    .regulatory-subtitle {
      font-size: 10px;
      font-weight: 400;
      color: #111827;
      text-align: center;
      margin-top: 8px;
      margin-bottom: 16px;
      line-height: 1.4;
      letter-spacing: 0.3px;
    }

    .header-meta-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
    }

    .invoice-meta-block {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 12px;
      align-items: flex-end;
    }

    .header-meta-label {
      font-size: 12px;
      font-weight: 700;
      color: #111827;
      flex-shrink: 0;
      letter-spacing: 0.8px;
    }

    .header-meta-value {
      font-size: 13px;
      font-weight: 400;
      color: #111827;
      text-align: right;
    }

    /* Invoice Number - Quiet, Official, Trade Finance Compliant */
    .invoice-number {
      font-size: 14px;
      font-weight: 700;
      color: #000;
      letter-spacing: 1.1px;
      text-align: right;
    }

    /* Invoice Date - Subordinate but Still Visible */
    .invoice-date {
      font-size: 13px;
      font-weight: 700;
      color: #000;
      letter-spacing: 1.1px;
      text-align: right;
    }

    /* Two-column layout */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-bottom: 32px;
    }

    .info-section {
      page-break-inside: avoid;
    }

    /* Universal Section Title Pattern (applies to all documents) */
    .section-title {
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;
      margin-top: 0;
      display: block;
    }

    /* Backwards compatibility - apply to h3 in sections */
    .info-section h3,
    .items-section h3 {
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;
      margin-top: 0;
    }

    .info-content {
      line-height: 1.8;
      font-size: 13px;
      color: #374151;
    }

    .info-content p {
      margin-bottom: 8px;
    }

    .info-content strong {
      font-weight: 600;
      color: #111827;
    }

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

    .transport-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: #111827;
      margin-bottom: 8px;
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

    /* Table System - Enterprise Minimal */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
    }

    thead {
      background: transparent;
      color: #111827;
    }

    th {
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #111827;
      border: none;
      border-bottom: 1px solid #d1d5db;
    }

    td {
      padding: 12px 8px;
      font-size: 12.5px;
      border-bottom: 1px solid #f3f4f6;
      color: #374151;
      font-weight: 400;
    }

    tbody tr:last-child td {
      border-bottom: 1px solid #d1d5db;
    }

    /* Column Alignment */
    .text-left {
      text-align: left;
    }

    .text-right {
      text-align: right;
      font-weight: 500;
      color: #111827;
    }

    .text-center {
      text-align: center;
    }

    .text-numeric {
      text-align: right;
      font-weight: 500;
      color: #111827;
      font-variant-numeric: tabular-nums;
    }

    .text-monospace {
      font-family: 'Courier New', 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      font-weight: 500;
      color: #374151;
      text-align: left;
      letter-spacing: 0.1px;
    }

    /* Institutional Table Column Alignment */
    .text-serial {
      text-align: center;
      font-size: 12px;
      font-weight: 500;
      color: #9ca3af;
      width: 40px;
    }

    .text-unit {
      text-align: left;
      font-size: 12px;
      font-weight: 400;
      color: #374151;
    }

    /* Financial Summary Block - Minimal (Stripe-style) */
    .summary {
      display: flex;
      justify-content: flex-end;
      margin-top: 32px;
      margin-bottom: 32px;
      page-break-inside: avoid;
    }

    .summary-box {
      width: 300px;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border: none;
      font-size: 13px;
      gap: 20px;
    }

    .summary-row.divider {
      border-top: 1px solid #d1d5db;
      padding: 12px 0 8px 0;
      margin: 4px 0;
      height: 0;
    }

    .summary-row.total {
      padding: 12px 0 8px 0;
      font-size: 16px;
      font-weight: 700;
      color: #111827;
    }

    .summary-label {
      font-weight: 400;
      color: #374151;
      flex-shrink: 0;
    }

    .summary-value {
      font-weight: 400;
      color: #111827;
      text-align: right;
    }

    .summary-row.total .summary-label,
    .summary-row.total .summary-value {
      color: #111827;
      font-weight: 700;
    }

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

    /* Signature Block - Bottom Right */
    .signature-block {
      margin-top: 24px;
      margin-bottom: 16px;
      display: flex;
      justify-content: flex-end;
      page-break-inside: avoid;
      break-inside: avoid;
      page-break-before: avoid;
      break-before: avoid;
    }

    .signature-container {
      width: 280px;
      text-align: right;
    }

    .signature-label {
      font-size: 12px;
      color: #000000;
      font-weight: 500;
      margin-bottom: 24px;
      line-height: 1.4;
    }

    .signature-space {
      height: 80px;
      margin-bottom: 0;
    }

    .signature-title {
      font-size: 11px;
      font-weight: 600;
      color: #000000;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      border-top: 1px solid #111827;
      padding-top: 8px;
      display: inline-block;
      min-width: 190px;
    }

    .signature-name {
      font-size: 11px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 16px;
    }

    .signature-hash {
      font-size: 9px;
      color: #9ca3af;
      font-family: 'Courier New', monospace;
      word-break: break-all;
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid #f3f4f6;
      line-height: 1.3;
    }

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
      font-size: 10px;
      font-weight: 400;
      color: #6b7280;
      line-height: 1.5;
      grid-column: 1 / -1;
    }

    /* Footer Compliance Strip */
    .footer {
      margin-top: 20px;
      padding-top: 16px;
      padding-bottom: 0;
      border-top: 1px solid #f3f4f6;
      font-size: 10px;
      font-weight: 400;
      color: #9ca3af;
      text-align: center;
      line-height: 1.4;
      page-break-inside: avoid;
      break-inside: avoid;
      page-break-before: avoid;
      break-before: avoid;
    }

    .footer-content {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .footer-item {
      display: inline;
    }

    .footer-separator {
      display: inline;
      color: #d1d5db;
    }

    .footer-brand {
      font-weight: 500;
      color: #374151;
    }

    .footer-hash {
      font-family: 'Courier New', monospace;
      color: #9ca3af;
      letter-spacing: 0.5px;
    }

    .footer p {
      margin: 0;
    }

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
  <div class="container">
    ${shouldShowWatermark ? `<div class="document-watermark">GENERATED VIA PLATFORM</div>` : ''}

    <!-- Page Number -->
    <div class="page-number">Page 1 of 1</div>
    
    <!-- Document Header System (Standardized Two-Column Layout) -->
    <div class="document-header">
      <!-- Left Column: Exporter Block -->
      <div class="header-left">
        <div class="exporter-name">${exporter.name || 'Exporter'}</div>
        ${exporter.iec ? `<div class="exporter-iec">IEC: ${exporter.iec}</div>` : ''}
        ${exporter.gstIN ? `<div class="exporter-gstin">GSTIN: ${exporter.gstIN}</div>` : ''}
        ${exporter.adCode ? `<div class="exporter-ad-code">AD Code: ${exporter.adCode}</div>` : ''}
        ${invoice.paymentTerms ? `<div class="payment-terms">Payment: ${invoice.paymentTerms}</div>` : ''}
      </div>

      <!-- Right Column: Document Identity (Title + Invoice Metadata) -->
      <div class="header-right">
        <h1 class="document-title">COMMERCIAL INVOICE</h1>
        <div class="regulatory-subtitle">(Issued under FEMA & RBI Guidelines)</div>
        <div class="invoice-meta-block">
          <div class="header-meta-row">
            <span class="header-meta-label">INVOICE NO:</span>
            <span class="invoice-number">${invoice.invoiceNumber}</span>
          </div>
          <div class="header-meta-row">
            <span class="header-meta-label">DATE:</span>
            <span class="invoice-date">${formattedInvoiceDate}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Exporter and Buyer Info -->
    <div class="info-grid">
      <!-- Exporter -->
      <div class="info-section">
        <h3>Exporter / Shipper</h3>
        <div class="info-content">
          <p><strong>${exporter.name || 'N/A'}</strong></p>
          <p>${exporter.address || 'Address not provided'}</p>
          ${exporter.iec ? `<p><strong>IEC:</strong> ${exporter.iec}</p>` : ''}
          ${exporter.gstIN ? `<p><strong>GSTIN:</strong> ${exporter.gstIN}</p>` : ''}
        </div>
      </div>

      <!-- Buyer -->
      <div class="info-section">
        <h3>Buyer / Importer</h3>
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
      <h3>Invoice Items</h3>
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
          <span class="summary-label">Total Invoice Value</span>
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

    <!-- Signature Block -->
    <div class="signature-block">
      <div class="signature-container">
        <div class="signature-label">For ${exporter.name || 'Exporter'}</div>
        <div class="signature-space"></div>
        <div class="signature-title">Authorized Signatory</div>
      </div>
    </div>

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
</body>
</html>
  `.trim()
}
