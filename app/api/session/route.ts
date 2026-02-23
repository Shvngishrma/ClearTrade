import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()
  const invoiceNumber =
    body.invoiceNumber ||
    `INV-${Date.now()}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`

  const exporter = await prisma.exporter.create({
    data: body.exporter,
  })

  const buyer = await prisma.buyer.create({
    data: {
      ...body.buyer,
      buyerTaxId: body.buyer?.buyerTaxId || null,
      buyerVAT: body.buyer?.buyerVAT || null,
      buyerRegistrationNumber: body.buyer?.buyerRegistrationNumber || null,
    },
  })

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      exporterId: exporter.id,
      buyerId: buyer.id,
      incoterm: body.incoterm,
      currency: body.currency,
      totalValue: body.items.reduce(
        (sum: number, i: any) => sum + i.quantity * i.unitPrice,
        0
      ),
      items: {
        create: body.items,
      },
    },
  })

  return NextResponse.json({
    invoiceId: invoice.id,
  })
}
