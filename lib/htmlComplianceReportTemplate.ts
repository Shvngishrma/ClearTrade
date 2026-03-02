import type { ComplianceReportData } from "@/lib/complianceReport"
import {
  renderSectionTitle,
  sharedFooterStyles,
  sharedHeaderStyles,
  sharedSectionStyles,
  sharedSummaryStyles,
  sharedTableStyles,
} from "@/lib/renderDocumentLayout"
import { renderSignatureBlock } from "@/lib/renderSignatureBlock"

function formatDateTimeIST(date: Date): string {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).format(date)

  return formatted.replace(", ", " | ") + " IST"
}

function getOverallVerdict(status: ComplianceReportData["overallStatus"]) {
  if (status === "FULLY_COMPLIANT") {
    return {
      label: "✓ FULLY COMPLIANT",
      frame: true,
    }
  }

  if (status === "COMPLIANT_WITH_WARNINGS") {
    return {
      label: "⚠ COMPLIANT WITH WARNINGS",
      frame: false,
    }
  }

  return {
    label: "✖ RELEASE BLOCKED",
    frame: false,
  }
}

function sectionStatusPill(status: "PASS" | "WARN" | "FAIL") {
  if (status === "PASS") return `<span class="pill pill-pass">PASS</span>`
  if (status === "WARN") return `<span class="pill pill-warn">WARN</span>`
  return `<span class="pill pill-fail">FAIL</span>`
}

function statusIcon(status: "PASS" | "WARN" | "FAIL") {
  if (status === "PASS") return "✅"
  if (status === "WARN") return "⚠"
  return "❌"
}

function matrixStatusIcon(status: "PASS" | "WARN" | "FAIL") {
  if (status === "PASS") return "✓"
  if (status === "WARN") return "⚠"
  return "✖"
}

function matrixScoreValue(row: ComplianceReportData["engineResults"][number]) {
  const normalizedScore = (row.score || "").trim()

  if (/^\d+(\.\d+)?%$/.test(normalizedScore)) {
    return normalizedScore
  }

  if (row.status === "WARN") {
    return "⚠"
  }

  return row.status === "PASS" ? "✓" : "✖"
}

