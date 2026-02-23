import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
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

    const { amount } = await req.json()

    if (!amount) {
      return new NextResponse("Amount required", { status: 400 })
    }

    // Create Razorpay order
    const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(
          `${process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
        ).toString("base64")}`,
      },
      body: JSON.stringify({
        amount: amount * 100, // Convert to paise
        currency: "INR",
        receipt: `receipt_${userId}`,
      }),
    })

    if (!orderResponse.ok) {
      return new NextResponse("Failed to create order", { status: 500 })
    }

    const order = await orderResponse.json()

    // Save order to database
    await prisma.payment.create({
      data: {
        userId,
        razorpayOrderId: order.id,
        amount,
        status: "pending",
      },
    })

    return NextResponse.json({
      orderId: order.id,
      amount,
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    })
  } catch (error) {
    console.error("Error creating order:", error)
    return new NextResponse("Internal server error", { status: 500 })
  }
}
