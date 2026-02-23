import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { checkUsage } from "@/lib/usage"
import { validateBeforeRelease } from "@/lib/preSubmissionValidationGate"
import { generateComplianceCertificateDOCX } from "@/lib/docx"

export async function GET(req: Request) {
  const usage = await checkUsage()

  if (!usage.isPro) {
    return new NextResponse("Pro only", { status: 403 })
  }

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
    },
  })

  if (!invoice) {
    return new NextResponse("Invoice not found", { status: 404 })
  }

  const validation = await validateBeforeRelease(invoiceId)
  const docx = await generateComplianceCertificateDOCX(invoice, validation)
  const body = new Blob([Uint8Array.from(docx)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  })

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename=Compliance_Certificate_${invoiceId}.docx`,
    },
  })
}
