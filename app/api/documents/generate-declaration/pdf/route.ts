import { prisma } from "@/lib/db"
import { generateDeclarationPDF } from "@/lib/pdf"
import { nonRestrictedTemplate } from "@/lib/templates/nonRestricted"
import { femaAdvanceTemplate } from "@/lib/templates/femaAdvance"
import { femaLCTemplate } from "@/lib/templates/femaLC"
import { femaDocumentaryCollectionTemplate } from "@/lib/templates/femaDocumentaryCollection"
import { generateComplianceBlocks, formatDeclarationDocument } from "@/lib/complianceBlocks"
import { checkUsage, incrementUsage } from "@/lib/usage"
import { validateBeforeRelease } from "@/lib/preSubmissionValidationGate"
import { lockInvoiceOnFirstPdfDownload } from "@/lib/documentLifecycle"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const invoiceId = searchParams.get("invoiceId")
  const type = searchParams.get("type") || "fema"
  const gstType = searchParams.get("gstType") || "registered"

  if (!invoiceId) {
    return new NextResponse("Missing invoiceId", { status: 400 })
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      exporter: true,
      buyer: true,
    },
  })

  if (!invoice) {
    return new NextResponse("Invoice not found", { status: 404 })
  }

  const validation = await validateBeforeRelease(invoiceId)
  if (!validation.canRelease) {
    return NextResponse.json(
      {
        error: "PRE_SUBMISSION_VALIDATION_FAILED",
        message: "Critical validation failed. Fix issues before PDF generation.",
        blockers: validation.blockers,
        warnings: validation.warnings,
        engines: validation.engines,
      },
      { status: 400 }
    )
  }

  let renderedText: string

  // STEP 3: NEW - Compliance Blocks Engine for dynamic declarations
  if (type === "compliance") {
    const complianceBlocks = generateComplianceBlocks({
      paymentTerms: invoice.paymentTerms,
      incoterm: invoice.incoterm,
      gstType: gstType || invoice.exporter.gstType || "registered",
      lcNumber: invoice.lcNumber || undefined,
      portOfLoading: invoice.portOfLoading || undefined,
      portOfDischarge: invoice.portOfDischarge || undefined,
      currency: invoice.currency,
      exchangeRate: 83.45, // Default USD to INR, can be parameterized
    })

    renderedText = formatDeclarationDocument(
      invoice.exporter.name,
      invoice.exporter.address,
      invoice.buyer.name,
      invoice.buyer.country,
      complianceBlocks,
      new Date().toLocaleDateString(),
      ""
    )
  } else {
    // FEMA Auto Declaration Logic - Select template based on payment terms
    let template = nonRestrictedTemplate

    if (invoice.paymentTerms === "Advance") {
      template = femaAdvanceTemplate
    } else if (invoice.paymentTerms === "LC") {
      template = femaLCTemplate
    } else if (invoice.paymentTerms === "DA" || invoice.paymentTerms === "DP" || invoice.paymentTerms === "CAD") {
      template = femaDocumentaryCollectionTemplate
    } else if (type === "accuracy") {
      // template = accuracyTemplate (to be added)
    }

    // Replace variables
    renderedText = template
      .replace(/{{exporterName}}/g, invoice.exporter.name)
      .replace(/{{exporterAddress}}/g, invoice.exporter.address)
      .replace(/{{buyerName}}/g, invoice.buyer.name)
      .replace(/{{buyerCountry}}/g, invoice.buyer.country)
      .replace(/{{date}}/g, new Date().toLocaleDateString())
      .replace(/{{place}}/g, "")
  }

  const isInternalZip = req.headers.get("x-internal-zip") === "1"
  const usage = !isInternalZip ? await checkUsage() : undefined

  const pdf = await generateDeclarationPDF(renderedText, usage, invoice)

  if (!isInternalZip) {
    await incrementUsage()
  }

  await lockInvoiceOnFirstPdfDownload(invoiceId)

  return new NextResponse(pdf as any, {
    headers: { "Content-Type": "application/pdf" },
  })
}
