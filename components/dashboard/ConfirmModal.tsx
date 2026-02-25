type ConfirmModalProps = {
  title: string
  message: string
  cancelLabel?: string
  confirmLabel: string
  loadingLabel?: string
  isLoading?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmModal({
  title,
  message,
  cancelLabel = "Cancel",
  confirmLabel,
  loadingLabel,
  isLoading = false,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-zinc-400 mb-6">{message}</p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-3 py-2 text-sm rounded-lg bg-gray-900 !text-white dark:bg-zinc-100 dark:!text-zinc-900 hover:bg-black hover:!text-white dark:hover:bg-white dark:hover:!text-zinc-900 disabled:opacity-60"
          >
            {isLoading ? loadingLabel || confirmLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}