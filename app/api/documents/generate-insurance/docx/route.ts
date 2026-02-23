import { prisma } from "@/lib/db"
import { generateInsuranceDOCX } from "@/lib/docx"
import { checkUsage } from "@/lib/usage"
import { NextResponse } from "next/server"

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
      items: true,
      insurances: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!invoice || !invoice.insurances.length) {
    return new NextResponse("Insurance declaration not found", { status: 404 })
  }

  const docx = await generateInsuranceDOCX(invoice, invoice.insurances[0])

  return new NextResponse(docx, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": "attachment; filename=Insurance_Certificate.docx",
    },
  })
}
