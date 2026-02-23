import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const invoices = await prisma.invoice.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 7,
    include: {
      packingLists: { select: { id: true }, take: 1 },
      shippingBills: { select: { id: true }, take: 1 },
      declarations: { select: { id: true }, take: 1 },
      certificatesOfOrigin: { select: { id: true }, take: 1 },
      insurances: { select: { id: true }, take: 1 },
      lettersOfCredit: { select: { id: true }, take: 1 },
    },
  })

  return NextResponse.json({ invoices })
}
