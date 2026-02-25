import { NextResponse } from "next/server"
import puppeteer from "puppeteer"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { checkUsage } from "@/lib/usage"
import { getCurrentUser } from "@/lib/auth"
import { generateComplianceReport } from "@/lib/complianceReportGenerator"

export const runtime = "nodejs"

function htmlToTextLines(html: string): string[] {
  const normalized = String(html || "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h1|h2|h3|h4|tr)>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\r/g, "")

  return normalized
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
}

async function generateFallbackPdfFromHtml(html: string, invoiceId: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)

  const pageSize: [number, number] = [595, 842] // A4
  const marginX = 40
  const topY = 800
  const bottomY = 40
  const lineHeight = 12
  const maxTextWidth = pageSize[0] - marginX * 2

  let page = pdf.addPage(pageSize)
  let y = topY

  page.drawText("COMPLIANCE CERTIFICATE", {
    x: marginX,
    y,
    size: 14,
    font: boldFont,
    color: rgb(0.08, 0.08, 0.08),
  })
  y -= 18
  page.drawText(`Invoice ID: ${invoiceId}`, {
    x: marginX,
    y,
    size: 9,
    font,
    color: rgb(0.35, 0.35, 0.35),
  })
  y -= 18

  const lines = htmlToTextLines(html)

  const wrapLine = (input: string): string[] => {
    const words = input.split(" ")
    const wrapped: string[] = []
    let current = ""

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      const width = font.widthOfTextAtSize(candidate, 9)
      if (width <= maxTextWidth) {
        current = candidate
      } else {
        if (current) wrapped.push(current)
        current = word
      }
    }

    if (current) wrapped.push(current)
    return wrapped.length > 0 ? wrapped : [""]
  }

  for (const rawLine of lines) {
    const wrapped = wrapLine(rawLine)
    for (const segment of wrapped) {
      if (y <= bottomY) {
        page = pdf.addPage(pageSize)
        y = topY
      }

      page.drawText(segment, {
        x: marginX,
        y,
        size: 9,
        font,
        color: rgb(0.12, 0.12, 0.12),
      })
      y -= lineHeight
    }
    y -= 2
  }

  return await pdf.save()
}

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const invoiceId = searchParams.get("invoiceId")

  if (!invoiceId) {
    return new NextResponse("Missing invoiceId", { status: 400 })
  }

  const isInternalZip = req.headers.get("x-internal-zip") === "1"
  if (!isInternalZip) {
    await checkUsage()
  }

  try {
    const report = await generateComplianceReport(invoiceId)

    if (!report.allowed) {
      return NextResponse.json(
        {
          error: "PRE_SUBMISSION_VALIDATION_FAILED",
          message: "Critical validation failed. Fix issues before compliance report generation.",
          blockers: report.blockers,
        },
        { status: 400 }
      )
    }

    let pdfData: Uint8Array
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      })

      try {
        const page = await browser.newPage()
        await page.setContent(report.html, { waitUntil: "networkidle0" })

        pdfData = (await page.pdf({
          format: "A4",
          printBackground: true,
          margin: {
            top: "10mm",
            right: "10mm",
            bottom: "10mm",
            left: "10mm",
          },
        })) as Uint8Array

        await page.close()
      } finally {
        await browser.close()
      }
    } catch (puppeteerError: any) {
      console.error("[generate-compliance-report/pdf] Puppeteer unavailable, using pdf-lib fallback", {
        message: puppeteerError?.message || String(puppeteerError),
      })
      pdfData = await generateFallbackPdfFromHtml(report.html, invoiceId)
    }

    return new NextResponse(Buffer.from(pdfData) as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Compliance_Certificate_${invoiceId}.pdf"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "COMPLIANCE_REPORT_PDF_GENERATION_FAILED",
        message: error?.message || "Unable to generate compliance report PDF",
      },
      { status: 500 }
    )
  }
}
