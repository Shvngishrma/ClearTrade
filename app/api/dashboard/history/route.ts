import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"
import { prisma } from "@/lib/db"

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  if (!session.user.isPro) {
    return NextResponse.json({ error: "PRO_REQUIRED" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const invoiceId = searchParams.get("invoiceId")

  if (!invoiceId) {
    return NextResponse.json({ error: "Missing invoiceId" }, { status: 400 })
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, userId: true },
  })

  if (!invoice || invoice.userId !== session.user.id) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.item.deleteMany({ where: { invoiceId } })
    await tx.carton.deleteMany({ where: { packingList: { invoiceId } } })
    await tx.packingList.deleteMany({ where: { invoiceId } })
    await tx.shippingBill.deleteMany({ where: { invoiceId } })
    await tx.declaration.deleteMany({ where: { invoiceId } })
    await tx.certificateOfOrigin.deleteMany({ where: { invoiceId } })
    await tx.insurance.deleteMany({ where: { invoiceId } })
    await tx.letterOfCredit.deleteMany({ where: { invoiceId } })
    await tx.invoiceVersion.deleteMany({ where: { invoiceId } })
    await tx.invoice.delete({ where: { id: invoiceId } })
  })

  return NextResponse.json({ ok: true })
}
