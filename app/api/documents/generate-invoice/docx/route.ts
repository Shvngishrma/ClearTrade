import { prisma } from "@/lib/db"
import { generateInvoiceDOCX } from "@/lib/docx"
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
    include: { exporter: true, buyer: true, items: true },
  })

  if (!invoice) {
    return new NextResponse("Invoice not found", { status: 404 })
  }

  const docx = await generateInvoiceDOCX(invoice)

  return new NextResponse(docx as any, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": "attachment; filename=Commercial_Invoice.docx",
    },
  })
}
