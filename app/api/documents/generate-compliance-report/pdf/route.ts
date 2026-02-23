import { NextResponse } from "next/server"
import puppeteer from "puppeteer"
import { checkUsage } from "@/lib/usage"
import { getCurrentUser } from "@/lib/auth"
import { generateComplianceReport } from "@/lib/complianceReportGenerator"

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

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })

    let pdfData: Uint8Array

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
