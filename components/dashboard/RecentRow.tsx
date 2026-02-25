import Link from "next/link"

export function RecentRow({ invoice, onRemove, isPro }: any) {

  const statusColor = {
    DRAFT: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
    READY: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
    LOCKED: "bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-zinc-200",
    AMENDED: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
    COMPLETED: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
    IN_PROGRESS: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
    PENDING: "bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-zinc-200"
  }

  const invoiceId = invoice.id
  const statusKey = String(invoice.status || "DRAFT") as keyof typeof statusColor
  const createdAtLabel = new Date(invoice.createdAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })

  return (
    <div className="border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl p-4 space-y-3">

      <div className="flex justify-between items-start gap-3">
        <p className="font-medium">
          {invoice.invoiceNumber || `Invoice ${invoice.id.slice(0, 8)}`}
        </p>

        <p className="text-sm text-gray-500 dark:text-zinc-400">
          Generated on {createdAtLabel}
        </p>

        <span
          className={`px-3 py-1 text-xs rounded-full ${statusColor[statusKey] || "bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-zinc-200"}`}
        >
          {String(invoice.status || "DRAFT").replace("_", " ")}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/documents/download?invoiceId=${invoiceId}&status=${invoice.status || "DRAFT"}&autodownload=pdf`}
          className="text-xs px-2.5 py-1.5 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 hover:bg-gray-200 dark:hover:bg-zinc-700"
        >
          Download PDF ZIP
        </Link>

        {isPro && (
          <Link
            href={`/documents/download?invoiceId=${invoiceId}&status=${invoice.status || "DRAFT"}&autodownload=docx`}
            className="text-xs px-2.5 py-1.5 rounded-md bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-black dark:hover:bg-white"
          >
            Download DOCX ZIP
          </Link>
        )}

        <Link
          href={`/documents/download?invoiceId=${invoiceId}&status=${invoice.status}`}
          className="text-xs px-2.5 py-1.5 rounded-md bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-black dark:hover:bg-white"
        >
          Download center
        </Link>

        <button
          type="button"
          onClick={() => onRemove?.(invoiceId)}
          className="text-xs px-2.5 py-1.5 rounded-md border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          Remove
        </button>
      </div>

    </div>
  )
}
