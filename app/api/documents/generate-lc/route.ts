import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()

  const lc = await prisma.letterOfCredit.create({
    data: {
      invoiceId: body.invoiceId,
      lcNumber: body.lcNumber,
    },
  })

  return NextResponse.json(lc)
}
