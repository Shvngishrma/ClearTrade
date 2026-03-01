import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { normalizeShippingBillCargoType } from "@/lib/shippingBillCargoType"

export async function POST(req: Request) {
  const body = await req.json()
  const cargoType = normalizeShippingBillCargoType(body.cargoType)

  const shippingBill = await prisma.shippingBill.create({
    data: {
      invoiceId: body.invoiceId,
      portOfLoading: body.portOfLoading,
      portOfDischarge: body.portOfDischarge,
      cargoType,
      schemeCode: body.schemeCode || null,
      drawback: body.drawback,
    },
  })

  return NextResponse.json(shippingBill)
}
