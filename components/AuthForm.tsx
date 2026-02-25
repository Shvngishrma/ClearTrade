import type { FormEventHandler, ReactNode } from "react"
import PrimaryButton from "./PrimaryButton"

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

      <PrimaryButton disabled={loading} fullWidth className="py-2 text-sm">
        {loading ? "Please wait…" : buttonText}
      </PrimaryButton>
    </form>
  )
}