export function generateComplianceReportHTML(data: ComplianceReportData): string {
  const verdict = getOverallVerdict(data.overallStatus)

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Document Compliance Certificate</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #111827;
      font-size: 12px;
      line-height: 1.5;
      background: #fff;
    }
    @page { size: A4; margin: 16mm; }

    .certificate {
      width: 100%;
      min-height: 100%;
    }

    .header {
      border-bottom: 1px solid #d1d5db;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 24px;
      font-size: 11px;
      color: #111827;
    }

    .status-box {
      margin: 14px 0 18px;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      padding: 12px;
    }

    .status-heading {
      font-size: 11px;
      font-weight: 600;
      color: #111827;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      text-align: center;
    }

    .verdict-wrap {
      text-align: center;
    }

    .verdict-frame {
      margin: 2px auto;
      max-width: 360px;
      border-top: 2px solid #111827;
      border-bottom: 2px solid #111827;
      padding: 10px 12px;
      text-align: center;
    }

    .verdict-label {
      display: inline-block;
      font-size: 17px;
      font-weight: 700;
      letter-spacing: 0.35px;
      color: #111827;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
    }

    .pill {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      border-radius: 999px;
      padding: 3px 8px;
      border: 1px solid transparent;
    }

    .pill-pass { background: #ecfdf3; color: #166534; border-color: #86efac; }
    .pill-warn { background: #fffbeb; color: #92400e; border-color: #fcd34d; }
    .pill-fail { background: #fef2f2; color: #991b1b; border-color: #fca5a5; }

    .split {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 8px;
    }

    .box {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 10px;
      min-height: 120px;
    }

    .list-item { margin-bottom: 6px; font-size: 11px; color: #1f2937; }

    .page-break {
      break-before: page;
      page-break-before: always;
      margin-top: 8px;
    }

${sharedHeaderStyles}
${sharedSectionStyles}
${sharedTableStyles}
${sharedSummaryStyles}
${sharedFooterStyles}
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">
      <h1 class="document-title">DOCUMENT COMPLIANCE CERTIFICATE</h1>
      <div class="meta-grid">
        <div><strong>Certificate ID:</strong> ${data.certificateId}</div>
        <div><strong>Invoice Ref:</strong> ${data.invoiceRef}</div>
        <div><strong>Version:</strong> ${data.integritySeal.versionId}</div>
        <div><strong>Generated:</strong> ${formatDateTimeIST(data.generatedOn)}</div>
      </div>
    </div>

    <div class="status-box">
      <div class="status-heading">1. Overall Verdict</div>
      <div class="verdict-wrap">
        ${verdict.frame
          ? `<div class="verdict-frame"><span class="verdict-label">${verdict.label}</span></div>`
          : `<span class="verdict-label">${verdict.label}</span>`}
      </div>
    </div>

    ${renderSectionTitle("2. Engine Score Matrix")}
    <table class="table">
      <thead>
        <tr>
          <th style="width: 36%">Engine</th>
          <th style="width: 14%">Status</th>
          <th style="width: 12%">Score</th>
          <th>Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${data.engineResults
          .map(
            (row) => `
          <tr>
            <td><strong>${row.engine}</strong></td>
            <td>${matrixStatusIcon(row.status)}</td>
            <td>${matrixScoreValue(row)}</td>
            <td>${row.notes}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    ${renderSectionTitle("Compliance Controls")}
    <table class="table">
      <thead>
        <tr>
          <th style="width: 28%">Control</th>
          <th style="width: 14%">Status</th>
          <th>Evidence</th>
        </tr>
      </thead>
      <tbody>
        ${data.sections
          .map(
            (section) => `
          <tr>
            <td><strong>${section.title}</strong></td>
            <td>${sectionStatusPill(section.status)}</td>
            <td>${section.details}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    <div class="split">
      <div class="box">
        ${renderSectionTitle("Critical Blockers")}
        ${
          data.blockers.length === 0
            ? `<div class="list-item">No critical blockers at report generation time.</div>`
            : data.blockers
                .slice(0, 12)
                .map(
                  (b) => `<div class="list-item">• [${b.engine}] ${b.code}: ${b.message}</div>`
                )
                .join("")
        }
      </div>
      <div class="box">
        ${renderSectionTitle("Warnings / Observations")}
        ${
          data.warnings.length === 0
            ? `<div class="list-item">No warnings.</div>`
            : data.warnings
                .slice(0, 12)
                .map((w) => `<div class="list-item">• [${w.engine}] ${w.code}: ${w.message}</div>`)
                .join("")
        }
      </div>
    </div>

    ${data.advisories.length > 0 ? `
    ${renderSectionTitle("3. Advisories")}
    <div class="box" style="min-height: auto;">
      ${data.advisories.map((advisory) => `<div class="list-item">• ${advisory}</div>`).join("")}
    </div>
    ` : ""}

    ${data.riskFlags.length > 0 ? `
    ${renderSectionTitle("Risk Flags")}
    <table class="table">
      <thead>
        <tr>
          <th style="width: 30%">Flag</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        ${data.riskFlags
          .map(
            (flag) => `
          <tr>
            <td><strong>${flag.label}</strong></td>
            <td>${flag.details}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
    ` : ""}

    <div class="page-break"></div>

    ${renderSectionTitle("4. Proof Layer")}

    ${renderSectionTitle("Exchange Rate Proof")}
    <table class="table">
      <tbody>
        <tr>
          <th style="width: 32%">Rate</th>
          <td>${data.technicalProof.exchangeRateProof.referenceRate} ${data.technicalProof.exchangeRateProof.referenceCurrency}</td>
        </tr>
        <tr>
          <th>Reference Date</th>
          <td>${data.technicalProof.exchangeRateProof.referenceDate}</td>
        </tr>
        <tr>
          <th>RBI Ref</th>
          <td>${data.technicalProof.exchangeRateProof.rbiReferenceId}</td>
        </tr>
        <tr>
          <th>Proof Hash</th>
          <td>${data.technicalProof.exchangeRateProof.proofHash}</td>
        </tr>
      </tbody>
    </table>

    ${renderSectionTitle("LC Snapshot")}
    <table class="table">
      <tbody>
        <tr>
          <th style="width: 32%">LC No</th>
          <td>${data.technicalProof.lcComplianceDetail.lcNumber}</td>
        </tr>
        <tr>
          <th>Governed By</th>
          <td>${data.technicalProof.lcComplianceDetail.governedBy}</td>
        </tr>
        <tr>
          <th>Shipment Deadline</th>
          <td>${data.technicalProof.lcComplianceDetail.shipmentDeadline}</td>
        </tr>
        <tr>
          <th>Presentation Window</th>
          <td>${data.technicalProof.lcComplianceDetail.presentationWindow}</td>
        </tr>
        <tr>
          <th>Tolerance</th>
          <td>${data.technicalProof.lcComplianceDetail.toleranceApplied}</td>
        </tr>
      </tbody>
    </table>

    ${renderSectionTitle("IEC–AD–Port")}
    <table class="table">
      <tbody>
        <tr>
          <th style="width: 32%">IEC</th>
          <td>${data.technicalProof.iecAdPortChain.iec}</td>
        </tr>
        <tr>
          <th>AD</th>
          <td>${data.technicalProof.iecAdPortChain.adCode}</td>
        </tr>
        <tr>
          <th>Port</th>
          <td>${data.technicalProof.iecAdPortChain.port}</td>
        </tr>
        <tr>
          <th>EDPMS</th>
          <td>${data.technicalProof.iecAdPortChain.edpmsFlag}</td>
        </tr>
      </tbody>
    </table>

    ${renderSectionTitle("🧾 Cross-Document Validation")}
    <table class="table">
      <tbody>
        ${data.crossDocumentValidation
          .map(
            (row) => `
        <tr>
          <td>${row.label}</td>
          <td style="width: 18%">${row.passed ? "✅" : "❌"}</td>
        </tr>
      `
          )
          .join("")}
      </tbody>
    </table>

    ${renderSectionTitle("5. Integrity Seal")}
    <table class="table">
      <tbody>
        <tr>
          <th style="width: 32%">Document Hash</th>
          <td>${data.integritySeal.documentHashExpression}</td>
        </tr>
        <tr>
          <th>System Validation Timestamp</th>
          <td>${data.integritySeal.validationTimestamp}</td>
        </tr>
        <tr>
          <th>Version</th>
          <td>${data.integritySeal.versionId}</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      This certificate reflects automated validation against RBI Master Direction – Export of Goods & Services, DGFT Trade Classification norms, UCP 600 LC rules, and internal cross-document integrity controls.
    </div>
  </div>
</body>
</html>
  `.trim()
}
