"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { StatCard } from "@/components/dashboard/StatCard"
import { RecentRow } from "@/components/dashboard/RecentRow"
import { ConfirmModal } from "@/components/dashboard/ConfirmModal"
import PrimaryButton from "../../../components/PrimaryButton"
import RazorpayCheckout from "@/components/RazorpayCheckout"

type InvoiceRow = {
  id: string
  invoiceNumber: string
  createdAt: string
  status: string
  packingLists: Array<{ id: string }>
  shippingBills: Array<{ id: string }>
  declarations: Array<{ id: string }>
  certificatesOfOrigin: Array<{ id: string }>
  insurances: Array<{ id: string }>
  lettersOfCredit: Array<{ id: string }>
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [recentInvoices, setRecentInvoices] = useState<InvoiceRow[]>([])
  const [totalDocs, setTotalDocs] = useState(0)
  const [inProgress, setInProgress] = useState(0)
  const [pending, setPending] = useState(0)
  const [isClearing, setIsClearing] = useState(false)
  const [showClearAllModal, setShowClearAllModal] = useState(false)
  const [invoiceIdToRemove, setInvoiceIdToRemove] = useState<string | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const isPro = Boolean(session?.user?.isPro)
  const previewMode = !isPro
  const displayName = session?.user?.name?.trim() || "User"
  const customerName = session?.user?.name?.trim() || ""
  const customerEmail = session?.user?.email?.trim() || ""

  const previewInvoices: InvoiceRow[] = [
    {
      id: "preview-1",
      invoiceNumber: "INV/2026/1001",
      createdAt: new Date().toISOString(),
      status: "READY",
      packingLists: [{ id: "p1" }],
      shippingBills: [{ id: "s1" }],
      declarations: [],
      certificatesOfOrigin: [{ id: "c1" }],
      insurances: [{ id: "i1" }],
      lettersOfCredit: [],
    },
    {
      id: "preview-2",
      invoiceNumber: "INV/2026/0998",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      status: "LOCKED",
      packingLists: [{ id: "p2" }],
      shippingBills: [{ id: "s2" }],
      declarations: [{ id: "d2" }],
      certificatesOfOrigin: [],
      insurances: [],
      lettersOfCredit: [{ id: "l2" }],
    },
  ]

  const visibleInvoices = previewMode ? previewInvoices : recentInvoices
  const displayTotalDocs = previewMode ? 128 : totalDocs
  const displayInProgress = previewMode ? 6 : inProgress
  const displayPending = previewMode ? 3 : pending

  async function loadDashboard() {
    setLoading(true)
    try {
      const [invoicesRes, statsRes] = await Promise.all([
        fetch("/api/dashboard/recent", { credentials: "include" }),
        fetch("/api/dashboard/stats", { credentials: "include" }),
      ])

      if (invoicesRes.ok) {
        const data = await invoicesRes.json()
        setRecentInvoices(Array.isArray(data?.invoices) ? data.invoices : [])
      }

      if (statsRes.ok) {
        const stats = await statsRes.json()
        setTotalDocs(Number(stats?.totalDocs || 0))
        setInProgress(Number(stats?.inProgress || 0))
        setPending(Number(stats?.pending || 0))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status === "loading") return
    if (!session?.user) return

    if (!session.user.isPro) {
      setLoading(false)
      return
    }

    loadDashboard()
  }, [session, status])

  if (status === "loading") {
    return (
      <div className="p-8 max-w-3xl mx-auto text-gray-900 dark:text-zinc-100">
        <p className="text-sm text-gray-500 dark:text-zinc-400">Loading dashboard...</p>
      </div>
    )
  }

  async function handleRemove(invoiceId: string) {
    setInvoiceIdToRemove(invoiceId)
  }

  async function confirmRemove() {
    if (!invoiceIdToRemove) return

    setIsRemoving(true)
    try {
      const res = await fetch(`/api/dashboard/history?invoiceId=${invoiceIdToRemove}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (!res.ok) {
        const payload = await res.json().catch(async () => ({ message: await res.text() }))
        throw new Error(payload?.error || payload?.message || "Remove failed")
      }

      setInvoiceIdToRemove(null)
      await loadDashboard()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Remove failed")
    } finally {
      setIsRemoving(false)
    }
  }

  async function confirmClearAll() {
    setIsClearing(true)
    try {
      const res = await fetch("/api/dashboard/history/clear", {
        method: "DELETE",
        credentials: "include",
      })

      if (!res.ok) {
        const payload = await res.json().catch(async () => ({ message: await res.text() }))
        throw new Error(payload?.error || payload?.message || "Clear all failed")
      }

      setShowClearAllModal(false)
      await loadDashboard()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Clear all failed")
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="p-8 space-y-6 max-w-5xl mx-auto text-gray-900 dark:text-zinc-100 rounded-2xl">
      {isPro && invoiceIdToRemove && (
        <ConfirmModal
          title="Remove document"
          message="Remove this generated document from dashboard history?"
          confirmLabel="Remove"
          loadingLabel="Removing…"
          isLoading={isRemoving}
          onCancel={() => setInvoiceIdToRemove(null)}
          onConfirm={confirmRemove}
        />
      )}

      {isPro && showClearAllModal && (
        <ConfirmModal
          title="Clear all documents"
          message="Remove all saved generated documents from dashboard history?"
          confirmLabel="Clear all"
          loadingLabel="Clearing…"
          isLoading={isClearing}
          onCancel={() => setShowClearAllModal(false)}
          onConfirm={confirmClearAll}
        />
      )}

      <h1 className="text-2xl font-semibold">Welcome, {displayName}</h1>

      {previewMode && (
        <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100">
            <span className="text-zinc-400">🔒</span> Pro Dashboard
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-zinc-300">
            Upgrade to unlock export analytics and document history.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
            <li>• Track document generation</li>
            <li>• Access invoice history</li>
            <li>• Export analytics</li>
            <li>• Download past documents</li>
          </ul>
          {paymentError && (
            <div className="mt-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-200">
              {paymentError}
            </div>
          )}
          <div className="mt-5 flex items-center gap-4">
            <RazorpayCheckout
              amount={999}
              customerName={customerName}
              customerEmail={customerEmail}
              buttonLabel="Upgrade to Pro"
              onPaymentSuccess={() => {
                setPaymentError(null)
                router.refresh()
              }}
              onPaymentError={(message: string) => setPaymentError(message)}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-zinc-700 border border-zinc-700 text-white hover:bg-zinc-600 disabled:opacity-60 disabled:cursor-not-allowed inline-block text-center font-medium transition-colors"
            />
            <a
              href="/pricing"
              className="ml-1 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              View pricing →
            </a>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            You have 7 free document generations.
            Upgrade for unlimited access.
          </p>
        </div>
      )}

      {previewMode && <div className="border-t border-gray-200 dark:border-zinc-700 my-1" />}

      <div>
        {previewMode && (
          <div className="mb-4">
            <h2 className="text-base font-medium text-gray-700 dark:text-zinc-300">Dashboard Preview</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-500">Pro feature</p>
          </div>
        )}

        <div className={previewMode ? "filter blur-[1.5px] pointer-events-none opacity-85 select-none" : ""}>
          <div className="grid grid-cols-3 gap-6">
            <div className="relative">
              {previewMode && <span className="absolute top-2 right-2 z-10 text-[11px] px-2 py-0.5 rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-300">🔒 Pro</span>}
              <StatCard number={displayTotalDocs} label="Documents generated this month" />
            </div>

            <div className="relative">
              {previewMode && <span className="absolute top-2 right-2 z-10 text-[11px] px-2 py-0.5 rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-300">🔒 Pro</span>}
              <StatCard number={displayInProgress} label="Automations in progress" />
            </div>

            <div className="relative">
              {previewMode && <span className="absolute top-2 right-2 z-10 text-[11px] px-2 py-0.5 rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-300">🔒 Pro</span>}
              <StatCard number={displayPending} label="Pending actions" />
            </div>
          </div>

          <div className="mt-8">
            <PrimaryButton href="/documents">Create new document</PrimaryButton>
          </div>

          <div className="space-y-4 mt-8">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                {previewMode ? "Recent Activity (Pro only)" : "Recent Activity (latest 7)"}
              </h2>

              <button
                type="button"
                onClick={() => {
                  if (previewMode) return
                  setShowClearAllModal(true)
                }}
                disabled={previewMode || isClearing || recentInvoices.length === 0}
                className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {previewMode ? "Pro only" : isClearing ? "Clearing…" : "Clear all"}
              </button>
            </div>

            <div className="space-y-3">
              {visibleInvoices.map((invoice) => (
                <RecentRow
                  key={invoice.id}
                  invoice={invoice}
                  onRemove={previewMode ? undefined : handleRemove}
                  isPro={isPro}
                />
              ))}

              {!loading && visibleInvoices.length === 0 && (
                <div className="border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl p-4 text-sm text-gray-500 dark:text-zinc-400">
                  No generated invoices yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
