import { NextResponse } from "next/server"
import Razorpay from "razorpay"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth"

type CreateOrderRequest = {
  amount: number
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
    }

    if (
      !process.env.RAZORPAY_KEY_ID ||
      !process.env.RAZORPAY_KEY_SECRET ||
      !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
    ) {
      return NextResponse.json(
        { error: "RAZORPAY_CONFIG_MISSING", message: "Razorpay is not configured" },
        { status: 500 }
      )
    }

    // RAZORPAY_KEY_SECRET must remain backend-only.
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })

    const body = (await req.json()) as CreateOrderRequest
    const amount = Number(body?.amount)

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "INVALID_AMOUNT", message: "Amount must be a positive number" },
        { status: 400 }
      )
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `cleartrade_${user.id}_${Date.now()}`,
      notes: {
        userId: user.id,
        product: "Cleartrade Pro",
      },
    })

    await prisma.payment.create({
      data: {
        userId: user.id,
        razorpayOrderId: order.id,
        amount,
        status: "pending",
      },
    })

    return NextResponse.json({
      orderId: order.id,
      amount,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      currency: "INR",
    })
  } catch (error) {
    console.error("[create-order] Error:", error)
    return NextResponse.json(
      { error: "CREATE_ORDER_FAILED", message: "Unable to create Razorpay order" },
      { status: 500 }
    )
  }
}
