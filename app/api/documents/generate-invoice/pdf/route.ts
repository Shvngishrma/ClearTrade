import { prisma } from "@/lib/db"
import { generateInvoicePDF } from "@/lib/pdf"
import { generateInvoiceHTML } from "@/lib/htmlInvoiceTemplate"
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

  const isInternalZip = req.headers.get("x-internal-zip") === "1"
  const usage = !isInternalZip ? await checkUsage() : undefined

  let pdfData: Uint8Array | undefined

  try {
    console.log("[generate-invoice/pdf] Before PDF generation", {
      invoiceId,
      isInternalZip,
      hasUsage: Boolean(usage),
      itemCount: invoice.items?.length || 0,
      currency: invoice.currency,
    })

    // Use Puppeteer for modern HTML-to-PDF rendering
    const htmlContent = generateInvoiceHTML(invoice, usage)

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })

    const page = await browser.newPage()

    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
    })

    const contentHeightPx = await page.evaluate(() => {
      const bodyHeight = document.body?.scrollHeight || 0
      const htmlHeight = document.documentElement?.scrollHeight || 0
      return Math.max(bodyHeight, htmlHeight)
    })

    const a4HeightPx = 1122
    const fitScale = Math.max(0.72, Math.min(1, a4HeightPx / Math.max(contentHeightPx, 1)))

    pdfData = await page.pdf({
      format: "A4",
      preferCSSPageSize: true,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
      printBackground: true,
      scale: fitScale,
    }) as any

    await page.close()
    await browser.close()
  } catch (puppeteerError) {
    console.error("[generate-invoice/pdf] Puppeteer error (full stack)", {
      message: puppeteerError instanceof Error ? puppeteerError.message : String(puppeteerError),
      stack: puppeteerError instanceof Error ? puppeteerError.stack : undefined,
      name: (puppeteerError as any)?.name,
    })
    // Fallback to pdf-lib if Puppeteer fails
    pdfData = undefined
  }

  // Use fallback if Puppeteer fails
  if (!pdfData) {
    console.log("[generate-invoice/pdf] Falling back to generateInvoicePDF", { invoiceId })
    const pdf = await generateInvoicePDF(invoice, usage)
    pdfData = new Uint8Array(pdf)
  }

  if (!isInternalZip) {
    await incrementUsage()
  }

  await lockInvoiceOnFirstPdfDownload(invoiceId)

  return new NextResponse(Buffer.from(pdfData) as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Commercial_Invoice_${invoiceId}.pdf"`,
    },
  })
}
