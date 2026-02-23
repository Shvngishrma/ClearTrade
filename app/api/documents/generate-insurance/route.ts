import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()

  const insurance = await prisma.insurance.create({
    data: {
      invoiceId: body.invoiceId,
      policyNumber: body.policyNumber,
      insuredValue: body.insuredValue,
    },
  })

  return NextResponse.json(insurance)
}
