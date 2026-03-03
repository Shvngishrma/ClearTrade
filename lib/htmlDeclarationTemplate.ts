import { getDocumentAuditMetadata } from "@/lib/auditMetadata"
import { renderSignatureBlock, signatureBlockStyles } from "@/lib/renderSignatureBlock"
import {
  renderHeaderBlock,
  renderSectionTitle,
  sharedFooterStyles,
  sharedHeaderStyles,
  sharedPageStyles,
  sharedSectionStyles,
} from "@/lib/renderDocumentLayout"

const declarationClauses = [
  "Goods exported are as per invoice and accompanying export documents.",
  "Export proceeds will be realized within the prescribed period under FEMA regulations.",
  "No prohibited or restricted goods are included in this shipment.",
  "Details furnished in this declaration are true and correct to the best of our knowledge.",
  "The export value declared represents the full and true value of the goods.",
  "All information furnished herein is in compliance with FEMA, RBI and Customs regulations.",
]

export function generateDeclarationHTML(invoice: any): string {
  const exporter = invoice?.exporter || {}
  const buyer = invoice?.buyer || {}
  const layoutExporter = {
    ...exporter,
    iec: exporter?.iec || exporter?.iecNo,
    gstIN: exporter?.gstIN || exporter?.gstin,
  }
  const auditMetadata = getDocumentAuditMetadata("DECLARATION", invoice)

  const declarationDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date())

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Export Declaration</title>
  <style>
    ${sharedPageStyles}
${sharedHeaderStyles}
${sharedSectionStyles}
${signatureBlockStyles}
${sharedFooterStyles}
  </style>
</head>
<body>
  <div class="container">
    ${renderHeaderBlock({
      exporter: layoutExporter,
      documentTitle: "EXPORT DECLARATION",
      subtitle: "(Under FEMA Regulations)",
      metadataRows: [
        { label: "INVOICE REF:", value: invoice?.invoiceNumber || "N/A", valueClass: "invoice-number" },
        { label: "DATE:", value: declarationDate, valueClass: "invoice-date" },
      ],
    })}

    <div class="info-grid">
      <div class="info-section">
        ${renderSectionTitle("Exporter / Shipper")}
        <div class="info-content">
          <p><strong>${layoutExporter?.name || "N/A"}</strong></p>
          <p>${layoutExporter?.address || "Address not provided"}</p>
          ${layoutExporter?.iec ? `<p><strong>IEC:</strong> ${layoutExporter.iec}</p>` : ""}
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

    ${renderSectionTitle("Declaration")}
    <div class="info-content">
      ${declarationClauses.map((clause) => `<p>• ${clause}</p>`).join("")}
    </div>

    ${renderSignatureBlock(layoutExporter)}

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
