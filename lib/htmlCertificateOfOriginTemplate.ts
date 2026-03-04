import { getDocumentAuditMetadata } from "@/lib/auditMetadata"
import { signatureBlockStyles } from "@/lib/renderSignatureBlock"
import {
  renderSectionTitle,
  sharedFooterStyles,
  sharedHeaderStyles,
  sharedPageStyles,
  sharedSectionStyles,
  sharedTableStyles,
} from "@/lib/renderDocumentLayout"
import { documentSkeletonStyles, renderDocumentSkeleton } from "@/lib/renderDocumentSkeleton"

export function generateCertificateOfOriginHTML(invoice: any, coo: any): string {
  const exporter = invoice?.exporter || {}
  const buyer = invoice?.buyer || {}
  const layoutExporter = {
    ...exporter,
    iec: exporter?.iec || exporter?.iecNo,
    gstIN: exporter?.gstIN || exporter?.gstin,
  }
  const auditMetadata = getDocumentAuditMetadata("CERTIFICATE_OF_ORIGIN", invoice)

  const cooDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(coo?.createdAt || new Date()))

  const originCountry = coo?.originCountry || invoice?.countryOfOrigin || "N/A"

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate of Origin</title>
  <style>
    ${sharedPageStyles}
${sharedHeaderStyles}
${sharedSectionStyles}
${sharedTableStyles}
${signatureBlockStyles}
${documentSkeletonStyles}
${sharedFooterStyles}

    .document-title {
      white-space: nowrap;
      font-weight: 800;
      letter-spacing: 0.4px;
    }

    .document-header {
      margin-bottom: 18px;
    }

    .info-grid {
      margin-bottom: 18px;
    }

    table {
      margin-top: 18px;
    }

    .coo-certification-text {
      font-size: 13px;
      color: #374151;
      line-height: 1.5;
      margin-top: 0;
      page-break-inside: avoid;
    }

    .issuing-authority-seal {
      width: 70px;
      height: 70px;
      border: 2px solid #6b7280;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 10px 0;
      background: #f9fafb;
      font-size: 32px;
      color: #9ca3af;
    }

    .authority-detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      padding: 4px 0;
    }

    .authority-label {
      font-weight: 600;
      color: #6b7280;
      font-size: 11px;
    }

    .authority-value {
      color: #374151;
      font-size: 12px;
    }

    .issuing-authority-section {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .issuing-authority-card {
      margin-top: 8px;
      padding: 10px 12px;
      background: #f9fafb;
      border: 1px solid #d1d5db;
    }
  </style>
</head>
<body>
  <div class="container">
    ${renderDocumentSkeleton({
      exporter: layoutExporter,
      headerData: {
        documentTitle: "CERTIFICATE OF ORIGIN",
        subtitle: "(Issued for Trade Certification Purpose)",
        metadataRows: [
          { label: "INVOICE REF:", value: invoice?.invoiceNumber || "N/A", valueClass: "invoice-number" },
          { label: "DATE:", value: cooDate, valueClass: "invoice-date" },
          { label: "COUNTRY OF ORIGIN:", value: originCountry, valueClass: "header-meta-value" },
        ],
      },
      content: `
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
            ${renderSectionTitle("Consignee / Importer")}
            <div class="info-content">
              <p><strong>${buyer?.name || "N/A"}</strong></p>
              <p>${buyer?.address || "Address not provided"}</p>
              ${buyer?.country ? `<p><strong>Country:</strong> ${buyer.country}</p>` : ""}
            </div>
          </div>
        </div>

        ${renderSectionTitle("Goods Details")}
        <table>
          <thead>
            <tr>
              <th class="text-left">Description</th>
              <th class="text-monospace">HS Code</th>
              <th class="text-left">Country of Origin</th>
            </tr>
          </thead>
          <tbody>
            ${(invoice?.items || [])
              .map(
                (item: any) => `
            <tr>
              <td class="text-left">${item.description || "Unspecified"}</td>
              <td class="text-monospace">${item.hsCode || "—"}</td>
              <td class="text-left">${originCountry}</td>
            </tr>`
              )
              .join("")}
          </tbody>
        </table>

        ${renderSectionTitle("Certification")}
        <div class="coo-certification-text">
          We certify that the above-mentioned goods originate from the stated country of origin and are true to the best of our knowledge and records.
        </div>

        ${coo?.chamberName ? `
        <div class="issuing-authority-section" style="display: flex; gap: 20px; margin-top: 12px;">
          <div style="flex: 1;">
            <div class="issuing-authority-card">
              <div style="text-align: center; margin-bottom: 8px;">
                <div class="issuing-authority-seal">⊕</div>
              </div>

              <div class="authority-detail-row">
                <div class="authority-label">CHAMBER OF COMMERCE</div>
                <div class="authority-value">${coo.chamberName}</div>
              </div>

              ${coo.registrationNumber ? `
              <div class="authority-detail-row">
                <div class="authority-label">REGISTRATION NUMBER</div>
                <div class="authority-value">${coo.registrationNumber}</div>
              </div>
              ` : ""}

              <div class="authority-detail-row">
                <div class="authority-label">PLACE</div>
                <div class="authority-value">${exporter?.address?.split(",").pop()?.trim() || exporter?.country || "India"}</div>
              </div>

              <div class="authority-detail-row">
                <div class="authority-label">DATE</div>
                <div class="authority-value">${coo.createdAt ? new Date(coo.createdAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }) : new Date().toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}</div>
              </div>
            </div>
          </div>
        </div>
        ` : ""}
      `,
      footerData: {
        leadingText: "System Generated",
        documentId: auditMetadata.documentId,
        hash: auditMetadata.hash,
      },
    })}
  </div>
</body>
</html>
  `.trim()
}
