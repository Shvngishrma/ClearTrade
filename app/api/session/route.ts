import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()

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
