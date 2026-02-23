import type { FormEventHandler, ReactNode } from "react"

type AuthFormProps = {
  onSubmit: FormEventHandler<HTMLFormElement>
  loading: boolean
  error?: string
  buttonText: string
  children: ReactNode
}

export default function AuthForm({
  onSubmit,
  loading,
  error,
  buttonText,
  children,
}: AuthFormProps) {
  return (
    <form onSubmit={onSubmit}>
      {children}

      {error && (
        <p className="mb-3 text-sm text-red-500">{error}</p>
      )}

      <button
        disabled={loading}
        className="w-full rounded-md bg-black py-2 text-sm text-white disabled:opacity-50"
      >
        {loading ? "Please wait…" : buttonText}
      </button>
    </form>
  )
}
