"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { StatCard } from "@/components/dashboard/StatCard"
import { RecentRow } from "@/components/dashboard/RecentRow"
import { ConfirmModal } from "@/components/dashboard/ConfirmModal"

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
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [recentInvoices, setRecentInvoices] = useState<InvoiceRow[]>([])
  const [totalDocs, setTotalDocs] = useState(0)
  const [inProgress, setInProgress] = useState(0)
  const [pending, setPending] = useState(0)
  const [isClearing, setIsClearing] = useState(false)
  const [showClearAllModal, setShowClearAllModal] = useState(false)
  const [invoiceIdToRemove, setInvoiceIdToRemove] = useState<string | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const isPro = Boolean(session?.user?.isPro)
  const displayName = session?.user?.name?.trim() || "User"

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
    loadDashboard()
  }, [])

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
    <div className="p-8 space-y-8 max-w-5xl mx-auto text-gray-900 dark:text-zinc-100 rounded-2xl">

      {invoiceIdToRemove && (
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

      {showClearAllModal && (
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

      {/* Greeting */}
      <h1 className="text-2xl font-semibold">
        Welcome, {displayName}
      </h1>


      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-6">

        <StatCard
          number={totalDocs}
          label="Documents generated this month"
        />

        <StatCard
          number={inProgress}
          label="Automations in progress"
        />

        <StatCard
          number={pending}
          label="Pending actions"
        />

      </div>


      {/* CTA */}
      <div>
        <a
          href="/documents"
          className="bg-gray-200 hover:bg-gray-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-6 py-3 rounded-xl font-medium"
        >
          Create new document
        </a>
      </div>


      {/* Recent Activity */}
      <div className="space-y-4">

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            Recent Activity (latest 7)
          </h2>

          <button
            type="button"
            onClick={() => setShowClearAllModal(true)}
            disabled={isClearing || recentInvoices.length === 0}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isClearing ? "Clearing…" : "Clear all"}
          </button>
        </div>

        <div className="space-y-3">

          {recentInvoices.map(invoice => (
            <RecentRow
              key={invoice.id}
              invoice={invoice}
              onRemove={handleRemove}
              isPro={isPro}
            />
          ))}

          {!loading && recentInvoices.length === 0 && (
            <div className="border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl p-4 text-sm text-gray-500 dark:text-zinc-400">
              No generated invoices yet.
            </div>
          )}

        </div>

      </div>

    </div>
  )
}
