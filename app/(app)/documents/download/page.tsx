"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

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

function DownloadPageContent() {
  const router = useRouter()
  const params = useSearchParams()
  const invoiceId = params.get("invoiceId")
  const initialStatus = (params.get("status") || "DRAFT").toUpperCase()
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDownloadingDocxZip, setIsDownloadingDocxZip] = useState(false)
  const [downloadSuccess, setDownloadSuccess] = useState(false)
  const [invoiceStatus, setInvoiceStatus] = useState(initialStatus)
  const [invoiceVersion, setInvoiceVersion] = useState<number>(1)
  const [isPro, setIsPro] = useState(false)

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

    async function loadUserPlan() {
      try {
        const res = await fetch("/api/user", { credentials: "include" })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled) {
          setIsPro(Boolean(data?.isPro))
        }
      } catch {
        if (!cancelled) {
          setIsPro(false)
        }
      }
    }

    loadUserPlan()
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
    console.log("[DOWNLOAD] Button clicked")
    setIsDownloading(true)
    setDownloadSuccess(false)

    try {
      console.log("[DOWNLOAD] Starting fetch to /api/documents/download-zip")
      const res = await fetch(`/api/documents/download-zip?invoiceId=${invoiceId}`)

      console.log("[DOWNLOAD] Fetch response received, status:", res.status)

      if (!res.ok) {
        const errorPayload = await res.json().catch(async () => ({ message: await res.text() }))
        console.error("[DOWNLOAD] Response not OK, body:", errorPayload)

        const blockers = Array.isArray(errorPayload?.blockers) ? errorPayload.blockers : []
        const blockerText = blockers.length
          ? blockers.map((b: any) => `• [${b.engine}] ${b.code}: ${b.message}${b.resolution ? `\n  Fix: ${b.resolution}` : ""}`).join("\n")
          : null

        alert(
          blockerText
            ? `Download blocked by validation gate:\n\n${blockerText}`
            : `Download failed: ${errorPayload?.message || res.status}`
        )
        setIsDownloading(false)
        return
      }

      console.log("[DOWNLOAD] Response OK, creating blob")
      const blob = await res.blob()
      console.log("[DOWNLOAD] Blob created, size:", blob.size, "type:", blob.type)

      if (blob.size === 0) {
        console.error("[DOWNLOAD] Blob size is 0")
        alert("Download failed: Empty file")
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
      await loadInvoiceStatus()
      setIsDownloading(false)
    } catch (err) {
      console.error("[DOWNLOAD] Error caught:", err)
      alert("Download error: " + (err instanceof Error ? err.message : String(err)))
      setIsDownloading(false)
    }
  }

  async function handleDownloadAllDocxZip() {
    if (!invoiceId) return

    if (!isPro) {
      router.push("/pricing")
      return
    }

    setIsDownloadingDocxZip(true)

    try {
      const res = await fetch(`/api/documents/download-docx-zip?invoiceId=${invoiceId}`)

      if (!res.ok) {
        const errorPayload = await res.json().catch(async () => ({ message: await res.text() }))
        const blockers = Array.isArray(errorPayload?.blockers) ? errorPayload.blockers : []
        const blockerText = blockers.length
          ? blockers
              .map((b: any) => `• [${b.engine}] ${b.code}: ${b.message}${b.resolution ? `\n  Fix: ${b.resolution}` : ""}`)
              .join("\n")
          : null

        alert(
          blockerText
            ? `DOCX ZIP blocked by validation gate:\n\n${blockerText}`
            : errorPayload?.message || "DOCX ZIP download failed"
        )
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950 p-4">
      <div className="ui-panel rounded-lg max-w-md w-full p-8 border border-gray-200 dark:border-zinc-800 shadow-sm dark:shadow-none">
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
            {DOCUMENT_TYPES.map((doc) => (
              <li key={doc} className="text-sm text-gray-700 dark:text-zinc-300 flex items-center">
                <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-zinc-500 rounded-full mr-2.5"></span>
                {doc}
              </li>
            ))}
          </ul>
        </div>

        {/* Primary CTA */}
        <button
          type="button"
          onClick={handleDownload}
          disabled={isDownloading}
          className="w-full px-4 py-3 bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:bg-black dark:hover:bg-white mb-4"
        >
          {isDownloading ? "Preparing ZIP…" : "Download all as ZIP"}
        </button>

        <button
          type="button"
          onClick={handleDownloadAllDocxZip}
          disabled={isDownloadingDocxZip}
          className="w-full mt-2 px-3 py-2 bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-medium rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:bg-black dark:hover:bg-white"
        >
          {isDownloadingDocxZip ? "Preparing DOCX ZIP…" : "Download all as DOCX ZIP"}
        </button>

        {!isPro && (
          <p className="text-xs text-center text-amber-700 dark:text-amber-400 mb-4">
            DOCX download is available on Pro. <Link href="/pricing" className="underline hover:opacity-80">Upgrade</Link>
          </p>
        )}

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
