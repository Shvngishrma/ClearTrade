import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()

  const exporter = await prisma.exporter.create({
    data: {
      name: body.name,
      address: body.address,
      iec: body.iec,
      gstin: body.gstin || null,
    },
  })

  return NextResponse.json(exporter)
}

export async function GET() {
  const exporters = await prisma.exporter.findMany({
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(exporters)
}
