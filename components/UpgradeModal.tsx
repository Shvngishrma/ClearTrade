"use client"

import PrimaryButton from "./PrimaryButton"
import RazorpayCheckout from "./RazorpayCheckout"

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  context: {
    reason: "DOCX_RESTRICTED" | "LIMIT_EXCEEDED"
    message: string
  } | null
  title?: string
  body?: string
  benefits?: string[]
  primaryLabel?: string
  secondaryLabel?: string
  onUpgrade?: () => void
  checkoutConfig?: {
    amount: number
    customerName?: string
    customerEmail?: string
    onSuccess?: () => void
    onError?: (message: string) => void
  }
}

export function UpgradeModal({
  isOpen,
  onClose,
  context,
  title,
  body,
  benefits,
  primaryLabel,
  secondaryLabel,
  onUpgrade,
  checkoutConfig,
}: UpgradeModalProps) {
  if (!isOpen || !context) return null

  const getTriggerMessage = () => {
    switch (context.reason) {
      case "DOCX_RESTRICTED":
        return "Word document exports are exclusively available to Pro members. Upgrade now to download invoices and shipping documents as DOCX files."
      case "LIMIT_EXCEEDED":
        return "You've reached your free limit of 7 document generations. Pro members get unlimited documents, no watermarks, and full feature access."
      default:
        return "Upgrade to Pro to unlock premium features."
    }
  }

  const defaultBenefits = context.reason === "DOCX_RESTRICTED"
    ? [
        "✓ Download documents as Word (DOCX)",
        "✓ Download DOCX in ZIP bundles",
        "✓ Edit and customize documents offline",
        "✓ Export in multiple formats",
      ]
    : [
        "✓ Unlimited document generations",
        "✓ Remove watermarks",
        "✓ Download as DOCX (Word)",
        "✓ Download DOCX in ZIP bundles",
        "✓ Priority support",
      ]

  const modalTitle = title || "Upgrade to Pro"
  const modalBody = body || getTriggerMessage()
  const featureBenefits = benefits && benefits.length > 0 ? benefits : defaultBenefits
  const featuresTitle = context.reason === "DOCX_RESTRICTED" ? "DOCX Export Features:" : "Pro Features:"
  const primaryText = primaryLabel || "Upgrade Now"
  const secondaryText = secondaryLabel || "Continue Free"

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-md w-full mx-4 p-6 border border-gray-200 dark:border-zinc-700">
        <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-zinc-100">{modalTitle}</h2>
        <p className="text-gray-600 dark:text-zinc-300 mb-6">{modalBody}</p>

        <div className="mb-6 p-4 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded">
          <h3 className="font-semibold text-gray-900 dark:text-zinc-100 mb-3">{featuresTitle}</h3>
          <ul className="text-sm text-gray-700 dark:text-zinc-200 space-y-2">
            {featureBenefits.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded hover:bg-gray-50 dark:hover:bg-zinc-800 font-medium text-gray-800 dark:text-zinc-100"
          >
            {secondaryText}
          </button>
          {checkoutConfig ? (
            <RazorpayCheckout
              amount={checkoutConfig.amount}
              customerName={checkoutConfig.customerName}
              customerEmail={checkoutConfig.customerEmail}
              onPaymentSuccess={checkoutConfig.onSuccess}
              onPaymentError={checkoutConfig.onError}
              buttonLabel={primaryText}
              className="flex-1 px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-60 disabled:cursor-not-allowed inline-block text-center font-medium transition-colors"
            />
          ) : (
            <PrimaryButton
              onClick={() => {
                if (onUpgrade) {
                  onUpgrade()
                  return
                }
                window.location.href = "/pricing"
              }}
              className="flex-1 px-4 py-2"
            >
              {primaryText}
            </PrimaryButton>
          )}
        </div>
      </div>
    </div>
  )
}
