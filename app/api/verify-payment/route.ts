import { NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

type VerifyPaymentRequest = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

function getExpectedSignature(orderId: string, paymentId: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex")
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { error: "RAZORPAY_CONFIG_MISSING", message: "Razorpay secret is not configured" },
        { status: 500 }
      )
    }

    const body = (await req.json()) as VerifyPaymentRequest
    const razorpayOrderId = body?.razorpay_order_id
    const razorpayPaymentId = body?.razorpay_payment_id
    const razorpaySignature = body?.razorpay_signature

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json(
        { error: "MISSING_PAYMENT_FIELDS", message: "Payment verification payload is incomplete" },
        { status: 400 }
      )
    }

    const expectedSignature = getExpectedSignature(
      razorpayOrderId,
      razorpayPaymentId,
      process.env.RAZORPAY_KEY_SECRET
    )

    if (expectedSignature !== razorpaySignature) {
      return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 })
    }

    await prisma.payment.updateMany({
      where: {
        userId: user.id,
        razorpayOrderId,
      },
      data: {
        status: "successful",
        razorpayPaymentId,
      },
    })

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { isPro: true },
      }),
      prisma.usage.upsert({
        where: { userId: user.id },
        create: { userId: user.id, isPro: true },
        update: { isPro: true },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: "Payment verified and Pro access unlocked",
    })
  } catch (error) {
    console.error("[verify-payment] Error:", error)
    return NextResponse.json(
      { error: "VERIFY_PAYMENT_FAILED", message: "Unable to verify payment" },
      { status: 500 }
    )
  }
}
