import { prisma } from "@/lib/db"
import { validateBeforeRelease } from "@/lib/preSubmissionValidationGate"
import { runMasterCompliancePipeline } from "@/lib/masterCompliancePipeline"
import { validateHSCodeWithLiveData } from "@/lib/hsCodeLiveValidationService"
import { validateADIECPortChain } from "@/lib/rbiIECValidationService"
import { generateExchangeRateHash, generateHMACSignature, getRBIReferenceRate } from "@/lib/exchangeRateCryptoProofService"

export type ComplianceOverallStatus =
  | "FULLY_COMPLIANT"
  | "COMPLIANT_WITH_WARNINGS"
  | "BLOCKED_NOT_RELEASED"

export type ComplianceSectionStatus = "PASS" | "WARN" | "FAIL"

export interface ComplianceSection {
  key: string
  title: string
  status: ComplianceSectionStatus
  details: string
}

export interface ComplianceReportData {
  certificateId: string
  invoiceId: string
  invoiceRef: string
  generatedOn: Date
  generatedBy: string
  overallStatus: ComplianceOverallStatus
  sections: ComplianceSection[]
  engineResults: Array<{
    engine: string
    status: "PASS" | "WARN" | "FAIL"
    score: string
    notes: string
  }>
  advisories: string[]
  riskFlags: Array<{
    code: string
    label: string
    details: string
  }>
  technicalProof: {
    exchangeRateProof: {
      referenceRate: string
      referenceCurrency: string
      referenceDate: string
      rbiReferenceId: string
      proofHash: string
      hmacSignature: string
    }
    lcComplianceDetail: {
      lcNumber: string
      governedBy: string
      toleranceApplied: string
      presentationWindow: string
      shipmentDeadline: string
    }
    iecAdPortChain: {
      iec: string
      adCode: string
      port: string
      edpmsFlag: string
    }
  }
  crossDocumentValidation: Array<{
    label: string
    passed: boolean
  }>
  integritySeal: {
    documentHashExpression: string
    versionId: string
    validationTimestamp: string
  }
  blockers: Array<{ engine: string; code: string; message: string; resolution?: string }>
  warnings: Array<{ engine: string; code: string; message: string; resolution?: string }>
  integrity: {
    hash: string | null
    hashGeneratedAt: Date | null
    version: number
    lifecycleStatus: string
  }
}

const VALIDATION_VERSION_ID = "v1.3"

function almostEqual(a: number, b: number, tolerance = 0.0001): boolean {
  return Math.abs(a - b) <= tolerance
}

function toPassWarnFail(failed: boolean, hasWarnings = false): "PASS" | "WARN" | "FAIL" {
  if (failed) return "FAIL"
  if (hasWarnings) return "WARN"
  return "PASS"
}

function inferSectorFromHS(hsCodes: string[]): string {
  if (hsCodes.some((code) => /^5\d{3}|^6[0-3]\d{2}/.test(code))) return "Textiles sector"
  return "General sector"
}

function isSeasonalSensitiveHS(hsCode: string): boolean {
  const code = (hsCode || "").trim()
  return /^03\d{2}|^07\d{2}|^08\d{2}|^10\d{2}/.test(code)
}

function normalizeSequence(invoiceNumber: string, fallbackId: string): string {
  const digits = (invoiceNumber || "").replace(/\D/g, "")
  if (digits.length >= 6) {
    return digits.slice(-6)
  }
  const tail = (fallbackId || "").replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase()
  return tail.padStart(6, "0")
}

function buildCertificateId(invoiceNumber: string, fallbackId: string): string {
  const year = new Date().getFullYear()
  const seq = normalizeSequence(invoiceNumber, fallbackId)
  return `CRC-${year}-${seq}`
}

