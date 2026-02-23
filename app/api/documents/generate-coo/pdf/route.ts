import { prisma } from "@/lib/db"
import { generateCertificateOfOriginPDF } from "@/lib/pdf"
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
      exporter: true,
      buyer: true,
      items: true,
      certificatesOfOrigin: true,
    },
  })

  if (!invoice || !invoice.certificatesOfOrigin.length) {
    return new NextResponse("Certificate of Origin not found", { status: 404 })
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

  const pdf = await generateCertificateOfOriginPDF(
    invoice,
    invoice.certificatesOfOrigin[0],
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
