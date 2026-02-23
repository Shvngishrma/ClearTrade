/**
 * HTML template for Packing List
 * Mirrors Commercial Invoice design language for institutional consistency.
 */

import { getDocumentAuditMetadata } from "@/lib/auditMetadata"

export function generatePackingListHTML(invoice: any, packing: any, usage?: any): string {
  const exporter = invoice.exporter || {}
  const buyer = invoice.buyer || {}
  const cartons = Array.isArray(packing?.cartons) ? packing.cartons : []

  const shouldShowWatermark = usage?.isPro === false
  const auditMetadata = getDocumentAuditMetadata("PACKING_LIST", invoice)
  const documentTimestamp = invoice.documentTimestamp || new Date().toISOString()
  const documentHash = (invoice.documentHash || "").toString().trim()
  const auditId = (invoice.auditId || "").toString().trim()
  const brandName = (invoice.brandName || "Export Docs").toString().trim()

  const invoiceDateValue = invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date()
  const formattedInvoiceDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(invoiceDateValue)

  const poRef = (invoice.poReference || invoice.poRef || invoice.purchaseOrderRef || "").toString().trim()

  const totalNetWeight = Number(packing?.netWeight || 0)
  const totalGrossWeight = Number(packing?.grossWeight || 0)
  const totalCBM = Number(packing?.totalCBM || 0)
  const totalBoxes = Number(packing?.totalBoxes || cartons.length || 0)

  const formattedTimestamp = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(documentTimestamp))

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Packing List</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
      font-size: 13px;
      line-height: 1.6;
      color: #374151;
      background: white;
    }

    @page { size: A4; margin: 20mm 18mm 20mm 18mm; }

    .container { width: 100%; max-width: 100%; page-break-inside: avoid; position: relative; }

    .document-watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-32deg);
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

    .page-number {
      position: absolute;
      bottom: 20px;
      right: 20px;
      font-size: 10px;
      font-weight: 400;
      color: #9ca3af;
    }

    .document-header {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-bottom: 40px;
      page-break-inside: avoid;
    }

    .header-left {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      gap: 12px;
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
      color: #111827;
      text-align: center;
      margin-top: 8px;
      margin-bottom: 16px;
      letter-spacing: 0.3px;
    }

    .invoice-meta-block {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 12px;
      align-items: flex-end;
    }

    .header-meta-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 12px;
    }

    .header-meta-label {
      font-size: 12px;
      font-weight: 700;
      color: #111827;
      letter-spacing: 0.8px;
    }

    .invoice-number, .invoice-date {
      font-size: 13px;
      font-weight: 700;
      color: #000;
      letter-spacing: 1.1px;
      text-align: right;
    }

    .exporter-name {
      font-size: 13px;
      font-weight: 600;
      color: #111827;
      line-height: 1.4;
    }

    .exporter-iec, .exporter-gstin, .payment-terms {
      font-size: 12px;
      font-weight: 500;
      color: #111827;
      letter-spacing: 0.3px;
    }

    .payment-terms {
      padding: 8px 0;
      border-top: 1px solid #e5e7eb;
      margin-top: 4px;
      font-weight: 600;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-bottom: 32px;
    }

    .info-section h3, .items-section h3 {
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

    .info-content { line-height: 1.8; font-size: 13px; color: #374151; }
    .info-content p { margin-bottom: 8px; }
    .info-content strong { color: #111827; font-weight: 600; }

    .shipment-details {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 40px;
      margin-bottom: 32px;
      page-break-inside: avoid;
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

    .shipment-item-value { color: #374151; font-size: 13px; }

    .items-section { margin-bottom: 24px; page-break-inside: avoid; }

    table { width: 100%; border-collapse: collapse; margin-top: 16px; }

    th {
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #111827;
      border-bottom: 1px solid #d1d5db;
    }

    td {
      padding: 12px 8px;
      font-size: 12.5px;
      border-bottom: 1px solid #f3f4f6;
      color: #374151;
    }

    tbody tr:last-child td { border-bottom: 1px solid #d1d5db; }

    .text-right { text-align: right; font-weight: 500; color: #111827; }
    .text-center { text-align: center; }

    .summary {
      display: flex;
      justify-content: flex-end;
      margin-top: 24px;
      margin-bottom: 28px;
      page-break-inside: avoid;
    }

    .summary-box { width: 320px; }

    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
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

    .summary-label { color: #374151; }
    .summary-value { color: #111827; text-align: right; font-weight: 500; }

    .declaration-block {
      margin-top: 8px;
      margin-bottom: 26px;
      font-size: 11px;
      color: #6b7280;
      line-height: 1.5;
      border-top: 1px solid #f3f4f6;
      padding-top: 12px;
    }

    .signature-block {
      margin-top: 48px;
      margin-bottom: 32px;
      display: flex;
      justify-content: flex-end;
      page-break-inside: avoid;
    }

    .signature-container { width: 280px; text-align: right; }

    .signature-label {
      font-size: 12px;
      color: #000000;
      font-weight: 500;
      margin-bottom: 24px;
      line-height: 1.4;
    }

    .signature-space { height: 80px; margin-bottom: 0; }

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

    .compliance-footer {
      margin-top: 32px;
      margin-bottom: 32px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px 40px;
      font-size: 11px;
      color: #6b7280;
      padding: 16px 0;
      border-top: 1px solid #f3f4f6;
      border-bottom: 1px solid #f3f4f6;
      page-break-inside: avoid;
    }

    .compliance-footer-item { display: flex; flex-direction: column; gap: 4px; }

    .compliance-footer-label {
      font-size: 10px;
      font-weight: 600;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .compliance-footer-value { font-size: 11px; color: #374151; }

    .compliance-footer-text {
      font-size: 10px;
      color: #6b7280;
      line-height: 1.5;
      grid-column: 1 / -1;
    }

    .footer {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid #f3f4f6;
      font-size: 10px;
      color: #9ca3af;
      text-align: center;
      line-height: 1.4;
    }

    .footer-content {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .footer-item { display: inline; }
    .footer-brand { font-weight: 500; color: #374151; }
    .footer-separator { color: #d1d5db; }
    .footer-hash {
      font-family: 'Courier New', monospace;
      color: #9ca3af;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="container">
    ${shouldShowWatermark ? `<div class="document-watermark">GENERATED VIA PLATFORM</div>` : ""}
    <div class="page-number">Page 1 of 1</div>

    <div class="document-header">
      <div class="header-left">
        <div class="exporter-name">${exporter.name || "Exporter"}</div>
        ${exporter.iec ? `<div class="exporter-iec">IEC: ${exporter.iec}</div>` : ""}
        ${exporter.gstin ? `<div class="exporter-gstin">GSTIN: ${exporter.gstin}</div>` : ""}
        ${invoice.paymentTerms ? `<div class="payment-terms">Payment: ${invoice.paymentTerms}</div>` : ""}
      </div>

      <div class="header-right">
        <h1 class="document-title">PACKING LIST</h1>
        <div class="regulatory-subtitle">(Issued under FEMA & RBI Guidelines)</div>
        <div class="invoice-meta-block">
          <div class="header-meta-row">
            <span class="header-meta-label">INVOICE NO:</span>
            <span class="invoice-number">${invoice.invoiceNumber || ""}</span>
          </div>
          <div class="header-meta-row">
            <span class="header-meta-label">DATE:</span>
            <span class="invoice-date">${formattedInvoiceDate}</span>
          </div>
          <div class="header-meta-row">
            <span class="header-meta-label">PO REF:</span>
            <span class="invoice-date">${poRef}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-section">
        <h3>Exporter / Shipper</h3>
        <div class="info-content">
          <p><strong>${exporter.name || "N/A"}</strong></p>
          <p>${exporter.address || "Address not provided"}</p>
          ${exporter.iec ? `<p><strong>IEC:</strong> ${exporter.iec}</p>` : ""}
          ${exporter.gstin ? `<p><strong>GSTIN:</strong> ${exporter.gstin}</p>` : ""}
        </div>
      </div>

      <div class="info-section">
        <h3>Buyer / Importer</h3>
        <div class="info-content">
          <p><strong>${buyer.name || "N/A"}</strong></p>
          <p>${buyer.address || "Address not provided"}</p>
          ${buyer.country ? `<p><strong>Country:</strong> ${buyer.country}</p>` : ""}
        </div>
      </div>
    </div>

    <div class="shipment-details">
      <div class="shipment-item">
        <span class="shipment-item-label">Incoterm</span>
        <span class="shipment-item-value">${invoice.incoterm || ""}</span>
      </div>
      <div class="shipment-item">
        <span class="shipment-item-label">Port of Loading</span>
        <span class="shipment-item-value">${invoice.portOfLoading || ""}</span>
      </div>
      <div class="shipment-item">
        <span class="shipment-item-label">Port of Discharge</span>
        <span class="shipment-item-value">${invoice.portOfDischarge || ""}</span>
      </div>
      <div class="shipment-item">
        <span class="shipment-item-label">Country of Origin</span>
        <span class="shipment-item-value">${invoice.countryOfOrigin || ""}</span>
      </div>
      <div class="shipment-item">
        <span class="shipment-item-label">Mode of Transport</span>
        <span class="shipment-item-value">${invoice.modeOfTransport || ""}</span>
      </div>
    </div>

    <div class="items-section">
      <h3>Carton Details</h3>
      <table>
        <thead>
          <tr>
            <th>Carton No</th>
            <th>Marks</th>
            <th>Dimensions (cm)</th>
            <th class="text-right">Net Wt</th>
            <th class="text-right">Gross Wt</th>
            <th class="text-right">CBM</th>
          </tr>
        </thead>
        <tbody>
          ${cartons
            .map((carton: any) => {
              const dimensions =
                carton.lengthCm && carton.widthCm && carton.heightCm
                  ? `${Number(carton.lengthCm).toFixed(2)} × ${Number(carton.widthCm).toFixed(2)} × ${Number(carton.heightCm).toFixed(2)}`
                  : ""

              return `
              <tr>
                <td>${carton.cartonNumber ?? ""}</td>
                <td>${carton.marks || ""}</td>
                <td>${dimensions}</td>
                <td class="text-right">${Number(carton.netWeightKg || 0).toFixed(3)}</td>
                <td class="text-right">${Number(carton.grossWeightKg || 0).toFixed(3)}</td>
                <td class="text-right">${Number(carton.cbm || 0).toFixed(6)}</td>
              </tr>
            `
            })
            .join("")}
        </tbody>
      </table>
    </div>

    <div class="summary">
      <div class="summary-box">
        <div class="summary-row">
          <span class="summary-label">Total Cartons</span>
          <span class="summary-value">${totalBoxes}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Total Net Weight (kg)</span>
          <span class="summary-value">${totalNetWeight.toFixed(3)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Total Gross Weight (kg)</span>
          <span class="summary-value">${totalGrossWeight.toFixed(3)}</span>
        </div>
        <div class="summary-row divider"></div>
        <div class="summary-row total">
          <span class="summary-label">Total CBM</span>
          <span class="summary-value">${totalCBM.toFixed(6)}</span>
        </div>
      </div>
    </div>

    <div class="declaration-block">
      We hereby certify that the above packing details are true and correct and correspond to the related commercial invoice.
    </div>

    <div class="signature-block">
      <div class="signature-container">
        <div class="signature-label">For ${exporter.name || "Exporter"}</div>
        <div class="signature-space"></div>
        <div class="signature-title">Authorized Signatory</div>
      </div>
    </div>

    <div class="compliance-footer">
      ${(exporter.iec || exporter.iecNo) ? `
      <div class="compliance-footer-item">
        <div class="compliance-footer-label">IEC</div>
        <div class="compliance-footer-value">${exporter.iec || exporter.iecNo}</div>
      </div>
      ` : ""}
      ${exporter.adCode ? `
      <div class="compliance-footer-item">
        <div class="compliance-footer-label">AD Code</div>
        <div class="compliance-footer-value">${exporter.adCode}</div>
      </div>
      ` : ""}
      ${exporter.exchangeRateRef ? `
      <div class="compliance-footer-item">
        <div class="compliance-footer-label">Exchange Rate Ref</div>
        <div class="compliance-footer-value">${exporter.exchangeRateRef}</div>
      </div>
      ` : ""}
      ${exporter.realizedValue ? `
      <div class="compliance-footer-item">
        <div class="compliance-footer-label">Realized Value</div>
        <div class="compliance-footer-value">${invoice.currency || ""} ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(exporter.realizedValue)}</div>
      </div>
      ` : ""}
      ${invoice.invoiceNumber ? `
      <div class="compliance-footer-item">
        <div class="compliance-footer-label">Invoice Ref</div>
        <div class="compliance-footer-value">${invoice.invoiceNumber}</div>
      </div>
      ` : ""}
      <div class="compliance-footer-text">This document was prepared in accordance with applicable trade and tax regulations. The exporter certifies the accuracy of information provided and assumes responsibility for compliance with all relevant trade laws.</div>
    </div>

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
