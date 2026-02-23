type AuthCardProps = {
  children: React.ReactNode
  title?: string
  subtitle?: string
}

export default function AuthCard({ children, title, subtitle }: AuthCardProps) {
  return (
    <div className="w-full max-w-md ui-panel p-8">
      {title && <h1 className="text-2xl font-semibold text-center text-gray-900 dark:text-zinc-100">{title}</h1>}
      {subtitle && <p className="text-sm text-gray-500 dark:text-zinc-400 text-center mt-1">{subtitle}</p>}
      {children}
    </div>
  )
}
