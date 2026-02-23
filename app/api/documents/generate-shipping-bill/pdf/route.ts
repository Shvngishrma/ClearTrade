import { prisma } from "@/lib/db"
import { generateShippingBillPDF } from "@/lib/pdf"
import { checkUsage, incrementUsage } from "@/lib/usage"
import { validateBeforeRelease } from "@/lib/preSubmissionValidationGate"
import { lockInvoiceOnFirstPdfDownload } from "@/lib/documentLifecycle"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const invoiceId = searchParams.get("invoiceId")

  if (!invoiceId) {
    return new NextResponse("Missing invoiceId", { status: 400 })
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
      shippingBills: true,
    },
  })

  if (!invoice || !invoice.shippingBills.length) {
    return new NextResponse("Shipping Bill not found", { status: 404 })
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

  const pdf = await generateShippingBillPDF(
    invoice,
    invoice.shippingBills[0],
    usage
  )

  if (!isInternalZip) {
    await incrementUsage()
  }

  await lockInvoiceOnFirstPdfDownload(invoiceId)

  return new NextResponse(pdf, {
    headers: { "Content-Type": "application/pdf" },
  })
}
