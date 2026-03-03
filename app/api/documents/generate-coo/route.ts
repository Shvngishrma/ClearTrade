import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()

  if (!body.registrationNumber || !body.registrationNumber.trim()) {
    return new NextResponse(JSON.stringify({
      error: "VALIDATION_ERROR",
      message: "Chamber registration number is required. Please add the registration number.",
    }), { status: 400, headers: { "Content-Type": "application/json" } })
  }

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
