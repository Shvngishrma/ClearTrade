import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()

  const coo = await prisma.certificateOfOrigin.create({
    data: {
      invoiceId: body.invoiceId,
      originCountry: body.originCountry,
      chamberName: body.chamberName,
      registrationNumber: body.registrationNumber || null,
    },
  })

  return NextResponse.json(coo)
}
