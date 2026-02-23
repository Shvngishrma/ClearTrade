import { prisma } from "@/lib/db"
import { generateCertificateOfOriginDOCX } from "@/lib/docx"
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
      certificatesOfOrigin: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!invoice || !invoice.certificatesOfOrigin.length) {
    return new NextResponse("Certificate of Origin not found", { status: 404 })
  }

  const docx = await generateCertificateOfOriginDOCX(invoice, invoice.certificatesOfOrigin[0])

  return new NextResponse(docx as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": "attachment; filename=Certificate_of_Origin.docx",
    },
  })
}
