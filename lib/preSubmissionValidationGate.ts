import { prisma } from "@/lib/db"
import { runMasterCompliancePipeline, canGenerateDocuments, getAllBlockers } from "@/lib/masterCompliancePipeline"
import { validateLCCompliance } from "@/lib/lcComplianceEngine"
import { canGeneratePDF } from "@/lib/consistencyEngine"
import { validateInvoicePackingAlignment } from "@/lib/documentConsistencyEngine"
import { markInvoiceReady } from "@/lib/documentLifecycle"

type EngineName =
  | "COMPLIANCE_ENGINE"
  | "LC_ENGINE"
  | "HS_ENGINE"
  | "IEC_CHAIN"
  | "CROSS_DOCUMENT_CONSISTENCY"

export interface ReleaseValidationIssue {
  engine: EngineName
  code: string
  message: string
  resolution?: string
}

export interface ReleaseValidationResult {
  invoiceId: string
  canRelease: boolean
  blockers: ReleaseValidationIssue[]
  warnings: ReleaseValidationIssue[]
  engines: Record<EngineName, "PASSED" | "FAILED">
}

export async function validateBeforeRelease(invoiceId: string): Promise<ReleaseValidationResult> {
  const blockers: ReleaseValidationIssue[] = []
  const warnings: ReleaseValidationIssue[] = []

  const engines: Record<EngineName, "PASSED" | "FAILED"> = {
    COMPLIANCE_ENGINE: "PASSED",
    LC_ENGINE: "PASSED",
    HS_ENGINE: "PASSED",
    IEC_CHAIN: "PASSED",
    CROSS_DOCUMENT_CONSISTENCY: "PASSED",
  }

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
    return {
      invoiceId,
      canRelease: false,
      blockers: [
        {
          engine: "COMPLIANCE_ENGINE",
          code: "INVOICE_NOT_FOUND",
          message: `Invoice not found (${invoiceId})`,
          resolution: "Use a valid invoice and retry PDF generation.",
        },
      ],
      warnings,
      engines: {
        ...engines,
        COMPLIANCE_ENGINE: "FAILED",
      },
    }
  }

  const invoiceLines = invoice.items.map((item, index) => ({
    lineNo: index + 1,
    hsCode: item.hsCode,
    commodity: item.description,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    gstRate: 0,
  }))

  const latestPacking = invoice.packingLists[0]
  const latestShipping = invoice.shippingBills[0]
  const latestInsurance = invoice.insurances[0]
  const latestLC = invoice.lettersOfCredit[0]

  // 1) Compliance engine gate
  try {
    const pipelineResult = await runMasterCompliancePipeline({
      invoiceId: invoice.id,
      userId: invoice.userId || "system",
      lcNumber: invoice.lcNumber || latestLC?.lcNumber || undefined,
      lcAmount: Number(invoice.totalValue),
      lcCurrency: invoice.currency,
      lcIssueDate: latestLC?.createdAt,
      lcExpiryDate: latestLC?.latestShipmentDate,
      lcPresentationDays: latestLC?.presentationDays,
      buyerName: invoice.buyer.name,
      invoiceAmount: Number(invoice.totalValue),
      invoiceCurrency: invoice.currency,
      invoiceLines,
      exporterName: invoice.exporter.name,
      exporterIEC: invoice.exporter.iec,
      portOfLoading: (invoice.portOfLoading || latestShipping?.portOfLoading || invoice.portOfLoadingCode || "").trim(),
      portOfDischarge: (invoice.portOfDischarge || latestShipping?.portOfDischarge || invoice.portOfDischargeCode || "").trim() || undefined,
      incoterm: invoice.incoterm,
      paymentTerm: invoice.paymentTerms,
      packingListQty: latestPacking?.totalBoxes || undefined,
      packingListWeight: latestPacking ? Number(latestPacking.netWeight) : undefined,
      shippingBillWeight: latestPacking ? Number(latestPacking.grossWeight) : undefined,
      insuranceAmount: latestInsurance ? Number(latestInsurance.insuredValue) : undefined,
      insuranceCurrency: invoice.currency,
      submittedAt: new Date(),
    })

    if (!canGenerateDocuments(pipelineResult)) {
      engines.COMPLIANCE_ENGINE = "FAILED"
      blockers.push(
        ...getAllBlockers(pipelineResult).map((b) => ({
          engine: "COMPLIANCE_ENGINE" as const,
          code: b.code,
          message: b.message,
          resolution: "Fix the compliance blocker in invoice data and regenerate.",
        }))
      )
    }
  } catch (error: any) {
    engines.COMPLIANCE_ENGINE = "FAILED"
    blockers.push({
      engine: "COMPLIANCE_ENGINE",
      code: "COMPLIANCE_GATE_ERROR",
      message: error?.message || "Compliance engine execution failed",
      resolution: "Retry. If this persists, check server logs for the compliance pipeline.",
    })
  }

  // 2) LC engine gate
  const lcRequired = invoice.paymentTerms === "LC" || invoice.isLC || Boolean(invoice.lcNumber)
  if (lcRequired) {
    if (!latestLC) {
      engines.LC_ENGINE = "FAILED"
      blockers.push({
        engine: "LC_ENGINE",
        code: "LC_TERMS_MISSING",
        message: "LC payment flow requires a stored Letter of Credit record",
        resolution: "Create LC document with terms before downloading PDF.",
      })
    } else {
      const hasLCTerms = Boolean(
        latestLC.lcDescriptionText && latestLC.lcDescriptionText.trim().length > 0
      )

      if (!hasLCTerms) {
        warnings.push({
          engine: "LC_ENGINE",
          code: "LC_TERMS_INCOMPLETE",
          message: "LC record exists but term text is missing. Strict LC matching skipped.",
          resolution: "Add full LC terms (description, shipment constraints, tolerance) for strict UCP checks.",
        })
      } else {
      try {
        const lcResult = await validateLCCompliance(
          {
            invoiceNumber: invoice.invoiceNumber,
            invoiceDate: invoice.invoiceDate,
            description: invoice.items.map((i) => i.description).join("; "),
            quantity: invoice.items.reduce((sum, i) => sum + Number(i.quantity), 0),
            shipmentDate: latestShipping?.createdAt || invoice.invoiceDate,
            isPartialShipment: false,
            currencyCode: invoice.currency,
            invoiceValue: Number(invoice.totalValue),
          },
          {
            lcNumber: latestLC.lcNumber,
            lcDescriptionText: latestLC.lcDescriptionText || "",
            latestShipmentDate: latestLC.latestShipmentDate,
            presentationDays: latestLC.presentationDays,
            partialShipmentAllowed: latestLC.partialShipmentAllowed,
            tolerancePercent: latestLC.tolerancePercent || 0,
            governedBy: latestLC.governedBy || "UCP 600",
          }
        )

        if (!lcResult.allowDocumentGeneration) {
          engines.LC_ENGINE = "FAILED"
          blockers.push(
            ...lcResult.blockers.map((b) => ({
              engine: "LC_ENGINE" as const,
              code: b.code,
              message: b.message,
              resolution: b.resolution,
            }))
          )
        }
      } catch (error: any) {
        engines.LC_ENGINE = "FAILED"
        blockers.push({
          engine: "LC_ENGINE",
          code: "LC_ENGINE_ERROR",
          message: error?.message || "LC engine execution failed",
          resolution: "Verify LC terms and retry.",
        })
      }
      }
    }
  }

  // 3) HS engine gate (structural-only)
  for (const item of invoice.items) {
    const normalizedHSCode = (item.hsCode || "").trim()
    const isHsStructurallyValid = /^\d{6}(\d{2})?$/.test(normalizedHSCode)

    if (!isHsStructurallyValid) {
      engines.HS_ENGINE = "FAILED"
      blockers.push({
        engine: "HS_ENGINE",
        code: "HS_FORMAT_INVALID",
        message: `HS code ${item.hsCode || "N/A"} is invalid. HS code must be a 6-digit or 8-digit numeric code.`,
        resolution: "Correct the HS code format and retry.",
      })
    }
  }

  // 4) IEC chain gate (structural-only)
  try {
    const normalizedPort = (invoice.portOfLoading || latestShipping?.portOfLoading || invoice.portOfLoadingCode || "")
      .trim()
      .toUpperCase()
    const normalizedIEC = (invoice.exporter.iec || "").trim()

    if (!normalizedIEC) {
      engines.IEC_CHAIN = "FAILED"
      blockers.push({
        engine: "IEC_CHAIN",
        code: "IEC_MISSING",
        message: "Exporter IEC is missing",
        resolution: "Add exporter IEC before PDF generation.",
      })
    } else if (!/^\d{10}$/.test(normalizedIEC)) {
      engines.IEC_CHAIN = "FAILED"
      blockers.push({
        engine: "IEC_CHAIN",
        code: "IEC_FORMAT_INVALID",
        message: "Invalid IEC format. IEC must be exactly 10 numeric digits.",
        resolution: "Update exporter IEC to a 10-digit numeric value.",
      })
    } else if (!normalizedPort) {
      engines.IEC_CHAIN = "FAILED"
      blockers.push({
        engine: "IEC_CHAIN",
        code: "PORT_MISSING",
        message: "Port of loading is required for IEC/AD chain validation",
        resolution: "Provide port of loading UN/LOCODE.",
      })
    } else {
      const adMapping =
        invoice.exporter.adMappings.find((m) => m.portCode.toUpperCase() === normalizedPort) ||
        invoice.exporter.adMappings[0]

      if (!adMapping?.adCode) {
        warnings.push({
          engine: "IEC_CHAIN",
          code: "AD_CODE_NOT_CONFIGURED",
          message: "No AD code mapping configured for this exporter/port. This does not block release in structural-only mode.",
          resolution: "Optionally configure AD mapping for internal traceability.",
        })
      }
    }
  } catch (error: any) {
    engines.IEC_CHAIN = "FAILED"
    blockers.push({
      engine: "IEC_CHAIN",
      code: "IEC_CHAIN_ERROR",
      message: error?.message || "IEC chain validation failed",
      resolution: "Verify IEC/AD/Port master data and retry.",
    })
  }

  // 5) Cross-document consistency gate
  try {
    await validateInvoicePackingAlignment(invoice.id)

    const invoiceQuantity = invoice.items.reduce((sum, i) => sum + Number(i.quantity), 0)
    const packingItems = latestPacking
      ? [{
          hsCode: "MIXED",
          quantity: latestPacking.totalQuantity || invoiceQuantity,
          packageType: "CARTON",
        }]
      : []

    const consistencyResult = await canGeneratePDF({
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        totalValue: Number(invoice.totalValue),
        currency: invoice.currency,
        incoterm: invoice.incoterm,
        freight: Number(invoice.freight),
        insurance: Number(invoice.insurance),
        portOfLoading: invoice.portOfLoading || "",
        portOfDischarge: invoice.portOfDischarge || "",
        items: invoice.items.map((item) => ({
          hsCode: item.hsCode,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      },
      packingList: latestPacking
        ? {
            id: latestPacking.id,
            totalBoxes: latestPacking.totalBoxes,
            netWeight: Number(latestPacking.netWeight),
            grossWeight: Number(latestPacking.grossWeight),
            items: packingItems,
          }
        : undefined,
      shippingBill: latestShipping
        ? {
            id: latestShipping.id,
            portOfLoading: latestShipping.portOfLoading,
            portOfDischarge: latestShipping.portOfDischarge,
            cargoType: latestShipping.cargoType,
            schemeCode: latestShipping.schemeCode || undefined,
          }
        : undefined,
      insurance: latestInsurance
        ? {
            id: latestInsurance.id,
            insuredValue: Number(latestInsurance.insuredValue),
            policyNumber: latestInsurance.policyNumber,
          }
        : undefined,
    })

    if (!consistencyResult.allowed) {
      engines.CROSS_DOCUMENT_CONSISTENCY = "FAILED"
      blockers.push(
        ...consistencyResult.blockers.map((b) => ({
          engine: "CROSS_DOCUMENT_CONSISTENCY" as const,
          code: b.code,
          message: b.message,
          resolution: "Fix cross-document mismatch and regenerate.",
        }))
      )
    }

    warnings.push(
      ...consistencyResult.warnings.map((warning) => ({
        engine: "CROSS_DOCUMENT_CONSISTENCY" as const,
        code: "CONSISTENCY_WARNING",
        message: warning,
      }))
    )
  } catch (error: any) {
    engines.CROSS_DOCUMENT_CONSISTENCY = "FAILED"
    blockers.push({
      engine: "CROSS_DOCUMENT_CONSISTENCY",
      code: "CROSS_DOCUMENT_CHECK_ERROR",
      message: error?.message || "Cross-document consistency check failed",
      resolution: "Fix document mismatches and retry PDF generation.",
    })
  }

  const canRelease = blockers.length === 0

  if (canRelease) {
    await markInvoiceReady(invoice.id)
  }

  return {
    invoiceId: invoice.id,
    canRelease,
    blockers,
    warnings,
    engines,
  }
}
