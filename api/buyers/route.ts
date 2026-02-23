import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()

  const buyer = await prisma.buyer.create({
    data: {
      name: body.name,
      address: body.address,
      country: body.country,
    },
  })

  return NextResponse.json(buyer)
}

export async function GET() {
  const buyers = await prisma.buyer.findMany({
    orderBy: { name: "asc" },
  })

  return NextResponse.json(buyers)
}
