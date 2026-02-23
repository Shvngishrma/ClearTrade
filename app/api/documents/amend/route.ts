import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { markInvoiceAmended } from "@/lib/documentLifecycle"

export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  try {
    const body = await req.json()
    const invoiceId = (body?.invoiceId || "").toString().trim()
    const reason = (body?.reason || "").toString().trim()

    if (!invoiceId) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "invoiceId is required" },
        { status: 400 }
      )
    }

    if (!reason) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "reason is required for amendment traceability" },
        { status: 400 }
      )
    }

    await markInvoiceAmended(invoiceId, reason, user.id)

    return NextResponse.json({
      success: true,
      invoiceId,
      status: "AMENDED",
      message: "Invoice marked as AMENDED and version trail updated",
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "AMENDMENT_FAILED",
        message: error?.message || "Unable to mark invoice as amended",
      },
      { status: 500 }
    )
  }
}
