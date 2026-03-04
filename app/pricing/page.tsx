"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import PrimaryButton from "../../components/PrimaryButton"
import { useRouter } from "next/navigation"
import RazorpayCheckout from "../../components/RazorpayCheckout"

export default function PricingPage() {
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const [paymentError, setPaymentError] = useState<string | null>(null)

  useEffect(() => {
    if (status !== "loading") {
      setLoading(false)
    }
  }, [status])

  const handlePaymentSuccess = () => {
    setPaymentError(null)
    setTimeout(() => {
      router.push("/dashboard")
    }, 1500)
  }

  const handlePaymentError = (message: string) => {
    setPaymentError(message)
  }

  function renderCTA() {
    if (loading) {
      return <PrimaryButton disabled>Loading...</PrimaryButton>
    }

    if (status === "unauthenticated") {
      return <PrimaryButton href="/login">Sign in to upgrade</PrimaryButton>
    }

    if (session?.user && !(session.user as any).isPro) {
        return (
          <RazorpayCheckout
            amount={999}
            customerName={(session.user as any).name || ""}
            customerEmail={(session.user as any).email || ""}
            buttonLabel="Upgrade to Pro (₹999/month)"
            onPaymentSuccess={handlePaymentSuccess}
            onPaymentError={handlePaymentError}
            className="w-full px-6 py-3 rounded-lg bg-gray-900 text-white hover:bg-gray-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-60 disabled:cursor-not-allowed inline-block text-center font-medium transition-colors"
          />
        )
    }

    return (
      <button disabled className="px-6 py-3 rounded-lg bg-gray-200 text-gray-600 dark:bg-zinc-700 dark:text-zinc-300 cursor-default inline-block text-center font-medium">
        Current Plan
      </button>
    )
  }

  const isPro = (session?.user as any)?.isPro || false

  return (
    <div className="min-h-screen max-w-5xl mx-auto py-16 px-6 text-gray-900 dark:text-zinc-100">
      {loading ? (
        <div className="text-center">
          <p className="text-gray-600 dark:text-zinc-400">Loading...</p>
        </div>
      ) : (
        <>
          <h1 className="text-4xl font-bold text-center mb-10">
            Simple, transparent pricing.
          </h1>
          <p className="text-center text-gray-500 dark:text-zinc-400 mb-10 max-w-2xl mx-auto">
            Start free. Upgrade for unlimited generation and professional document workflows.
          </p>

          {paymentError && (
            <div className="mb-6 max-w-2xl mx-auto bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <p className="text-red-800 dark:text-red-200 text-sm font-medium">{paymentError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Free */}
            <div className="border border-gray-200 dark:border-zinc-700 rounded-xl p-6 bg-white dark:bg-zinc-900 shadow-sm">
              <h2 className="text-xl font-semibold mb-4">Free</h2>
              <ul className="space-y-2 text-gray-600 dark:text-zinc-300">
                <li>✓ Generate up to 7 documents</li>
                <li>✓ Watermarked PDFs</li>
                <li>✓ ZIP downloads</li>
                <li>✗ Dashboard & history</li>
              </ul>
            </div>

            {/* Pro */}
            <div className="relative border border-gray-900/20 dark:border-zinc-500 rounded-xl p-6 bg-gradient-to-b from-gray-50 to-white dark:from-zinc-800 dark:to-zinc-900 shadow-md">
              <span className="absolute -top-3 right-4 text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                Most popular
              </span>
              <h2 className="text-xl font-semibold mb-4">Pro</h2>
              <p className="text-3xl font-bold mb-4">₹999 / month</p>
              <ul className="space-y-2 text-gray-600 dark:text-zinc-300">
                <li>✓ Unlimited documents</li>
                <li>✓ No watermark</li>
                <li>✓ DOCX format + ZIP downloads</li>
                <li>✓ Dashboard & history</li>
                <li>✓ Priority templates</li>
              </ul>
              <div className="mt-6">
                {renderCTA()}
              </div>
            </div>
          </div>

          {/* Footer Message */}
          <div className="mt-12 text-center">
            {isPro ? (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6 max-w-2xl mx-auto">
                <p className="text-lg font-medium text-gray-900 dark:text-zinc-100 mb-2">
                  🎉 Welcome to Pro!
                </p>
                <p className="text-emerald-800 dark:text-emerald-200">
                  You're all set with unlimited access. Generate documents, download without watermarks, and enjoy all premium features.
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-6 max-w-2xl mx-auto shadow-sm">
                <p className="text-lg font-medium text-gray-900 dark:text-zinc-100 mb-2">
                  Ready to unlock unlimited potential?
                </p>
                <p className="text-gray-600 dark:text-zinc-300">
                  Upgrade to Pro today and start generating professional documents without limits. No watermarks, full access to all features.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
