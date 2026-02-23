import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const invoiceId = (searchParams.get("invoiceId") || "").trim()

  if (!invoiceId) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "invoiceId is required" },
      { status: 400 }
    )
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      userId: true,
      invoiceNumber: true,
      status: true,
      version: true,
      readyAt: true,
      lockedAt: true,
      amendedAt: true,
      hashGeneratedAt: true,
    },
  })

  if (!invoice) {
    return NextResponse.json({ error: "NOT_FOUND", message: "Invoice not found" }, { status: 404 })
  }

  if (invoice.userId && invoice.userId !== user.id) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  return NextResponse.json({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    version: invoice.version,
    readyAt: invoice.readyAt,
    lockedAt: invoice.lockedAt,
    amendedAt: invoice.amendedAt,
    hashGeneratedAt: invoice.hashGeneratedAt,
  })
}
