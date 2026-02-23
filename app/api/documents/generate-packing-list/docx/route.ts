import { prisma } from "@/lib/db"
import { checkUsage } from "@/lib/usage"
import { generatePackingListDOCX } from "@/lib/docx"
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
      packingLists: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!invoice || !invoice.packingLists.length) {
    return new NextResponse("Packing List not found", { status: 404 })
  }

  const docx = await generatePackingListDOCX(invoice, invoice.packingLists[0])

  return new NextResponse(docx, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition":
        "attachment; filename=Packing_List.docx",
    },
  })
}
