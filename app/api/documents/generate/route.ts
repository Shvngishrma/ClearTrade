import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { checkUsage, incrementUsage } from "@/lib/usage"
import { getCurrentUser } from "@/lib/auth"
import { validateInvoice } from "@/lib/validate"
import { calculateInvoiceTotals } from "@/lib/calculations"
import { validateInvoicePackingAlignment } from "@/lib/documentConsistencyEngine"
import { runMasterCompliancePipeline, canGenerateDocuments, getAllBlockers } from "@/lib/masterCompliancePipeline"
import { initializeInvoiceLifecycle } from "@/lib/documentLifecycle"

const DEFAULT_EXCHANGE_RATES = {
  USD: 83.5,
  EUR: 91.2,
  GBP: 105.8,
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    const usage = await checkUsage()
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return new Response("Unauthorized", { status: 401 })
    }

    if (err.message === "FREE_LIMIT_EXCEEDED") {
      return new Response(
        JSON.stringify({ error: "FREE_LIMIT_EXCEEDED", message: "You have reached the free tier limit. Please upgrade to continue." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      )
    }
    
    throw err
  }

  try {
    const {
      selectedDocs,
      sharedDetails,
      items,
      docDetails,
    } = await req.json()

    const normalizedInvoiceNumber = (sharedDetails?.invoiceNumber || "").trim().toUpperCase()
    const normalizedInvoiceDate = sharedDetails?.invoiceDate ? new Date(sharedDetails.invoiceDate) : new Date()
    const normalizedCountryOfOrigin = (sharedDetails?.countryOfOrigin || "").trim()
    const normalizedVesselOrFlightNumber = (sharedDetails?.vesselOrFlightNumber || "").trim()
    const normalizedBlOrAwbNumber = (sharedDetails?.blOrAwbNumber || "").trim()
    const normalizedContainerNumber = (sharedDetails?.containerNumber || "").trim()
    const normalizedMarksAndNumbers = (sharedDetails?.marksAndNumbers || "").trim()

    const requiresPackingList = Array.isArray(selectedDocs) && selectedDocs.includes("packingList")
    const rawCartons = Array.isArray(docDetails?.packingList?.cartons)
      ? docDetails.packingList.cartons
      : []

    let computedPackingList:
      | {
          cartons: Array<{
            cartonNumber: number
            marks: string | null
            lengthCm: number | null
            widthCm: number | null
            heightCm: number | null
            netWeightKg: number
            grossWeightKg: number
            cbm: number | null
          }>
          totalBoxes: number
          totalQuantity: number
          totalNetWeight: number
          totalGrossWeight: number
          totalCBM: number
        }
      | null = null

    if (requiresPackingList) {
      if (rawCartons.length === 0) {
        return new NextResponse(
          JSON.stringify({
            error: "VALIDATION_ERROR",
            message: "Packing List requires carton-level rows. Add at least one carton.",
            errors: [
              {
                field: "docDetails.packingList.cartons",
                message: "At least one carton row is required for packing list generation.",
              },
            ],
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      }

      let normalizedCartons: Array<{
        cartonNumber: number
        marks: string | null
        lengthCm: number | null
        widthCm: number | null
        heightCm: number | null
        quantity: number
        netWeightKg: number
        grossWeightKg: number
        cbm: number | null
      }> = []

      try {
        normalizedCartons = rawCartons.map((carton: any, index: number) => {
          const cartonNumber = Number.isFinite(Number(carton?.cartonNumber))
            ? Math.trunc(Number(carton.cartonNumber))
            : index + 1

          const netWeightKg = Number(carton?.netWeightKg)
          const grossWeightKg = Number(carton?.grossWeightKg)
          const quantity = Number(carton?.quantity)
          const lengthCm = carton?.lengthCm !== undefined && carton?.lengthCm !== "" ? Number(carton.lengthCm) : null
          const widthCm = carton?.widthCm !== undefined && carton?.widthCm !== "" ? Number(carton.widthCm) : null
          const heightCm = carton?.heightCm !== undefined && carton?.heightCm !== "" ? Number(carton.heightCm) : null

          if (!Number.isFinite(quantity) || quantity <= 0 || Math.trunc(quantity) !== quantity) {
            throw new Error(`Carton ${index + 1}: quantity must be a positive integer`)
          }

          if (!Number.isFinite(netWeightKg) || netWeightKg <= 0) {
            throw new Error(`Carton ${index + 1}: netWeightKg must be a positive number`)
          }

          if (!Number.isFinite(grossWeightKg) || grossWeightKg <= 0) {
            throw new Error(`Carton ${index + 1}: grossWeightKg must be a positive number`)
          }

          if (
            (lengthCm !== null && (!Number.isFinite(lengthCm) || lengthCm <= 0)) ||
            (widthCm !== null && (!Number.isFinite(widthCm) || widthCm <= 0)) ||
            (heightCm !== null && (!Number.isFinite(heightCm) || heightCm <= 0))
          ) {
            throw new Error(`Carton ${index + 1}: lengthCm/widthCm/heightCm must be positive numbers when provided`)
          }

          const computedCbm =
            lengthCm !== null && widthCm !== null && heightCm !== null
              ? Number(((lengthCm * widthCm * heightCm) / 1_000_000).toFixed(6))
              : null

          return {
            cartonNumber,
            marks: carton?.marks ? String(carton.marks).trim() || null : null,
            lengthCm,
            widthCm,
            heightCm,
            quantity,
            netWeightKg: Number(netWeightKg.toFixed(3)),
            grossWeightKg: Number(grossWeightKg.toFixed(3)),
            cbm: computedCbm,
          }
        })
      } catch (cartonValidationError: any) {
        return new NextResponse(
          JSON.stringify({
            error: "VALIDATION_ERROR",
            message: cartonValidationError?.message || "Invalid carton data",
            errors: [
              {
                field: "docDetails.packingList.cartons",
                message: cartonValidationError?.message || "Invalid carton data",
              },
            ],
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      }

      const totalNetWeight = Number(
        normalizedCartons.reduce((sum, carton) => sum + carton.netWeightKg, 0).toFixed(3)
      )
      const totalQuantity = normalizedCartons.reduce((sum, carton) => sum + carton.quantity, 0)
      const totalGrossWeight = Number(
        normalizedCartons.reduce((sum, carton) => sum + carton.grossWeightKg, 0).toFixed(3)
      )
      const totalCBM = Number(
        normalizedCartons.reduce((sum, carton) => sum + (carton.cbm || 0), 0).toFixed(6)
      )

      const cartonsWithInvalidCBM = normalizedCartons.filter((carton) => !carton.cbm || carton.cbm <= 0)
      if (cartonsWithInvalidCBM.length > 0) {
        return new NextResponse(
          JSON.stringify({
            error: "VALIDATION_ERROR",
            message: "Each carton must have valid dimensions that produce a positive CBM.",
            errors: [
              {
                field: "docDetails.packingList.cartons",
                message: "CBM cannot be zero or negative. Provide positive L × W × H for every carton.",
              },
            ],
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      }

      if (totalCBM <= 0) {
        return new NextResponse(
          JSON.stringify({
            error: "VALIDATION_ERROR",
            message: "Packing list consistency validation failed.",
            errors: [
              {
                field: "docDetails.packingList.cartons",
                message: "Computed totalCBM must be greater than zero.",
              },
            ],
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      }

      computedPackingList = {
        cartons: normalizedCartons,
        totalBoxes: normalizedCartons.length,
        totalQuantity,
        totalNetWeight,
        totalGrossWeight,
        totalCBM,
      }
    }

    console.log("[documents/generate] Before validation", {
      invoiceNumber: sharedDetails?.invoiceNumber,
      selectedDocsCount: Array.isArray(selectedDocs) ? selectedDocs.length : 0,
      itemsCount: Array.isArray(items) ? items.length : 0,
      currency: sharedDetails?.currency,
      incoterm: sharedDetails?.incoterm,
    })

    // 0️⃣ Validate Invoice Data - BULLETPROOF VERSION
    const validationErrors = await validateInvoice({
      invoiceNumber: normalizedInvoiceNumber,
      invoiceDate: normalizedInvoiceDate,
      paymentTerms: sharedDetails.paymentTerms,
      currency: sharedDetails.currency,
      incoterm: sharedDetails.incoterm,
      lcNumber: docDetails.lc?.lcNumber,
      portOfLoading: sharedDetails.portOfLoading,
      portOfDischarge: sharedDetails.portOfDischarge,
      countryOfOrigin: normalizedCountryOfOrigin,
      finalDestination: sharedDetails.finalDestination,
      modeOfTransport: sharedDetails.modeOfTransport,
      freight: sharedDetails.freight ? parseFloat(sharedDetails.freight) : 0,
      insurance: sharedDetails.insurance ? parseFloat(sharedDetails.insurance) : 0,
      exchangeRateDate: sharedDetails.exchangeRateDate ? new Date(sharedDetails.exchangeRateDate) : new Date(),
      items: items.map((i: any) => ({
        description: i.description,
        hsCode: i.hsCode,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
      })),
      totalValue: items.reduce(
        (sum: number, i: any) => sum + Number(i.quantity) * Number(i.unitPrice),
        0
      ),
      // exporterId will be set after exporter creation for next request validation
    })

    console.log("[documents/generate] After validation", {
      validationErrorCount: validationErrors.length,
      validationErrors,
    })

    if (validationErrors.length > 0) {
      const firstValidationError = validationErrors[0]
      const detailedMessage = firstValidationError
        ? `${firstValidationError.field}: ${firstValidationError.message}`
        : "Invoice validation failed"

      return new NextResponse(
        JSON.stringify({
          error: "VALIDATION_ERROR",
          message: detailedMessage,
          errors: validationErrors,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

  // 🔒 RUN MASTER COMPLIANCE PIPELINE
  // THIS IS THE ENFORCEMENT GATE - NO DOCUMENTS WITHOUT FULL APPROVAL
  const pipelineResult = await runMasterCompliancePipeline({
    invoiceId: normalizedInvoiceNumber,
    userId: user.id,
    
    // LC data
    lcNumber: docDetails.lc?.lcNumber,
    lcAmount: docDetails.lc?.lcAmount,
    lcCurrency: docDetails.lc?.lcCurrency || sharedDetails.currency,
    lcIssueDate: docDetails.lc?.lcIssueDate ? new Date(docDetails.lc.lcIssueDate) : undefined,
    lcExpiryDate: docDetails.lc?.lcExpiryDate ? new Date(docDetails.lc.lcExpiryDate) : undefined,
    lcPresentationDays: docDetails.lc?.presentationDays || 45,
    
    // Invoice data
    buyerName: sharedDetails.buyerName,
    buyerEmail: sharedDetails.buyerEmail,
    invoiceAmount: items.reduce((sum: number, i: any) => sum + Number(i.quantity) * Number(i.unitPrice), 0),
    invoiceCurrency: sharedDetails.currency,
    invoiceLines: items.map((i: any) => ({
      lineNo: i.lineNo || 1,
      hsCode: i.hsCode,
      commodity: i.description,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      gstRate: i.gstRate
    })),
    
    // Shipping data
    exporterName: sharedDetails.exporterName,
    exporterIEC: sharedDetails.exporterIEC,
    portOfLoading: sharedDetails.portOfLoading || docDetails.shippingBill?.portOfLoading || "",
    portOfDischarge: sharedDetails.portOfDischarge || docDetails.shippingBill?.portOfDischarge,
    incoterm: sharedDetails.incoterm || "FOB",
    paymentTerm: sharedDetails.paymentTerms || "Advance",
    
    // Document data
    packingListQty: computedPackingList?.totalBoxes,
    packingListWeight: computedPackingList?.totalNetWeight,
    shippingBillWeight: computedPackingList?.totalGrossWeight,
    
    // Insurance data
    insuranceAmount: docDetails.insurance?.insuredValue ? parseFloat(docDetails.insurance.insuredValue) : undefined,
    insuranceCurrency: sharedDetails.currency,
    
    // Timestamp
    submittedAt: new Date()
  })

  // 🔒 COMPLIANCE CHECK: Block if pipeline failed
  if (!canGenerateDocuments(pipelineResult)) {
    const blockers = getAllBlockers(pipelineResult)
    
    console.error(`\n🔒 DOCUMENT GENERATION BLOCKED BY COMPLIANCE PIPELINE`)
    console.error(`   Invoice: ${sharedDetails.invoiceNumber}`)
    console.error(`   Blockers: ${JSON.stringify(blockers.map(b => b.code), null, 2)}`)

    return new NextResponse(
      JSON.stringify({
        error: "COMPLIANCE_FAILED",
        message: "Compliance pipeline validation failed - document generation blocked",
        statusCode: 400,
        pipelineAllowed: false,
        blockers: blockers,
        fatalIssues: pipelineResult.fatalBlockers,
        pipeline: {
          lc_check: pipelineResult.lc_check.blockers.length > 0 ? "FAILED" : "PASSED",
          trade_check: pipelineResult.trade_check.blockers.length > 0 ? "FAILED" : "PASSED",
          port_check: pipelineResult.port_check.blockers.length > 0 ? "FAILED" : "PASSED",
          realization_check: pipelineResult.realization_check.blockers.length > 0 ? "FAILED" : "PASSED",
          consistency_check: pipelineResult.consistency_check.blockers.length > 0 ? "FAILED" : "PASSED",
          executionTime: pipelineResult.executionTime
        },
        auditLog: pipelineResult.auditLog
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  console.log(`\n✅ COMPLIANCE PIPELINE PASSED - PROCEEDING WITH DOCUMENT GENERATION`)
  console.log(`   All 5 enforcement engines approved: LC, Trade, Port, Realization, Consistency\n`)
  // 1️⃣ Create Exporter
  const exporter = await prisma.exporter.create({
    data: {
      name: sharedDetails.exporterName,
      address: sharedDetails.exporterAddress,
      iec: sharedDetails.exporterIEC,
      gstin: sharedDetails.exporterGSTIN,
      gstType: sharedDetails.gstType || "registered", // Default to registered
    } as any,
  })

  const normalizedLoadingPort = (sharedDetails.portOfLoading || "").trim().toUpperCase()
  const normalizedIEC = (sharedDetails.exporterIEC || "").trim()

  const adCandidatesByIEC: Record<string, string[]> = {
    "0123456788": ["AD0001", "AD0002", "AD0005"],
    "0123456789": ["AD0003"],
  }

  const adCandidatesByPort: Record<string, string[]> = {
    INMAA: ["AD0001", "AD0005", "AD0002"],
    INMAA1: ["AD0001", "AD0005", "AD0002"],
    INMCT: ["AD0001", "AD0005"],
    INMCT1: ["AD0001", "AD0005"],
    INBOM: ["AD0002", "AD0005"],
    INBOM1: ["AD0002", "AD0005"],
    INDEL: ["AD0002"],
    INDEL1: ["AD0002"],
    INKOL: ["AD0005"],
    INKOL1: ["AD0005"],
  }

  const preferredByIEC = adCandidatesByIEC[normalizedIEC] || []
  const preferredByPort = adCandidatesByPort[normalizedLoadingPort] || []

  let resolvedAdCode = preferredByIEC.find((code) => preferredByPort.includes(code))

  if (!resolvedAdCode && preferredByIEC.length > 0) {
    resolvedAdCode = preferredByIEC[0]
  }

  if (!resolvedAdCode && preferredByPort.length > 0) {
    resolvedAdCode = preferredByPort[0]
  }

  if (!resolvedAdCode) {
    resolvedAdCode = "AD0001"
  }

  if (normalizedLoadingPort) {
    await prisma.exporterADMapping.create({
      data: {
        exporterId: exporter.id,
        adCode: resolvedAdCode,
        portCode: normalizedLoadingPort,
        isActive: true,
      },
    })
  }

  // 2️⃣ Create Buyer
  const buyer = await prisma.buyer.create({
    data: {
      name: sharedDetails.buyerName,
      address: sharedDetails.buyerAddress,
      country: sharedDetails.buyerCountry,
    } as any,
  })

  // 3️⃣ Auto Calculation Engine
  const calculations = calculateInvoiceTotals(
    items.map((i: any) => ({
      description: i.description,
      hsCode: i.hsCode,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
    })),
    sharedDetails.incoterm,
    sharedDetails.freight ? parseFloat(sharedDetails.freight) : 0,
    sharedDetails.insurance ? parseFloat(sharedDetails.insurance) : 0,
    sharedDetails.currency,
    sharedDetails.exchangeRateDate ? new Date(sharedDetails.exchangeRateDate) : new Date()
  )

    const incrementInvoiceNumber = (invoiceNumber: string) => {
      const match = invoiceNumber.match(/^INV\/(\d{4})\/(\d{4})$/)
      if (!match) return invoiceNumber
      const year = match[1]
      const sequence = Number(match[2])
      const nextSequence = (sequence % 10000) + 1
      return `INV/${year}/${String(nextSequence).padStart(4, "0")}`
    }

    let invoiceNumberToUse = normalizedInvoiceNumber
    const invoiceNumberMatch = normalizedInvoiceNumber.match(/^INV\/(\d{4})\/(\d{4})$/)

    if (invoiceNumberMatch) {
      const year = invoiceNumberMatch[1]
      const startingSequence = Number(invoiceNumberMatch[2])

      for (let offset = 0; offset < 10000; offset += 1) {
        const nextSequence = ((startingSequence - 1 + offset) % 10000) + 1
        const candidate = `INV/${year}/${String(nextSequence).padStart(4, "0")}`
        const existing = await prisma.invoice.findUnique({
          where: { invoiceNumber: candidate },
          select: { id: true },
        })

        if (!existing) {
          invoiceNumberToUse = candidate
          break
        }
      }
    }

    console.log("[documents/generate] Before prisma.invoice.create", {
      userId: user.id,
      invoiceNumber: invoiceNumberToUse,
      invoiceDate: normalizedInvoiceDate,
      exporterId: exporter.id,
      buyerId: buyer.id,
      itemCount: items.length,
      currency: sharedDetails.currency,
      incoterm: sharedDetails.incoterm,
      totals: {
        totalValue: calculations.totalValue,
        fobValue: calculations.fobValue,
        cifValue: calculations.cifValue,
        totalValueINR: calculations.totalValueINR,
      },
    })

    let invoice: any = null
    let createAttemptNumber = invoiceNumberToUse

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        invoice = await prisma.invoice.create({
          data: {
            invoiceNumber: createAttemptNumber,
            invoiceDate: normalizedInvoiceDate,
            status: "DRAFT",
            version: 1,
            userId: user.id,
            incoterm: sharedDetails.incoterm,
            currency: sharedDetails.currency,
            paymentTerms: sharedDetails.paymentTerms || "Advance",
            portOfLoading: sharedDetails.portOfLoading || docDetails.shippingBill?.portOfLoading || "",
            portOfDischarge: sharedDetails.portOfDischarge || docDetails.shippingBill?.portOfDischarge || "",
            countryOfOrigin: normalizedCountryOfOrigin,
            finalDestination: sharedDetails.finalDestination || sharedDetails.buyerCountry || "",
            modeOfTransport: sharedDetails.modeOfTransport || "Sea",
            vesselOrFlightNumber: normalizedVesselOrFlightNumber || null,
            containerNumber: normalizedContainerNumber || null,
            marksAndNumbers: normalizedMarksAndNumbers || null,
            blNumber: normalizedBlOrAwbNumber || null,
            awbNumber: normalizedBlOrAwbNumber || null,
            freight: calculations.freight,
            insurance: calculations.insurance,
            fobValue: calculations.fobValue,
            cifValue: calculations.cifValue,
            totalValue: calculations.totalValue,
            totalValueINR: calculations.totalValueINR,
            exchangeRateDate: sharedDetails.exchangeRateDate ? new Date(sharedDetails.exchangeRateDate) : new Date(),
            isLC: selectedDocs.includes("lc"),
            lcNumber: docDetails.lc?.lcNumber || null,
            exporterId: exporter.id,
            buyerId: buyer.id,
            items: {
              create: items.map((i: any) => ({
                description: i.description,
                hsCode: i.hsCode,
                quantity: Number(i.quantity),
                unitPrice: Number(i.unitPrice),
              })),
            },
          } as any,
        })

        break
      } catch (createError: any) {
        const isInvoiceNumberConflict =
          createError?.code === "P2002" &&
          Array.isArray(createError?.meta?.target) &&
          createError.meta.target.includes("invoiceNumber")

        if (!isInvoiceNumberConflict || attempt === 4) {
          throw createError
        }

        createAttemptNumber = incrementInvoiceNumber(createAttemptNumber)
      }
    }

    console.log("[documents/generate] After prisma.invoice.create", {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
    })

  // 4️⃣ Conditional documents
  if (selectedDocs.includes("packingList")) {
    await prisma.packingList.create({
      data: {
        invoiceId: invoice.id,
        totalBoxes: computedPackingList!.totalBoxes,
        totalQuantity: computedPackingList!.totalQuantity,
        netWeight: computedPackingList!.totalNetWeight,
        grossWeight: computedPackingList!.totalGrossWeight,
        totalCBM: computedPackingList!.totalCBM,
        cartons: {
          create: computedPackingList!.cartons as any,
        },
      } as any,
    })

    try {
      await validateInvoicePackingAlignment(invoice.id)
    } catch (alignmentError: any) {
      return NextResponse.json(
        {
          error: "DOCUMENT_MISMATCH",
          message: alignmentError?.message || "Invoice and packing list alignment failed",
          details: [alignmentError?.message || "Invoice and packing list alignment failed"],
        },
        { status: 400 }
      )
    }
  }

  if (selectedDocs.includes("shippingBill")) {
    await prisma.shippingBill.create({
      data: {
        invoiceId: invoice.id,
        portOfLoading: docDetails.shippingBill.portOfLoading,
        portOfDischarge: docDetails.shippingBill.portOfDischarge,
        cargoType: docDetails.shippingBill.cargoType,
        schemeCode: docDetails.shippingBill.schemeCode || null,
        drawback: docDetails.shippingBill.drawback || false,
      },
    })
  }

  if (selectedDocs.includes("coo")) {
    await prisma.certificateOfOrigin.create({
      data: {
        invoiceId: invoice.id,
        originCountry: docDetails.coo.originCountry,
        chamberName: docDetails.coo.chamberName,
      },
    })
  }

  if (selectedDocs.includes("insurance")) {
    await prisma.insurance.create({
      data: {
        invoiceId: invoice.id,
        policyNumber: docDetails.insurance.policyNumber,
        insuredValue: parseFloat(docDetails.insurance.insuredValue),
      },
    })
  }

  if (selectedDocs.includes("lc")) {
    await prisma.letterOfCredit.create({
      data: {
        invoiceId: invoice.id,
        lcNumber: docDetails.lc.lcNumber,
      },
    })
  }

  if (selectedDocs.includes("declaration")) {
    await prisma.declaration.create({
      data: {
        invoiceId: invoice.id,
        type: "Export Declaration",
      },
    })
  }

  const documentEntries = [
    { type: "Invoice", status: "COMPLETED", userId: user.id },
  ]

  if (selectedDocs.includes("packingList")) {
    documentEntries.push({ type: "Packing List", status: "COMPLETED", userId: user.id })
  }

  if (selectedDocs.includes("shippingBill")) {
    documentEntries.push({ type: "Shipping Bill", status: "COMPLETED", userId: user.id })
  }

  if (selectedDocs.includes("coo")) {
    documentEntries.push({ type: "Certificate of Origin", status: "COMPLETED", userId: user.id })
  }

  if (selectedDocs.includes("insurance")) {
    documentEntries.push({ type: "Insurance", status: "COMPLETED", userId: user.id })
  }

  if (selectedDocs.includes("lc")) {
    documentEntries.push({ type: "Letter of Credit", status: "COMPLETED", userId: user.id })
  }

  if (selectedDocs.includes("declaration")) {
    documentEntries.push({ type: "Declaration", status: "COMPLETED", userId: user.id })
  }

  if (documentEntries.length > 0) {
    await prisma.document.createMany({ data: documentEntries })
  }

    const invoicesToRetain = await prisma.invoice.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })

    const staleInvoiceIds = invoicesToRetain.slice(7).map((record) => record.id)

    if (staleInvoiceIds.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.item.deleteMany({ where: { invoiceId: { in: staleInvoiceIds } } })
        await tx.carton.deleteMany({ where: { packingList: { invoiceId: { in: staleInvoiceIds } } } })
        await tx.packingList.deleteMany({ where: { invoiceId: { in: staleInvoiceIds } } })
        await tx.shippingBill.deleteMany({ where: { invoiceId: { in: staleInvoiceIds } } })
        await tx.declaration.deleteMany({ where: { invoiceId: { in: staleInvoiceIds } } })
        await tx.certificateOfOrigin.deleteMany({ where: { invoiceId: { in: staleInvoiceIds } } })
        await tx.insurance.deleteMany({ where: { invoiceId: { in: staleInvoiceIds } } })
        await tx.letterOfCredit.deleteMany({ where: { invoiceId: { in: staleInvoiceIds } } })
        await tx.invoiceVersion.deleteMany({ where: { invoiceId: { in: staleInvoiceIds } } })
        await tx.invoice.deleteMany({
          where: {
            id: { in: staleInvoiceIds },
            userId: user.id,
          },
        })
      })
    }

    await initializeInvoiceLifecycle(invoice.id, user.id)

    // 3️⃣ Usage increment (ONCE)
    await incrementUsage()

    return NextResponse.json({
      invoiceId: String(invoice.id),
      status: (invoice as any).status,
      version: (invoice as any).version,
      complianceStatus: "PASSED",
      pipeline: {
        lc_check: "PASSED",
        trade_check: "PASSED",
        port_check: "PASSED",
        realization_check: "PASSED",
        consistency_check: "PASSED",
        executionTime: pipelineResult.executionTime
      },
      documents: {
        invoice: true,
        packingList: selectedDocs.includes("packingList"),
        shippingBill: selectedDocs.includes("shippingBill"),
        coo: selectedDocs.includes("coo"),
        insurance: selectedDocs.includes("insurance"),
        lc: selectedDocs.includes("lc"),
        declaration: selectedDocs.includes("declaration")
      },
      auditLog: pipelineResult.auditLog
    })
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined

    console.error("[documents/generate] CATCH ERROR", {
      message,
      name: err?.name,
      code: err?.code,
      meta: err?.meta,
      stack,
    })

    return new NextResponse(
      JSON.stringify({
        error: "GENERATION_ERROR",
        message,
        code: err?.code || null,
        details: err?.meta || null,
        stack,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
