import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()

  const packing = await prisma.packingList.create({
    data: {
      invoiceId: body.invoiceId,
      totalBoxes: body.totalBoxes,
      netWeight: body.netWeight,
      grossWeight: body.grossWeight,
    },
  })

  return NextResponse.json(packing)
}
