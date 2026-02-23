import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()

  const declaration = await prisma.declaration.create({
    data: {
      invoiceId: body.invoiceId,
      type: body.type,
    },
  })

  return NextResponse.json(declaration)
}
