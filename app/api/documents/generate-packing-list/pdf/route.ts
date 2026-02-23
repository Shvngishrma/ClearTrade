import { prisma } from "@/lib/db"
import { generatePackingListPDF } from "@/lib/pdf"
import { generatePackingListHTML } from "@/lib/htmlPackingListTemplate"
import { checkUsage, incrementUsage } from "@/lib/usage"
import { validateBeforeRelease } from "@/lib/preSubmissionValidationGate"
import { lockInvoiceOnFirstPdfDownload } from "@/lib/documentLifecycle"
import { NextResponse } from "next/server"
import puppeteer from "puppeteer"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const invoiceId = searchParams.get("invoiceId")

  if (!invoiceId) {
    return new NextResponse("Missing invoiceId", { status: 400 })
  }

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
    return new NextResponse("Packing list not found", { status: 404 })
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

  const isInternalZip = req.headers.get("x-internal-zip") === "1"
  const usage = !isInternalZip ? await checkUsage() : undefined

  let pdfData: Uint8Array | undefined

  try {
    const htmlContent = generatePackingListHTML(invoice, invoice.packingLists[0], usage)

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })

    const page = await browser.newPage()

    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
    })

    pdfData = (await page.pdf({
      format: "A4",
      margin: {
        top: "15mm",
        right: "12mm",
        bottom: "15mm",
        left: "12mm",
      },
      printBackground: true,
      scale: 1,
    })) as any

    await page.close()
    await browser.close()
  } catch {
    pdfData = undefined
  }

  if (!pdfData) {
    const pdf = await generatePackingListPDF(invoice, invoice.packingLists[0], usage)
    pdfData = new Uint8Array(pdf)
  }

  if (!isInternalZip) {
    await incrementUsage()
  }

  await lockInvoiceOnFirstPdfDownload(invoiceId)

  return new NextResponse(Buffer.from(pdfData) as any, {
    headers: { "Content-Type": "application/pdf" },
  })
}
