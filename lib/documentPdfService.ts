import { prisma } from "@/lib/db"
import {
  generateCertificateOfOriginPDF,
  generateDeclarationPDF,
  generateInsurancePDF,
  generateLetterOfCreditPDF,
  generatePackingListPDF,
  generateShippingBillPDF,
} from "@/lib/pdf"
import { generateInvoiceHTML } from "@/lib/htmlInvoiceTemplate"
import { generatePackingListHTML } from "@/lib/htmlPackingListTemplate"
import { generateShippingBillHTML } from "@/lib/htmlShippingBillTemplate"
import { generateDeclarationHTML } from "@/lib/htmlDeclarationTemplate"
import { generateCertificateOfOriginHTML } from "@/lib/htmlCertificateOfOriginTemplate"
import { generateInsuranceHTML } from "@/lib/htmlInsuranceTemplate"
import { generateLetterOfCreditHTML } from "@/lib/htmlLCTemplate"
import { validateBeforeRelease } from "@/lib/preSubmissionValidationGate"
import { nonRestrictedTemplate } from "@/lib/templates/nonRestricted"
import { femaAdvanceTemplate } from "@/lib/templates/femaAdvance"
import { femaLCTemplate } from "@/lib/templates/femaLC"
import { femaDocumentaryCollectionTemplate } from "@/lib/templates/femaDocumentaryCollection"
import { renderHtmlToPdfA4AutoScale } from "@/lib/pdfBrowser"

type GenerationOptions = {
  usage?: any
  skipValidation?: boolean
}

type DeclarationGenerationOptions = GenerationOptions & {
  type?: string
}

export class DocumentGenerationError extends Error {
  status: number
  payload: Record<string, unknown>

  constructor(status: number, payload: Record<string, unknown>) {
    super(String(payload?.message || payload?.error || "Document generation failed"))
    this.name = "DocumentGenerationError"
    this.status = status
    this.payload = payload
  }
}

function toPdfBuffer(pdfData: Uint8Array | Buffer): Uint8Array {
  return new Uint8Array(pdfData)
}

async function ensureValidation(invoiceId: string, skipValidation?: boolean) {
  if (skipValidation) {
    return
  }

  const validation = await validateBeforeRelease(invoiceId)
  if (!validation.canRelease) {
    throw new DocumentGenerationError(400, {
      error: "PRE_SUBMISSION_VALIDATION_FAILED",
      message: "Critical validation failed. Fix issues before PDF generation.",
      blockers: validation.blockers,
      warnings: validation.warnings,
      engines: validation.engines,
    })
  }
}

export async function generateInvoicePdfBuffer(invoiceId: string, options: GenerationOptions = {}): Promise<Uint8Array> {
  await ensureValidation(invoiceId, options.skipValidation)

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      exporter: true,
      buyer: true,
      items: true,
    },
  })

  if (!invoice) {
    throw new DocumentGenerationError(404, { error: "INVOICE_NOT_FOUND", message: "Invoice not found" })
  }

  try {
    const htmlContent = generateInvoiceHTML(invoice, options.usage)
    return await renderHtmlToPdfA4AutoScale(htmlContent)
  } catch (puppeteerError) {
    console.error("[documentPdfService] Invoice Puppeteer error", {
      message: puppeteerError instanceof Error ? puppeteerError.message : String(puppeteerError),
      stack: puppeteerError instanceof Error ? puppeteerError.stack : undefined,
      name: (puppeteerError as any)?.name,
      invoiceId,
    })

    throw new DocumentGenerationError(500, {
      error: "INVOICE_PDF_GENERATION_FAILED",
      message: `Invoice HTML renderer unavailable: ${puppeteerError instanceof Error ? puppeteerError.message : String(puppeteerError)}`,
    })
  }
}

