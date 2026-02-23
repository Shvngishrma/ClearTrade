import { prisma } from "@/lib/db"
import { generateLetterOfCreditSummaryDOCX } from "@/lib/docx"
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
      lettersOfCredit: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!invoice || !invoice.lettersOfCredit.length) {
    return new NextResponse("Letter of Credit not found", { status: 404 })
  }

  const docx = await generateLetterOfCreditSummaryDOCX(invoice, invoice.lettersOfCredit[0])

  return new NextResponse(docx, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": "attachment; filename=LC_Summary.docx",
    },
  })
}
