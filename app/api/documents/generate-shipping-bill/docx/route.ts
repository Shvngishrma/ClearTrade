import { prisma } from "@/lib/db"
import { checkUsage } from "@/lib/usage"
import { generateShippingBillDOCX } from "@/lib/docx"
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
      shippingBills: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!invoice || !invoice.shippingBills.length) {
    return new NextResponse("Shipping Bill not found", { status: 404 })
  }

  const docx = await generateShippingBillDOCX(invoice, invoice.shippingBills[0])

  return new NextResponse(docx as any, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition":
        "attachment; filename=Shipping_Bill_Draft.docx",
    },
  })
}
