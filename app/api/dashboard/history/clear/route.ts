import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"
import { prisma } from "@/lib/db"

export async function DELETE() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const invoices = await prisma.invoice.findMany({
    where: { userId: session.user.id },
    select: { id: true },
  })

  const invoiceIds = invoices.map((invoice) => invoice.id)

  if (invoiceIds.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.item.deleteMany({ where: { invoiceId: { in: invoiceIds } } })
    await tx.carton.deleteMany({ where: { packingList: { invoiceId: { in: invoiceIds } } } })
    await tx.packingList.deleteMany({ where: { invoiceId: { in: invoiceIds } } })
    await tx.shippingBill.deleteMany({ where: { invoiceId: { in: invoiceIds } } })
    await tx.declaration.deleteMany({ where: { invoiceId: { in: invoiceIds } } })
    await tx.certificateOfOrigin.deleteMany({ where: { invoiceId: { in: invoiceIds } } })
    await tx.insurance.deleteMany({ where: { invoiceId: { in: invoiceIds } } })
    await tx.letterOfCredit.deleteMany({ where: { invoiceId: { in: invoiceIds } } })
    await tx.invoiceVersion.deleteMany({ where: { invoiceId: { in: invoiceIds } } })
    await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } })
  })

  return NextResponse.json({ ok: true, deleted: invoiceIds.length })
}
