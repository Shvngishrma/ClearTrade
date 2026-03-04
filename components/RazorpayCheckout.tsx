"use client"

import { useMemo, useState } from "react"
import Script from "next/script"

type RazorpayResponse = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

type CreateOrderResponse = {
  orderId: string
  amount: number
  keyId: string
  currency: "INR"
}

type RazorpayCheckoutProps = {
  amount: number
  customerName?: string
  customerEmail?: string
  buttonLabel?: string
  className?: string
  disabled?: boolean
  onPaymentSuccess?: () => void
  onPaymentError?: (message: string) => void
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void
    }
  }
}

export default function RazorpayCheckout({
  amount,
  customerName,
  customerEmail,
  buttonLabel = "Pay with Razorpay",
  className,
  disabled = false,
  onPaymentSuccess,
  onPaymentError,
}: RazorpayCheckoutProps) {
  const [isLoading, setIsLoading] = useState(false)

  const isDisabled = useMemo(() => {
    return disabled || isLoading || !Number.isFinite(amount) || amount <= 0
  }, [amount, disabled, isLoading])

  async function handlePayment() {
    try {
      setIsLoading(true)

      if (!window.Razorpay) {
        throw new Error("Razorpay SDK failed to load")
      }

      if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
        throw new Error("Razorpay public key is missing")
      }

      const createOrderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      })

      if (!createOrderRes.ok) {
        const errorPayload = await createOrderRes.json().catch(() => ({}))
        throw new Error(errorPayload?.message || "Unable to create payment order")
      }

      const orderData = (await createOrderRes.json()) as CreateOrderResponse

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount * 100,
        currency: orderData.currency,
        name: "Cleartrade",
        description: "Export Document Generation",
        order_id: orderData.orderId,
        prefill: {
          name: customerName || "",
          email: customerEmail || "",
        },
        theme: {
          color: "#111827",
        },
        handler: async (response: RazorpayResponse) => {
          const verifyRes = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          })

          if (!verifyRes.ok) {
            const verifyPayload = await verifyRes.json().catch(() => ({}))
            throw new Error(verifyPayload?.message || "Payment verification failed")
          }

          onPaymentSuccess?.()
        },
      }

      const razorpay = new window.Razorpay(options)
      razorpay.open()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment failed"
      onPaymentError?.(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <button
        type="button"
        onClick={handlePayment}
        disabled={isDisabled}
        className={
          className ||
          "inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {isLoading ? "Processing..." : buttonLabel}
      </button>
    </>
  )
}
