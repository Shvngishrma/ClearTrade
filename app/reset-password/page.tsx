"use client"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import AuthCard from "@/components/AuthCard"
import AuthInput from "@/components/AuthInput"
import AuthForm from "@/components/AuthForm"
import Link from "next/link"

export default function ResetPassword() {
  const token = useSearchParams().get("token")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    })

    if (!res.ok) {
      setError("Invalid or expired reset link")
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <AuthCard title="Reset password" subtitle="Create a new password">
        {success ? (
          <p className="text-sm text-green-600">Password reset successful! <Link href="/login" className="underline">Log in</Link></p>
        ) : (
          <AuthForm
            onSubmit={submit}
            loading={loading}
            error={error}
            buttonText="Reset password"
          >
            <AuthInput
              label="New password"
              type="password"
              onChange={e => setPassword(e.target.value)}
            />
          </AuthForm>
        )}
      </AuthCard>
    </div>
  )
}
