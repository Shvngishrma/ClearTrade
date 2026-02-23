import { validateBeforeRelease, type ReleaseValidationResult, type ReleaseValidationIssue } from "@/lib/preSubmissionValidationGate"
import { buildComplianceReportData } from "@/lib/complianceReport"
import { generateComplianceReportHTML } from "@/lib/htmlComplianceReportTemplate"

export interface ComplianceReportBlocked {
  allowed: false
  blockers: ReleaseValidationIssue[]
}

export interface ComplianceReportSuccess {
  allowed: true
  html: string
}

export type ComplianceReportResult = ComplianceReportBlocked | ComplianceReportSuccess

/**
 * Build HTML from validation result.
 * Only called when validation passes.
 */
async function buildComplianceHTML(gateResult: ReleaseValidationResult): Promise<string> {
  const reportData = await buildComplianceReportData(gateResult.invoiceId)
  return generateComplianceReportHTML(reportData)
}

/**
 * Generate compliance report with pre-submission validation gate.
 * Returns blockers if validation fails, HTML if validation passes.
 */
export async function generateComplianceReport(invoiceId: string): Promise<ComplianceReportResult> {
  const gateResult = await validateBeforeRelease(invoiceId)

  if (!gateResult.canRelease) {
    return {
      allowed: false,
      blockers: gateResult.blockers,
    }
  }

  return {
    allowed: true,
    html: await buildComplianceHTML(gateResult),
  }
}