export async function generatePackingListPdfBuffer(
  invoiceId: string,
  options: GenerationOptions = {}
): Promise<Uint8Array> {
  await ensureValidation(invoiceId, options.skipValidation)

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      exporter: true,
      buyer: true,
      items: true,
      packingLists: {
        include: {
          cartons: true,
        },
      },
    },
  })

  if (!invoice || !invoice.packingLists[0]) {
    throw new DocumentGenerationError(404, {
      error: "PACKING_LIST_NOT_FOUND",
      message: "Packing list not found",
    })
  }

  try {
    const htmlContent = generatePackingListHTML(invoice, invoice.packingLists[0], options.usage)
    return await renderHtmlToPdfA4AutoScale(htmlContent)
  } catch (puppeteerError) {
    console.error("[documentPdfService] Packing list Puppeteer error, falling back to pdf-lib", {
      message: puppeteerError instanceof Error ? puppeteerError.message : String(puppeteerError),
      stack: puppeteerError instanceof Error ? puppeteerError.stack : undefined,
      name: (puppeteerError as any)?.name,
      invoiceId,
    })

    const pdf = await generatePackingListPDF(invoice, invoice.packingLists[0], options.usage)
    return toPdfBuffer(pdf)
  }
}

export async function generateShippingBillPdfBuffer(
  invoiceId: string,
  options: GenerationOptions = {}
): Promise<Uint8Array> {
  await ensureValidation(invoiceId, options.skipValidation)

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
      shippingBills: true,
    },
  })

  if (!invoice || !invoice.shippingBills.length) {
    throw new DocumentGenerationError(404, {
      error: "SHIPPING_BILL_NOT_FOUND",
      message: "Shipping Bill not found",
    })
  }

  try {
    const htmlContent = generateShippingBillHTML(invoice, invoice.shippingBills[0], options.usage)
    return await renderHtmlToPdfA4AutoScale(htmlContent)
  } catch (puppeteerError) {
    console.error("[documentPdfService] Shipping bill Puppeteer error, falling back to pdf-lib", {
      message: puppeteerError instanceof Error ? puppeteerError.message : String(puppeteerError),
      stack: puppeteerError instanceof Error ? puppeteerError.stack : undefined,
      name: (puppeteerError as any)?.name,
      invoiceId,
    })

    const pdf = await generateShippingBillPDF(invoice, invoice.shippingBills[0], options.usage)
    return toPdfBuffer(pdf)
  }
}

export async function generateDeclarationPdfBuffer(
  invoiceId: string,
  options: DeclarationGenerationOptions = {}
): Promise<Uint8Array> {
  await ensureValidation(invoiceId, options.skipValidation)

  const declarationType = options.type || "fema"

  if (declarationType === "compliance") {
    throw new DocumentGenerationError(400, {
      error: "DECLARATION_TYPE_UNSUPPORTED",
      message:
        "Compliance certificate generation is only available via /api/documents/generate-compliance-report/pdf.",
    })
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      exporter: true,
      buyer: true,
    },
  })

  if (!invoice) {
    throw new DocumentGenerationError(404, { error: "INVOICE_NOT_FOUND", message: "Invoice not found" })
  }

  let template = nonRestrictedTemplate

  if (invoice.paymentTerms === "Advance") {
    template = femaAdvanceTemplate
  } else if (invoice.paymentTerms === "LC") {
    template = femaLCTemplate
  } else if (
    invoice.paymentTerms === "DA" ||
    invoice.paymentTerms === "DP" ||
    invoice.paymentTerms === "CAD"
  ) {
    template = femaDocumentaryCollectionTemplate
  } else if (declarationType === "accuracy") {
  }

  const renderedText = template
    .replace(/{{exporterName}}/g, invoice.exporter.name)
    .replace(/{{exporterAddress}}/g, invoice.exporter.address)
    .replace(/{{buyerName}}/g, invoice.buyer.name)
    .replace(/{{buyerCountry}}/g, invoice.buyer.country)
    .replace(/{{date}}/g, new Date().toLocaleDateString())
    .replace(/{{place}}/g, "")

  try {
    const htmlContent = generateDeclarationHTML(invoice)
    return await renderHtmlToPdfA4AutoScale(htmlContent)
  } catch (puppeteerError) {
    console.error("[documentPdfService] Declaration Puppeteer error, falling back to pdf-lib", {
      message: puppeteerError instanceof Error ? puppeteerError.message : String(puppeteerError),
      stack: puppeteerError instanceof Error ? puppeteerError.stack : undefined,
      name: (puppeteerError as any)?.name,
      invoiceId,
    })

    const pdf = await generateDeclarationPDF(renderedText, options.usage, invoice)
    return toPdfBuffer(pdf)
  }
}

