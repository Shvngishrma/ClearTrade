import { getDocumentAuditMetadata } from "@/lib/auditMetadata"
import { signatureBlockStyles } from "@/lib/renderSignatureBlock"
import {
  renderSectionTitle,
  sharedFooterStyles,
  sharedHeaderStyles,
  sharedPageStyles,
  sharedSectionStyles,
  sharedSummaryStyles,
  sharedTableStyles,
} from "@/lib/renderDocumentLayout"
import { documentSkeletonStyles, renderDocumentSkeleton } from "@/lib/renderDocumentSkeleton"

export function generateInsuranceHTML(invoice: any, insurance: any): string {
  const exporter = invoice?.exporter || {}
  const buyer = invoice?.buyer || {}
  const items = Array.isArray(invoice?.items) ? invoice.items : []
  const brandName = invoice?.brandName || "Export Docs"
  const auditMetadata = getDocumentAuditMetadata("INSURANCE", invoice)

  const insuredValue = Number(insurance?.insuredValue || 0)
  const policyNo = (insurance?.policyNumber || "N/A").trim()
  const invoiceRef = invoice?.invoiceNumber || "N/A"
  const coverageType = (insurance?.coverageType || "All Marine Risks").trim()
  const vesselOrVoyage = (invoice?.vesselOrFlightNumber || "N/A").trim()
  const dateValue = insurance?.createdAt || invoice?.invoiceDate || new Date()
  const formattedDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateValue))

  const certificateDate = new Date(dateValue)
  const certificateYear = certificateDate.getFullYear()
  const invoiceSequenceMatch = String(invoiceRef).match(/(\d+)(?!.*\d)/)
  const numericSequence = invoiceSequenceMatch?.[1] ? invoiceSequenceMatch[1].slice(-3).padStart(3, "0") : ""
  const fallbackSequence = String(invoiceRef).replace(/[^A-Za-z0-9]/g, "").slice(-3).toUpperCase()
  const certificateSequence = numericSequence || fallbackSequence || "001"
  const insuranceCertificateNo = `IC-${certificateYear}-${certificateSequence}`

  const formattedTimestamp = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date())

  const lineTotals = items.map((item: any) => (Number(item?.quantity) || 0) * (Number(item?.unitPrice) || 0))
  const baseTotal = lineTotals.reduce((sum: number, value: number) => sum + value, 0)
  const safeBase = baseTotal > 0 ? baseTotal : 1

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      Number.isFinite(value) ? value : 0
    )

  const insuranceItems = items.map((item: any, index: number) => {
    const lineTotal = lineTotals[index] || 0
    const allocated = insuredValue > 0 ? (insuredValue * lineTotal) / safeBase : 0
    return {
      serial: index + 1,
      description: item?.description || "Unspecified",
      insuredAmount: allocated,
      riskCoverage: coverageType,
    }
  })

  const goodsSummary =
    items.length > 0
      ? `${items.length} line item(s) covered under policy, corresponding to invoice ${invoiceRef}.`
      : "Goods covered as per supporting commercial invoice and packing specifications."

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Marine Insurance Certificate</title>
  <style>
    ${sharedPageStyles}
${sharedHeaderStyles}
${sharedSectionStyles}
${sharedTableStyles}
${sharedSummaryStyles}
${signatureBlockStyles}
${documentSkeletonStyles}
${sharedFooterStyles}

    .document-title {
      white-space: nowrap;
      font-weight: 800;
      font-size: 24px;
      letter-spacing: 0.4px;
    }

    .container {
      height: auto !important;
      min-height: auto !important;
      overflow: visible !important;
    }

    .summary {
      page-break-inside: avoid;
      break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="container">
    ${renderDocumentSkeleton({
      exporter,
      headerData: {
        documentTitle: "MARINE INSURANCE CERTIFICATE",
        subtitle: "(Issued for Trade Risk Coverage)",
        metadataRows: [
          { label: "INSURANCE CERTIFICATE NO:", value: insuranceCertificateNo, valueClass: "invoice-number" },
          { label: "POLICY NO:", value: policyNo, valueClass: "invoice-number" },
          { label: "INVOICE REF:", value: invoiceRef, valueClass: "header-meta-value" },
          { label: "INSURED VALUE:", value: `${invoice?.currency || "USD"} ${formatMoney(insuredValue)}`, valueClass: "header-meta-value" },
          { label: "COVERAGE TYPE:", value: coverageType, valueClass: "header-meta-value" },
          { label: "VESSEL / VOYAGE:", value: vesselOrVoyage, valueClass: "header-meta-value" },
          { label: "DATE:", value: formattedDate, valueClass: "invoice-date" },
        ],
      },
      content: `
        <div class="info-grid" style="margin-bottom: 8px; gap: 24px;">
          <div class="info-section">
            ${renderSectionTitle("Insured Party")}
            <div class="info-content">
              <p><strong>${exporter?.name || "N/A"}</strong></p>
              <p>${exporter?.address || "Address not provided"}</p>
              ${exporter?.iec ? `<p><strong>IEC:</strong> ${exporter.iec}</p>` : ""}
            </div>
          </div>

          <div class="info-section">
            ${renderSectionTitle("Beneficiary")}
            <div class="info-content">
              <p><strong>${buyer?.name || "N/A"}</strong></p>
              <p>${buyer?.address || "Address not provided"}</p>
              ${buyer?.country ? `<p><strong>Country:</strong> ${buyer.country}</p>` : ""}
            </div>
          </div>
        </div>

        <div class="info-grid" style="margin-bottom: 8px; gap: 24px;">
          <div class="info-section">
            ${renderSectionTitle("Goods Insured")}
            <div class="info-content">
              <p>${goodsSummary}</p>
            </div>
          </div>

          <div class="info-section">
            ${renderSectionTitle("Coverage Details")}
            <div class="info-content">
              <p><strong>Risk Coverage:</strong> ${coverageType}</p>
              <p><strong>Policy Number:</strong> ${policyNo}</p>
              <p><strong>Transit Reference:</strong> ${vesselOrVoyage}</p>
              <p>This certificate confirms that the goods referenced above are insured under the stated marine policy subject to terms and conditions.</p>
            </div>
          </div>
        </div>

        <table style="margin-top: 12px;">
          <thead>
            <tr>
              <th class="text-serial">Sr</th>
              <th class="text-left">Description</th>
              <th class="text-numeric">Insured Amount</th>
              <th class="text-left">Risk Coverage</th>
            </tr>
          </thead>
          <tbody>
            ${insuranceItems
              .map(
                  (item: { serial: number; description: string; insuredAmount: number; riskCoverage: string }) => `
            <tr>
              <td class="text-serial">${item.serial}</td>
              <td class="text-left">${item.description}</td>
              <td class="text-numeric"><strong>${invoice?.currency || "USD"} ${formatMoney(item.insuredAmount)}</strong></td>
              <td class="text-left">${item.riskCoverage}</td>
            </tr>`
              )
              .join("")}
          </tbody>
        </table>
      `,
      summarySection: `
        <div class="summary" style="margin-top: 12px; margin-bottom: 12px;">
          <div class="summary-box">
            <div class="summary-row divider"></div>
            <div class="summary-row total">
              <span class="summary-label">Total Insured Value:</span>
              <span class="summary-value">${invoice?.currency || "USD"} ${formatMoney(insuredValue)}</span>
            </div>
          </div>
        </div>
      `,
      signatureOptions: {
        labelOverride: "For Insurance Provider",
      },
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
