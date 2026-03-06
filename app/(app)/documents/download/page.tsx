"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { UpgradeModal } from "@/components/UpgradeModal"
import PrimaryButton from "../../../../components/PrimaryButton"


// No longer used for UI; kept for fallback
const DOCUMENT_TYPES = [
  "Commercial Invoice",
  "Packing List",
  "Shipping Bill",
  "Declaration",
  "Certificate of Origin",
  "Insurance Declaration",
  "LC Supporting Documents",
  "Document Compliance Certificate",
]

const DOC_LABELS: Record<string, string> = {
  invoice: "Commercial Invoice",
  packingList: "Packing List",
  shippingBill: "Shipping Bill",
  declaration: "Declaration",
  coo: "Certificate of Origin",
  insurance: "Insurance Declaration",
  lc: "LC Supporting Documents",
}

const FREE_PLAN_LIMIT = 7

function DownloadPageContent() {
  const router = useRouter()
  const params = useSearchParams()
  const invoiceId = params.get("invoiceId")
  const requestedDocs = (params.get("docs") || "").trim()
  const requestedDocLabels = requestedDocs
    ? new Set(
        requestedDocs
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
          .map((value) => DOC_LABELS[value])
          .filter(Boolean)
      )
    : null
  const autoDownload = (params.get("autodownload") || "").toLowerCase()
  const initialStatus = (params.get("status") || "DRAFT").toUpperCase()
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDownloadingDocxZip, setIsDownloadingDocxZip] = useState(false)
  const [isDownloadingCompliance, setIsDownloadingCompliance] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeContext, setUpgradeContext] = useState<{
    reason: "DOCX_RESTRICTED" | "LIMIT_EXCEEDED"
    message: string
  } | null>(null)
  const [downloadSuccess, setDownloadSuccess] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [invoiceStatus, setInvoiceStatus] = useState(initialStatus)
  const [invoiceVersion, setInvoiceVersion] = useState<number>(1)
  const [isPro, setIsPro] = useState(false)
  const [usageCount, setUsageCount] = useState(0)
  const [usageLoading, setUsageLoading] = useState(true)
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [includedDocs, setIncludedDocs] = useState<string[]>([])
  const [includedDocsLoading, setIncludedDocsLoading] = useState(true)
  const [includedDocsError, setIncludedDocsError] = useState<string | null>(null)
  const [autoDownloadTriggered, setAutoDownloadTriggered] = useState(false)
  const isFreeLimitReached = !isPro && usageCount >= FREE_PLAN_LIMIT

  function openLimitUpgradeModal(message?: string) {
    setUpgradeContext({
      reason: "LIMIT_EXCEEDED",
      message: message || "Free plan limit reached",
    })
    setShowUpgradeModal(true)
  }
  // Fetch included document list for this invoice
  useEffect(() => {
    if (!invoiceId) return
    let cancelled = false
    setIncludedDocsLoading(true)
    setIncludedDocsError(null)
    const docsQuery = requestedDocs ? `&docs=${encodeURIComponent(requestedDocs)}` : ""
    fetch(`/api/documents/download-zip?invoiceId=${invoiceId}&list=1${docsQuery}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(async () => ({ message: await res.text() }))
          throw new Error(payload?.message || payload?.error || "Failed to load included documents")
        }
        return res.json()
      })
      .then((data) => {
        if (!cancelled && data?.included && Array.isArray(data.included)) {
          const normalized = data.included.map((value: unknown) => String(value))
          const filtered = requestedDocLabels
            ? normalized.filter((doc: string) => requestedDocLabels.has(doc))
            : normalized
          setIncludedDocs(filtered)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setIncludedDocsError(err instanceof Error ? err.message : "Failed to load included documents")
          setIncludedDocs([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIncludedDocsLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [invoiceId, requestedDocs])

  const badgeConfig: Record<string, { label: string; className: string }> = {
    DRAFT: { label: "🟡 Draft", className: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200" },
    READY: { label: "🟢 Ready", className: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200" },
    LOCKED: { label: "🔒 Locked", className: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200" },
    AMENDED: { label: "🔁 Amended", className: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200" },
  }

  async function loadInvoiceStatus() {
    if (!invoiceId) return
    try {
      const res = await fetch(`/api/documents/status?invoiceId=${invoiceId}`, { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      if (data?.status) setInvoiceStatus(String(data.status).toUpperCase())
      if (typeof data?.version === "number") setInvoiceVersion(data.version)
    } catch {
      // Non-blocking UI read
    }
  }

  useEffect(() => {
    loadInvoiceStatus()
  }, [invoiceId])

  useEffect(() => {
    let cancelled = false

    async function loadPlanAndUsage() {
      setUsageLoading(true)
      try {
        const [userRes, usageRes] = await Promise.all([
          fetch("/api/user", { credentials: "include" }),
          fetch("/api/usage", { credentials: "include" }),
        ])

        if (cancelled) return

        if (userRes.ok) {
          const userData = await userRes.json()
          setCustomerName(String(userData?.name || ""))
          setCustomerEmail(String(userData?.email || ""))
          setIsPro(Boolean(userData?.isPro))
        }

        if (usageRes.ok) {
          const usageData = await usageRes.json()
          const nextCount = Number(usageData?.count || 0)
          const nextIsPro = Boolean(usageData?.isPro)
          setUsageCount(nextCount)
          setIsPro(nextIsPro)

          if (!nextIsPro && nextCount >= FREE_PLAN_LIMIT) {
            openLimitUpgradeModal("Free plan limit reached")
          }
        }
      } catch {
        if (!cancelled) {
          setIsPro(false)
          setUsageCount(0)
        }
      } finally {
        if (!cancelled) {
          setUsageLoading(false)
        }
      }
    }

    loadPlanAndUsage()
    return () => {
      cancelled = true
    }
  }, [])

  if (!invoiceId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950 p-4">
        <div className="ui-panel p-8 max-w-md border border-gray-200 dark:border-zinc-800">
          <p className="text-red-600">Invalid invoice ID</p>
          <Link href="/documents" className="text-gray-900 dark:text-zinc-100 underline mt-4 inline-block">
            Generate a new document
          </Link>
        </div>
      </div>
    )
  }

  async function handleDownload() {
    if (isFreeLimitReached) {
      openLimitUpgradeModal("You’ve generated all 7 documents included in the free plan.")
      return
    }

    console.log("[DOWNLOAD] Button clicked")
    setIsDownloading(true)
    setDownloadSuccess(false)
    setDownloadError(null)

    try {
      console.log("[DOWNLOAD] Starting fetch to /api/documents/download-zip")
      const docsQuery = requestedDocs ? `&docs=${encodeURIComponent(requestedDocs)}` : ""
      const res = await fetch(`/api/documents/download-zip?invoiceId=${invoiceId}${docsQuery}`, {
        credentials: "include",
      })

      console.log("[DOWNLOAD] Fetch response received, status:", res.status)

      if (!res.ok) {
        const errorPayload = await res.json().catch(async () => ({ message: await res.text() }))
        console.error("[DOWNLOAD] Response not OK, body:", errorPayload)

        const nested = errorPayload?.details || {}
        const message =
          nested?.message ||
          errorPayload?.message ||
          errorPayload?.error ||
          `Request failed (${res.status})`
        const blockers = Array.isArray(errorPayload?.blockers)
          ? errorPayload.blockers
          : Array.isArray(nested?.blockers)
            ? nested.blockers
            : []

        if (res.status === 429 || errorPayload?.error === "FREE_LIMIT_EXCEEDED") {
          openLimitUpgradeModal(errorPayload?.message || "You have reached the free tier limit. Please upgrade to continue.")
          setIsDownloading(false)
          return
        }

        // Special handling for Puppeteer/Chrome missing error
        if (
          message.includes("Could not find Chrome") ||
          message.includes("puppeteer browsers install chrome")
        ) {
          setDownloadError(
            "PDF generation failed because the server-side browser runtime is unavailable. " +
            "This is not related to your local browser (Safari/Chrome). " +
            "If self-hosting, install Chrome for Puppeteer with 'npx puppeteer browsers install chrome'. " +
            "If deployed on Vercel/serverless, verify Chromium runtime packaging and deployment logs."
          )
        } else {
          const blockerText = blockers.length
            ? blockers
                .map(
                  (b: any) =>
                    `• ${b.userMessage || b.message || "Validation issue detected"}${b.resolution ? `\n  Fix: ${b.resolution}` : ""}`
                )
                .join("\n")
            : null
          setDownloadError(
            blockerText
              ? `Download blocked by validation gate:\n\n${blockerText}`
              : `Download failed: ${message}`
          )
        }
        setIsDownloading(false)
        return
      }

      console.log("[DOWNLOAD] Response OK, creating blob")
      const blob = await res.blob()
      console.log("[DOWNLOAD] Blob created, size:", blob.size, "type:", blob.type)

      const includedHeader = res.headers.get("x-included-documents")
      if (includedHeader) {
        try {
          const parsed = JSON.parse(decodeURIComponent(includedHeader))
          if (Array.isArray(parsed) && parsed.length > 0) {
            const normalized = parsed.map((v) => String(v))
            const filtered = requestedDocLabels
              ? normalized.filter((doc: string) => requestedDocLabels.has(doc))
              : normalized
            setIncludedDocs(filtered)
          }
        } catch {
          // non-blocking
        }
      }

      if (blob.size === 0) {
        console.error("[DOWNLOAD] Blob size is 0")
        setDownloadError("Download failed: Empty file")
        setIsDownloading(false)
        return
      }

      const url = window.URL.createObjectURL(blob)
      console.log("[DOWNLOAD] Object URL created:", url)

      const a = document.createElement("a")
      a.href = url
      a.download = "export-documents.zip"
      console.log("[DOWNLOAD] Anchor element created")

      document.body.appendChild(a)
      console.log("[DOWNLOAD] Triggering click")
      a.click()
      console.log("[DOWNLOAD] Click triggered")

      a.remove()
      window.URL.revokeObjectURL(url)
      console.log("[DOWNLOAD] Download complete")

      setDownloadSuccess(true)
      if (!isPro) {
        setUsageCount((prev) => prev + 1)
      }
      await loadInvoiceStatus()
      setIsDownloading(false)
    } catch (err) {
      console.error("[DOWNLOAD] Error caught:", err)
      setDownloadError("Download error: " + (err instanceof Error ? err.message : String(err)))
      setIsDownloading(false)
    }
  }

  async function handleDownloadAllDocxZip() {
    if (!invoiceId) return

    if (!isPro) {
      setUpgradeContext({
        reason: "DOCX_RESTRICTED",
        message: "DOCX ZIP export is available only for Pro users. Upgrade to unlock DOCX downloads.",
      })
      setShowUpgradeModal(true)
      return
    }

    setIsDownloadingDocxZip(true)

    try {
      const docsQuery = requestedDocs ? `&docs=${encodeURIComponent(requestedDocs)}` : ""
      const res = await fetch(`/api/documents/download-docx-zip?invoiceId=${invoiceId}${docsQuery}`)

      if (!res.ok) {
        const errorPayload = await res.json().catch(async () => ({ message: await res.text() }))
        const blockers = Array.isArray(errorPayload?.blockers) ? errorPayload.blockers : []
        const blockerText = blockers.length
          ? blockers
              .map((b: any) => `• [${b.engine}] ${b.code}: ${b.message}${b.resolution ? `\n  Fix: ${b.resolution}` : ""}`)
              .join("\n")
          : null

        if (res.status === 403 && errorPayload?.error?.includes("Pro")) {
          setUpgradeContext({
            reason: "DOCX_RESTRICTED",
            message: errorPayload?.error || "DOCX ZIP export is available only for Pro users.",
          })
          setShowUpgradeModal(true)
        } else {
          alert(
            blockerText
              ? `DOCX ZIP blocked by validation gate:\n\n${blockerText}`
              : errorPayload?.message || "DOCX ZIP download failed"
          )
        }
        setIsDownloadingDocxZip(false)
        return
      }

      const blob = await res.blob()
      if (blob.size === 0) {
        alert("DOCX ZIP download failed: Empty file")
        setIsDownloadingDocxZip(false)
        return
      }

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "export-documents-docx.zip"
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert("DOCX ZIP error: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setIsDownloadingDocxZip(false)
    }
  }

  async function handleDownloadComplianceCertificate() {
    if (!invoiceId) return

    if (isFreeLimitReached) {
      openLimitUpgradeModal("You’ve generated all 7 documents included in the free plan.")
      return
    }

    setIsDownloadingCompliance(true)
    setDownloadError(null)

    try {
      const res = await fetch(`/api/documents/generate-compliance-report/pdf?invoiceId=${invoiceId}&source=manual_button`, {
        credentials: "include",
      })

      if (!res.ok) {
        const errorPayload = await res.json().catch(async () => ({ message: await res.text() }))
        if (res.status === 429 || errorPayload?.error === "FREE_LIMIT_EXCEEDED") {
          openLimitUpgradeModal(errorPayload?.message || "You have reached the free tier limit. Please upgrade to continue.")
          return
        }
        const blockers = Array.isArray(errorPayload?.blockers) ? errorPayload.blockers : []
        const blockerText = blockers.length
          ? blockers
              .map((b: any) => `• [${b.engine}] ${b.code}: ${b.message}${b.resolution ? `\n  Fix: ${b.resolution}` : ""}`)
              .join("\n")
          : null

        setDownloadError(
          blockerText
            ? `Compliance certificate blocked by validation gate:\n\n${blockerText}`
            : errorPayload?.message || "Compliance certificate download failed"
        )
        return
      }

      const blob = await res.blob()
      if (blob.size === 0) {
        setDownloadError("Compliance certificate download failed: Empty file")
        return
      }

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "Compliance_Certificate.pdf"
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setDownloadError("Compliance certificate error: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setIsDownloadingCompliance(false)
    }
  }

  useEffect(() => {
    if (!invoiceId || autoDownloadTriggered) return
    if (autoDownload === "pdf") {
      if (isFreeLimitReached) {
        openLimitUpgradeModal("You’ve generated all 7 documents included in the free plan.")
        setAutoDownloadTriggered(true)
        return
      }
      setAutoDownloadTriggered(true)
      void handleDownload()
      return
    }
    if (autoDownload === "docx") {
      setAutoDownloadTriggered(true)
      void handleDownloadAllDocxZip()
    }
  }, [invoiceId, autoDownload, autoDownloadTriggered, isPro, isFreeLimitReached])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950 p-4">
      <div className="ui-panel rounded-lg max-w-md w-full p-8 border border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
        {!isPro && !usageLoading && (
          <div className="mb-4 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 px-4 py-3 text-sm text-gray-700 dark:text-zinc-200">
            Free plan usage: {usageCount} / {FREE_PLAN_LIMIT} documents used
          </div>
        )}

        {downloadError && (
          <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-800 text-sm whitespace-pre-line">
            <strong className="block mb-1">Download Error</strong>
            {downloadError}
            {downloadError.includes('puppeteer') || downloadError.includes('Chrome browser') ? (
              <>
                <br />
                <span className="block mt-2 text-xs text-red-700">
                  <b>What to do:</b> Contact your administrator or support and share this message. If you are self-hosting, follow the instructions above to install Chrome for Puppeteer.
                </span>
              </>
            ) : null}
          </div>
        )}
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-semibold text-center mb-2 text-gray-900 dark:text-zinc-100">
          Your export documents are ready
        </h1>

        {/* Invoice ID */}
        <p className="text-center text-sm text-gray-500 dark:text-zinc-400 mb-6">
          Invoice ID: <span className="font-mono">{invoiceId.slice(0, 8)}...</span>
        </p>

        <div className="flex items-center justify-center mb-6 gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${badgeConfig[invoiceStatus]?.className || "bg-gray-100 text-gray-700"}`}>
            {badgeConfig[invoiceStatus]?.label || invoiceStatus}
          </span>
          <span className="text-xs text-gray-500 dark:text-zinc-400">v{invoiceVersion}</span>
        </div>

        {/* Documents List */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg">
          <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-3 uppercase tracking-wide">
            Included Documents
          </p>
          <ul className="space-y-2">
            {includedDocsLoading ? (
              <li className="text-sm text-gray-500 dark:text-zinc-500">Loading included documents…</li>
            ) : includedDocs.length > 0 ? (
              includedDocs.map((doc) => (
                <li key={doc} className="text-sm text-gray-700 dark:text-zinc-300 flex items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-zinc-500 rounded-full mr-2.5"></span>
                  {doc}
                </li>
              ))
            ) : (
              <li className="text-sm text-gray-500 dark:text-zinc-500">No documents included</li>
            )}
          </ul>
        </div>

        {/* Primary CTA */}
        <div className="mb-4 flex flex-col items-center gap-2">
          <PrimaryButton
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? "Preparing ZIP…" : "Download all as PDF ZIP"}
          </PrimaryButton>

          <PrimaryButton
            type="button"
            onClick={handleDownloadAllDocxZip}
            disabled={isDownloadingDocxZip}
          >
            {isDownloadingDocxZip ? "Preparing DOCX ZIP…" : "Download all as DOCX ZIP"}
          </PrimaryButton>
        </div>

        <button
          type="button"
          onClick={handleDownloadComplianceCertificate}
          disabled={isDownloadingCompliance}
          className="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-zinc-700 text-gray-800 dark:text-zinc-200 text-sm font-medium rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-zinc-800"
        >
          {isDownloadingCompliance ? "Preparing Compliance Certificate…" : "Download Compliance Certificate"}
        </button>

        {/* Upgrade Modal for DOCX ZIP restriction */}
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          context={upgradeContext}
          title="Free plan limit reached"
          body={"You’ve generated all 7 documents included in the free plan.\n\nUpgrade to Pro to continue generating export documents."}
          benefits={[
            "✓ Unlimited document generation",
            "✓ No watermark",
            "✓ DOCX + ZIP downloads",
            "✓ Dashboard & document history",
          ]}
          primaryLabel="Upgrade to Pro"
          secondaryLabel="Back"
          checkoutConfig={{
            amount: 999,
            customerName,
            customerEmail,
            onSuccess: () => {
              setIsPro(true)
              setShowUpgradeModal(false)
              setUpgradeContext(null)
            },
            onError: (message: string) => {
              setDownloadError(message)
            },
          }}
        />

        {/* Success Message */}
        {downloadSuccess && (
          <p className="text-sm text-green-600 dark:text-green-400 text-center mb-4">
            ✓ Your files have been downloaded successfully
          </p>
        )}

        {/* Secondary Link */}
        <div className="text-center">
          <Link
            href="/documents"
            className="text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 underline"
          >
            Generate another document
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function DownloadPage() {
  return (
    <Suspense fallback={null}>
      <DownloadPageContent />
    </Suspense>
  )
}