export async function generateCertificateOfOriginPdfBuffer(
  invoiceId: string,
  options: GenerationOptions = {}
): Promise<Uint8Array> {
  await ensureValidation(invoiceId, options.skipValidation)

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      exporter: true,
      buyer: true,
      items: true,
      certificatesOfOrigin: true,
    },
  })

  if (!invoice || !invoice.certificatesOfOrigin.length) {
    throw new DocumentGenerationError(404, {
      error: "CERTIFICATE_OF_ORIGIN_NOT_FOUND",
      message: "Certificate of Origin not found",
    })
  }

  try {
    const htmlContent = generateCertificateOfOriginHTML(invoice, invoice.certificatesOfOrigin[0])
    return await renderHtmlToPdfA4AutoScale(htmlContent)
  } catch (puppeteerError) {
    console.error("[documentPdfService] Certificate of Origin Puppeteer error, falling back to pdf-lib", {
      message: puppeteerError instanceof Error ? puppeteerError.message : String(puppeteerError),
      stack: puppeteerError instanceof Error ? puppeteerError.stack : undefined,
      name: (puppeteerError as any)?.name,
      invoiceId,
    })

    const pdf = await generateCertificateOfOriginPDF(invoice, invoice.certificatesOfOrigin[0], options.usage)
    return toPdfBuffer(pdf)
  }
}

export async function generateInsurancePdfBuffer(
  invoiceId: string,
  options: GenerationOptions = {}
): Promise<Uint8Array> {
  await ensureValidation(invoiceId, options.skipValidation)

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      exporter: true,
      buyer: true,
      items: true,
      insurances: true,
    },
  })

  if (!invoice || !invoice.insurances.length) {
    throw new DocumentGenerationError(404, {
      error: "INSURANCE_DECLARATION_NOT_FOUND",
      message: "Insurance declaration not found",
    })
  }

  try {
    const htmlContent = generateInsuranceHTML(invoice, invoice.insurances[0])
    return await renderHtmlToPdfA4AutoScale(htmlContent)
  } catch (puppeteerError) {
    console.error("[documentPdfService] Insurance Puppeteer error, falling back to pdf-lib", {
      message: puppeteerError instanceof Error ? puppeteerError.message : String(puppeteerError),
      stack: puppeteerError instanceof Error ? puppeteerError.stack : undefined,
      name: (puppeteerError as any)?.name,
      invoiceId,
    })

    const pdf = await generateInsurancePDF(invoice, invoice.insurances[0], options.usage)
    return toPdfBuffer(pdf)
  }
}

export async function generateLetterOfCreditPdfBuffer(
  invoiceId: string,
  options: GenerationOptions = {}
): Promise<Uint8Array> {
  await ensureValidation(invoiceId, options.skipValidation)

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      exporter: true,
      buyer: true,
      items: true,
      lettersOfCredit: true,
    },
  })

  if (!invoice || !invoice.lettersOfCredit.length) {
    throw new DocumentGenerationError(404, {
      error: "LETTER_OF_CREDIT_NOT_FOUND",
      message: "Letter of Credit not found",
    })
  }

  try {
    const htmlContent = generateLetterOfCreditHTML(invoice, invoice.lettersOfCredit[0])
    return await renderHtmlToPdfA4AutoScale(htmlContent)
  } catch (puppeteerError) {
    console.error("[documentPdfService] Letter of Credit Puppeteer error, falling back to pdf-lib", {
      message: puppeteerError instanceof Error ? puppeteerError.message : String(puppeteerError),
      stack: puppeteerError instanceof Error ? puppeteerError.stack : undefined,
      name: (puppeteerError as any)?.name,
      invoiceId,
    })

    const pdf = await generateLetterOfCreditPDF(invoice, invoice.lettersOfCredit[0], options.usage)
    return toPdfBuffer(pdf)
  }
}