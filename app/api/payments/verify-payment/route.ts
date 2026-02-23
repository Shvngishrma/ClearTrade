import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import crypto from "crypto"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/authOptions"

export async function POST(req: Request) {
  if (process.env.PAYMENTS_ENABLED !== "true") {
    return new NextResponse("Payments disabled", { status: 503 })
  }

  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } =
      await req.json()

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return new NextResponse("Missing payment details", { status: 400 })
    }

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
        userId,
        razorpayOrderId,
      },
      data: {
        status: "completed",
        razorpayPaymentId,
      },
    })

    // Mark usage as Pro
    await prisma.usage.upsert({
      where: { userId },
      create: { userId, isPro: true },
      update: { isPro: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error verifying payment:", error)
    return new NextResponse("Internal server error", { status: 500 })
  }
}
