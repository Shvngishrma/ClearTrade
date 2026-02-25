"use client"

import PrimaryButton from "./PrimaryButton"

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  context: {
    reason: "DOCX_RESTRICTED" | "LIMIT_EXCEEDED"
    message: string
  } | null
}

export function UpgradeModal({
  isOpen,
  onClose,
  context,
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-2xl font-bold mb-2">Upgrade to Pro</h2>
        <p className="text-gray-600 mb-6">{getTriggerMessage()}</p>

        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded">
          <h3 className="font-semibold text-gray-900 mb-3">
            {context.reason === "DOCX_RESTRICTED" ? "DOCX Export Features:" : "Pro Features:"}
          </h3>
          <ul className="text-sm text-gray-700 space-y-2">
            {context.reason === "DOCX_RESTRICTED" ? (
              <>
                <li>✓ Download documents as Word (DOCX)</li>
                <li>✓ Download DOCX in ZIP bundles</li>
                <li>✓ Edit and customize documents offline</li>
                <li>✓ Export in multiple formats</li>
              </>
            ) : (
              <>
                <li>✓ Unlimited document generations</li>
                <li>✓ Remove watermarks</li>
                <li>✓ Download as DOCX (Word)</li>
                <li>✓ Download DOCX in ZIP bundles</li>
                <li>✓ Priority support</li>
              </>
            )}
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 font-medium"
          >
            Continue Free
          </button>
          <PrimaryButton
            onClick={() => {
              // TODO: Implement payment/upgrade flow
              window.location.href = "/pricing"
            }}
            className="flex-1 px-4 py-2"
          >
            Upgrade Now
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