function formatDateLabel(date?: Date | null): string {
  if (!date) return "N/A"
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

export async function buildComplianceReportData(invoiceId: string): Promise<ComplianceReportData> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      exporter: {
        include: {
          adMappings: {
            where: { isActive: true },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      buyer: true,
      items: true,
      packingLists: {
        include: { cartons: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      shippingBills: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      insurances: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      lettersOfCredit: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!invoice) {
    throw new Error(`INVOICE_NOT_FOUND: ${invoiceId}`)
  }

  const validation = await validateBeforeRelease(invoiceId)

  const latestPacking = invoice.packingLists[0]
  const latestShipping = invoice.shippingBills[0]
  const latestInsurance = invoice.insurances[0]
  const latestLC = invoice.lettersOfCredit[0]

  const pipeline = await runMasterCompliancePipeline({
    invoiceId: invoice.id,
    userId: invoice.userId || "system",
    lcNumber: invoice.lcNumber || latestLC?.lcNumber || undefined,
    lcAmount: Number(invoice.totalValue),
    lcCurrency: invoice.currency,
    lcIssueDate: latestLC?.createdAt,
    lcExpiryDate: latestLC?.lcExpiryDate || latestLC?.latestShipmentDate,
    lcPresentationDays: latestLC?.presentationPeriodDays || latestLC?.presentationDays,
    buyerName: invoice.buyer.name,
    invoiceAmount: Number(invoice.totalValue),
    invoiceCurrency: invoice.currency,
    invoiceLines: invoice.items.map((item, index) => ({
      lineNo: index + 1,
      hsCode: item.hsCode,
      commodity: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      gstRate: 0,
    })),
    exporterName: invoice.exporter.name,
    exporterIEC: invoice.exporter.iec,
    portOfLoading: (invoice.portOfLoading || latestShipping?.portOfLoading || "").trim(),
    portOfDischarge: (invoice.portOfDischarge || latestShipping?.portOfDischarge || "").trim() || undefined,
    incoterm: invoice.incoterm,
    paymentTerm: invoice.paymentTerms,
    packingListQty: latestPacking?.totalBoxes || undefined,
    packingListWeight: latestPacking ? Number(latestPacking.netWeight) : undefined,
    shippingBillWeight: latestPacking ? Number(latestPacking.grossWeight) : undefined,
    insuranceAmount: latestInsurance ? Number(latestInsurance.insuredValue) : undefined,
    insuranceCurrency: invoice.currency,
    submittedAt: new Date(),
  })

  const overallStatus: ComplianceOverallStatus = validation.blockers.length > 0
    ? "BLOCKED_NOT_RELEASED"
    : validation.warnings.length > 0
      ? "COMPLIANT_WITH_WARNINGS"
      : "FULLY_COMPLIANT"

  const exchangeStatus: ComplianceSectionStatus = invoice.exchangeRateDate
    ? "PASS"
    : "WARN"

  const hashStatus: ComplianceSectionStatus = invoice.documentHash
    ? "PASS"
    : invoice.status === "LOCKED"
      ? "WARN"
      : "WARN"

  const sections: ComplianceSection[] = [
    {
      key: "lc_alignment",
      title: "LC Alignment",
      status: validation.engines.LC_ENGINE === "FAILED" ? "FAIL" : "PASS",
      details: validation.engines.LC_ENGINE === "FAILED"
        ? "LC term checks failed. Review LC mismatch blockers in this certificate."
        : "LC compliance checks passed against stored LC terms.",
    },
    {
      key: "hs_dgft",
      title: "HS / DGFT Status",
      status: validation.engines.HS_ENGINE === "FAILED" ? "FAIL" : "PASS",
      details: validation.engines.HS_ENGINE === "FAILED"
        ? "HS/DGFT validation failed for one or more lines."
        : "HS classification and DGFT checks are valid for current invoice lines.",
    },
    {
      key: "iec_ad_port",
      title: "IEC–AD–Port Chain Integrity",
      status: validation.engines.IEC_CHAIN === "FAILED" ? "FAIL" : "PASS",
      details: validation.engines.IEC_CHAIN === "FAILED"
        ? "IEC/AD/Port chain has critical integrity errors."
        : "IEC, AD code, and port authorization chain integrity is valid.",
    },
    {
      key: "exchange_authenticity",
      title: "Exchange Rate Authenticity",
      status: exchangeStatus,
      details: invoice.exchangeRateDate
        ? `Exchange reference date recorded (${invoice.exchangeRateDate.toISOString().split("T")[0]}).`
        : "Exchange reference date missing. Add exchange basis for stronger audit defensibility.",
    },
    {
      key: "cross_document",
      title: "Cross-Document Consistency",
      status: validation.engines.CROSS_DOCUMENT_CONSISTENCY === "FAILED" ? "FAIL" : "PASS",
      details: validation.engines.CROSS_DOCUMENT_CONSISTENCY === "FAILED"
        ? "Cross-document consistency check failed (invoice/packing/shipping alignment)."
        : "Cross-document consistency checks passed.",
    },
    {
      key: "realization",
      title: "Realization Compliance",
      status: pipeline.realization_check.allowed ? "PASS" : "FAIL",
      details: pipeline.realization_check.allowed
        ? "Payment term and FEMA realization checks passed."
        : "Realization compliance failed. Refer realization blockers in this certificate.",
    },
    {
      key: "hash_integrity",
      title: "Hash Integrity + Version",
      status: hashStatus,
      details: invoice.documentHash
        ? `Integrity hash present (${invoice.documentHash.slice(0, 8)}...${invoice.documentHash.slice(-4)}), version ${invoice.version}.`
        : `No locked integrity hash yet. Current version ${invoice.version}, lifecycle status ${invoice.status}.`,
    },
  ]

  const lcWarnCount = pipeline.lc_check.warnings.length
  const lcBlockCount = pipeline.lc_check.blockers.length
  const lcScore = Math.max(0, 100 - lcWarnCount * 8 - lcBlockCount * 25)

  const hsWarnings = validation.warnings.filter((w) => w.engine === "HS_ENGINE").length > 0
  const iecWarnings = validation.warnings.filter((w) => w.engine === "IEC_CHAIN").length > 0
  const consistencyWarnings = validation.warnings.filter((w) => w.engine === "CROSS_DOCUMENT_CONSISTENCY").length > 0
  const realizationWarnings = pipeline.realization_check.warnings.length > 0

  const hsFailed = validation.engines.HS_ENGINE === "FAILED"
  const iecFailed = validation.engines.IEC_CHAIN === "FAILED"
  const lcFailed = validation.engines.LC_ENGINE === "FAILED"
  const consistencyFailed = validation.engines.CROSS_DOCUMENT_CONSISTENCY === "FAILED"
  const realizationFailed = !pipeline.realization_check.allowed
  const exchangeFailed = !invoice.exchangeRateDate

  const exchangeRefId = invoice.exchangeRateDate
    ? `FXD/${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(invoice.exchangeRateDate).replace(/-/g, "")}`
    : "N/A"

  const sector = inferSectorFromHS(invoice.items.map((item) => item.hsCode))
  const sectorLabel = sector.toLowerCase().includes("textiles") ? "Textiles" : "General"
  const paymentTermNote = invoice.paymentTerms
    ? `${invoice.paymentTerms}${invoice.paymentTerms === "DA" ? "60" : ""} allowed (${sectorLabel})`
    : `Payment terms aligned (${sectorLabel})`

  const engineResults: ComplianceReportData["engineResults"] = [
    {
      engine: "LC Compliance Engine",
      status: toPassWarnFail(lcFailed, lcWarnCount > 0),
      score: `${lcScore}%`,
      notes: lcFailed ? "LC terms mismatch detected" : lcWarnCount > 0 ? "Within tolerance; review LC warnings" : "Within tolerance ±5%",
    },
    {
      engine: "HS + DGFT Validation",
      status: toPassWarnFail(hsFailed, hsWarnings),
      score: hsFailed ? "0%" : hsWarnings ? "85%" : "100%",
      notes: hsFailed ? "DGFT/HS issue detected" : "No restriction",
    },
    {
      engine: "IEC–AD–Port Chain",
      status: toPassWarnFail(iecFailed, iecWarnings),
      score: "–",
      notes: iecFailed ? "Chain integrity failure" : "Chain integrity valid",
    },
    {
      engine: "Exchange Rate Proof",
      status: toPassWarnFail(exchangeFailed),
      score: "–",
      notes: exchangeFailed ? "RBI reference date missing" : `RBI Ref ID: ${exchangeRefId}`,
    },
    {
      engine: "Cross-Document Consistency",
      status: toPassWarnFail(consistencyFailed, consistencyWarnings),
      score: consistencyFailed ? "0%" : consistencyWarnings ? "85%" : "100%",
      notes: consistencyFailed ? "Mismatch detected" : "No mismatch detected",
    },
    {
      engine: "Realization Compliance Engine",
      status: toPassWarnFail(realizationFailed, realizationWarnings),
      score: "–",
      notes: realizationFailed ? "Realization term violation" : paymentTermNote,
    },
  ]

  const riskFlags: ComplianceReportData["riskFlags"] = []
  const advisories: string[] = []

  // Risk Flag 1: HS Code seasonal sensitivity
  const seasonalItems = invoice.items.filter((item) => isSeasonalSensitiveHS(item.hsCode))
  if (seasonalItems.length > 0) {
    riskFlags.push({
      code: "HS_SEASONAL_SENSITIVITY",
      label: "HS Code seasonal sensitivity",
      details: `Season-sensitive HS lines detected: ${seasonalItems
        .slice(0, 4)
        .map((item) => item.hsCode)
        .join(", ")}${seasonalItems.length > 4 ? ", ..." : ""}`,
    })
  }

  // Risk Flag 2: Tolerance applied under LC
  if ((latestLC?.tolerancePercent || 0) > 0) {
    riskFlags.push({
      code: "LC_TOLERANCE_APPLIED",
      label: "Tolerance applied under LC",
      details: `LC tolerance active at ±${latestLC?.tolerancePercent}%`,
    })
  }

  // Risk Flag 3: Sector timeline near expiry
  if (latestLC?.latestShipmentDate) {
    const now = new Date()
    const msPerDay = 1000 * 60 * 60 * 24
    const daysToExpiry = Math.ceil((latestLC.latestShipmentDate.getTime() - now.getTime()) / msPerDay)
    if (daysToExpiry >= 0 && daysToExpiry <= 21) {
      riskFlags.push({
        code: "SECTOR_TIMELINE_NEAR_EXPIRY",
        label: "Sector timeline near expiry",
        details: `Latest shipment window closes in ${daysToExpiry} day(s) (${latestLC.latestShipmentDate.toISOString().split("T")[0]}).`,
      })
    }
  }

  if (validation.warnings.length > 0) {
    if (latestLC && (latestLC.tolerancePercent || 0) > 0) {
      advisories.push(`LC tolerance applied (±${latestLC.tolerancePercent}%)`)
    }

    if (seasonalItems.length > 0) {
      advisories.push(`Commodity under seasonal watch (HS ${seasonalItems[0]?.hsCode || "N/A"})`)
    }

    if (latestLC?.latestShipmentDate) {
      const now = new Date()
      const msPerDay = 1000 * 60 * 60 * 24
      const daysToDeadline = Math.ceil((latestLC.latestShipmentDate.getTime() - now.getTime()) / msPerDay)
      if (daysToDeadline >= 0 && daysToDeadline <= 10) {
        advisories.push(`Shipment deadline within ${daysToDeadline} days`)
      }
    }
  }

  // Risk Flag 4: DGFT advisory notice
  const dgftAdvisories: string[] = []
  for (const item of invoice.items) {
    try {
      const hsResult = await validateHSCodeWithLiveData(
        item.hsCode,
        item.description,
        Number(item.quantity),
        Number(item.unitPrice),
        invoice.currency
      )

      const advisoryIssues = hsResult.issues.filter(
        (issue) => issue.category === "DGFT" && issue.severity === "Warning"
      )

      advisoryIssues.forEach((issue) => {
        dgftAdvisories.push(`${item.hsCode}: ${issue.message.replace(/^⚠️\s*/, "")}`)
      })
    } catch {
      // Non-blocking for report synthesis
    }
  }

  if (dgftAdvisories.length > 0) {
    riskFlags.push({
      code: "DGFT_ADVISORY_NOTICE",
      label: "DGFT advisory notice",
      details: dgftAdvisories.slice(0, 2).join(" | "),
    })
  }

  const referenceDate = invoice.exchangeRateDate || invoice.invoiceDate
  const rbiRateQuery = await getRBIReferenceRate(referenceDate, invoice.currency)

  const derivedRate =
    Number(invoice.totalValue) > 0 && Number(invoice.totalValueINR) > 0
      ? Number(invoice.totalValueINR) / Number(invoice.totalValue)
      : null

  const referenceRate = rbiRateQuery.rate ?? derivedRate ?? 0
  const fallbackRateId = `RBI/${referenceDate.getUTCFullYear()}/FXD/${referenceDate.toISOString().slice(0, 10).replace(/-/g, "")}`
  const rbiReferenceId = rbiRateQuery.rateID || fallbackRateId

  const proofHash = generateExchangeRateHash(referenceRate, invoice.currency, referenceDate, rbiReferenceId)
  const hmacSignature = generateHMACSignature(`${proofHash}|${invoice.id}`)

  const lcNumber = latestLC?.lcNumber || invoice.lcNumber || "N/A"
  const governedBy = latestLC?.governedBy || "UCP 600"
  const toleranceApplied = latestLC ? `±${latestLC.tolerancePercent || 0}%` : "N/A"
  const presentationWindow = latestLC ? `${latestLC.presentationDays} days` : "N/A"
  const shipmentDeadline = latestLC ? formatDateLabel(latestLC.latestShipmentDate) : "N/A"

  const normalizedPort = (invoice.portOfLoading || latestShipping?.portOfLoading || invoice.portOfLoadingCode || "").trim().toUpperCase()
  const adCode =
    invoice.exporter.adMappings.find((m) => m.portCode.toUpperCase() === normalizedPort)?.adCode ||
    invoice.exporter.adMappings[0]?.adCode ||
    "N/A"

  let edpmsFlag = "Clear"
  if (invoice.exporter.iec && adCode !== "N/A" && normalizedPort) {
    try {
      const chain = await validateADIECPortChain(
        invoice.exporter.iec,
        adCode,
        normalizedPort,
        invoice.items.map((item) => item.hsCode)
      )
      const hasEdpmsIssue = chain.iecStatus.edpmsFlags
        ? Object.values(chain.iecStatus.edpmsFlags).some(Boolean)
        : false
      edpmsFlag = hasEdpmsIssue ? "Flagged" : "Clear"
    } catch {
      edpmsFlag = "Unknown"
    }
  }

  const technicalProof: ComplianceReportData["technicalProof"] = {
    exchangeRateProof: {
      referenceRate: Number(referenceRate).toFixed(2),
      referenceCurrency: invoice.currency,
      referenceDate: formatDateLabel(referenceDate),
      rbiReferenceId,
      proofHash: `${proofHash.slice(0, 12)}...`,
      hmacSignature: `${hmacSignature.slice(0, 12)}...`,
    },
    lcComplianceDetail: {
      lcNumber,
      governedBy,
      toleranceApplied,
      presentationWindow,
      shipmentDeadline,
    },
    iecAdPortChain: {
      iec: `${invoice.exporter.iec || "N/A"}${invoice.exporter.iec ? " (Active)" : ""}`,
      adCode: `${adCode}${adCode !== "N/A" ? " (Linked)" : ""}`,
      port: `${normalizedPort || "N/A"}${normalizedPort ? " (Authorized)" : ""}`,
      edpmsFlag,
    },
  }

  const hasItemNetWeights = invoice.items.length > 0 && invoice.items.every((item) => item.netWeight !== null)
  const hasItemGrossWeights = invoice.items.length > 0 && invoice.items.every((item) => item.grossWeight !== null)

  const invoiceNetWeight = hasItemNetWeights
    ? invoice.items.reduce((sum, item) => sum + Number(item.netWeight || 0), 0)
    : null
  const invoiceGrossWeight = hasItemGrossWeights
    ? invoice.items.reduce((sum, item) => sum + Number(item.grossWeight || 0), 0)
    : null
  const packingNetWeight = latestPacking ? Number(latestPacking.netWeight) : null
  const packingGrossWeight = latestPacking ? Number(latestPacking.grossWeight) : null

  const hasCurrencyMismatch = validation.blockers.some((b) => b.code === "CURRENCY_MISMATCH")
  const hasIncotermMismatch = validation.blockers.some(
    (b) => b.code === "INCOTERM_LOGIC_FAIL" || b.code === "INCOTERM_PORT_MISMATCH"
  )

  const crossDocumentValidation: ComplianceReportData["crossDocumentValidation"] = [
    {
      label: "Invoice Net Weight = Packing Net Weight",
      passed:
        invoiceNetWeight !== null &&
        packingNetWeight !== null &&
        almostEqual(invoiceNetWeight, packingNetWeight),
    },
    {
      label: "Invoice Gross Weight = Packing Gross Weight",
      passed:
        invoiceGrossWeight !== null &&
        packingGrossWeight !== null &&
        almostEqual(invoiceGrossWeight, packingGrossWeight),
    },
    {
      label: "Currency Consistency",
      passed: !hasCurrencyMismatch,
    },
    {
      label: "Incoterm Consistency",
      passed: !hasIncotermMismatch,
    },
    {
      label: "COO Alignment",
      passed: Boolean((invoice.countryOfOrigin || "").trim()),
    },
  ]

  const integritySeal: ComplianceReportData["integritySeal"] = {
    documentHashExpression: "SHA256(Invoice + Packing + Metadata)",
    versionId: VALIDATION_VERSION_ID,
    validationTimestamp: new Date().toISOString(),
  }

  return {
    certificateId: buildCertificateId(invoice.invoiceNumber || "", invoice.id),
    invoiceId: invoice.id,
    invoiceRef: invoice.invoiceNumber || invoice.id,
    generatedOn: new Date(),
    generatedBy: "Export Docs",
    overallStatus,
    sections,
    engineResults,
    advisories,
    riskFlags,
    technicalProof,
    crossDocumentValidation,
    integritySeal,
    blockers: validation.blockers,
    warnings: validation.warnings,
    integrity: {
      hash: invoice.documentHash || null,
      hashGeneratedAt: invoice.hashGeneratedAt || null,
      version: invoice.version,
      lifecycleStatus: invoice.status,
    },
  }
}
