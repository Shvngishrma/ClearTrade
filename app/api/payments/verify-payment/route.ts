import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSessionId } from "@/lib/session"
import crypto from "crypto"

export async function POST(req: Request) {
  if (process.env.PAYMENTS_ENABLED !== "true") {
    return new NextResponse("Payments disabled", { status: 503 })
  }

  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } =
      await req.json()

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return new NextResponse("Missing payment details", { status: 400 })
    }

    const sessionId = getSessionId()

    // Verify signature
    const body = `${razorpayOrderId}|${razorpayPaymentId}`
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest("hex")

    if (expectedSignature !== razorpaySignature) {
      return new NextResponse("Invalid signature", { status: 400 })
    }

    // Update payment status
    await prisma.payment.updateMany({
      where: {
        sessionId,
        razorpayOrderId,
      },
      data: {
        status: "completed",
        razorpayPaymentId,
      },
    })

    // Mark usage as Pro
    await prisma.usage.update({
      where: { sessionId },
      data: { isPro: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error verifying payment:", error)
    return new NextResponse("Internal server error", { status: 500 })
  }
}
