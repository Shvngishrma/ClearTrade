import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { normalizeShippingBillCargoType } from "@/lib/shippingBillCargoType"

export async function POST(req: Request) {
  const body = await req.json()
  const cargoType = normalizeShippingBillCargoType(body.cargoType)
  const adCode = String(body?.adCode || "").trim().toUpperCase()
  const adCodePattern = /^[A-Z0-9]{7,11}$/

  if (!adCodePattern.test(adCode)) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        message: "Authorized Dealer (AD) Code is required for Shipping Bill.",
      },
      { status: 400 }
    )
  }

  const shippingBill = await prisma.shippingBill.create({
    data: {
      invoiceId: body.invoiceId,
      adCode,
      portOfLoading: body.portOfLoading,
      portOfDischarge: body.portOfDischarge,
      cargoType,
      schemeCode: body.schemeCode || null,
      drawback: body.drawback,
    },
  })

  return NextResponse.json(shippingBill)
}
