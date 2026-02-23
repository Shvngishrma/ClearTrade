export function StatCard({
  number,
  label
}: {
  number: number
  label: string
}) {
  return (
    <div className="border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl p-6">
      <p className="text-2xl font-semibold">
        {number}
      </p>

      <p className="text-gray-500 dark:text-zinc-400 text-sm">
        {label}
      </p>
    </div>
  )
}
