/**
 * Shared page and viewport styles for A4 documents
 * Ensures consistent layout across all templates with proper pagination
 * Uses @page rule with margins to allow natural content flow instead of clipping
 */
export const sharedPageStyles = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      width: 100%;
      height: 100%;
      overflow: auto;
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
      margin: 20mm;
    }

    .container {
      width: 100%;
      max-width: 100%;
      position: relative;
    }
`

export const sharedHeaderStyles = `
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

    .invoice-number {
      font-size: 14px;
      font-weight: 700;
      color: #000;
      letter-spacing: 1.1px;
      text-align: right;
    }

    .invoice-date {
      font-size: 13px;
      font-weight: 700;
      color: #000;
      letter-spacing: 1.1px;
      text-align: right;
    }
`

export const sharedSectionStyles = `
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-bottom: 32px;
    }

    .info-section {
      page-break-inside: avoid;
    }

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
`

export const sharedTableStyles = `
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
      white-space: nowrap;
    }

    th.text-numeric,
    td.text-numeric {
      text-align: right;
    }

    .text-monospace {
      font-family: 'Courier New', 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      font-weight: 500;
      color: #374151;
      text-align: left;
      letter-spacing: 0.1px;
    }

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
`

export const sharedSummaryStyles = `
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
      font-size: 13px;
      font-weight: 600;
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
      font-weight: 600;
    }
`

export const sharedFooterStyles = `
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
`

export function renderSectionTitle(title: string): string {
  return `<h3 class="section-title">${title}</h3>`
}

type HeaderMetaEntry = {
  label: string
  value: string
  valueClass?: string
}

type HeaderBlockParams = {
  exporter: any
  documentTitle: string
  paymentTerms?: string
  subtitle?: string
  metadataRows: HeaderMetaEntry[]
}

export function renderHeaderBlock({
  exporter,
  documentTitle,
  paymentTerms,
  subtitle = "(Issued under FEMA & RBI Guidelines)",
  metadataRows,
}: HeaderBlockParams): string {
  return `
    <div class="document-header">
      <div class="header-left">
        <div class="exporter-name">${exporter?.name || "Exporter"}</div>
        ${exporter?.iec ? `<div class="exporter-iec">IEC: ${exporter.iec}</div>` : ""}
        ${exporter?.gstIN ? `<div class="exporter-gstin">GSTIN: ${exporter.gstIN}</div>` : ""}
        ${exporter?.adCode ? `<div class="exporter-ad-code">AD Code: ${exporter.adCode}</div>` : ""}
        ${paymentTerms ? `<div class="payment-terms">Payment: ${paymentTerms}</div>` : ""}
      </div>

      <div class="header-right">
        <h1 class="document-title">${documentTitle}</h1>
        <div class="regulatory-subtitle">${subtitle}</div>
        <div class="invoice-meta-block">
          ${metadataRows
            .map(
              (row) => `
          <div class="header-meta-row">
            <span class="header-meta-label">${row.label}</span>
            <span class="${row.valueClass || "header-meta-value"}">${row.value}</span>
          </div>`
            )
            .join("")}
        </div>
      </div>
    </div>
  `
}
