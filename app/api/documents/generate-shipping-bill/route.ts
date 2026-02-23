import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()

  const shippingBill = await prisma.shippingBill.create({
    data: {
      invoiceId: body.invoiceId,
      portOfLoading: body.portOfLoading,
      portOfDischarge: body.portOfDischarge,
      cargoType: body.cargoType,
      schemeCode: body.schemeCode || null,
      drawback: body.drawback,
    },
  })

  return NextResponse.json(shippingBill)
}
