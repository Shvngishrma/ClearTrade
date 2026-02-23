"use client"

import { useState } from "react"
import AuthCard from "@/components/AuthCard"
import AuthInput from "@/components/AuthInput"
import AuthForm from "@/components/AuthForm"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function ForgotPassword() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [previewResetUrl, setPreviewResetUrl] = useState("")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setPreviewResetUrl("")

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })

    const payload = await res.json().catch(() => ({}))

    if (payload?.redirectToSignup || payload?.error === "USER_NOT_FOUND") {
      router.push("/signup")
      setLoading(false)
      return
    }

    if (!res.ok) {
      setError(payload.message || "Failed to send reset link")
      setLoading(false)
      return
    }

    if (typeof payload?.resetUrl === "string" && payload.resetUrl) {
      setPreviewResetUrl(payload.resetUrl)
    }

    setSuccess(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <AuthCard title="Forgot password" subtitle="We’ll email you a reset link">
        {success ? (
          <div className="space-y-3">
            <p className="text-sm text-green-600">
              If an account exists for this email, a reset link has been sent. Check your inbox and spam.
            </p>
            {previewResetUrl && (
              <div className="text-sm rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                <p className="font-medium">Email preview mode:</p>
                <p className="mt-1 break-all">
                  Open reset link: <a className="underline" href={previewResetUrl}>{previewResetUrl}</a>
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            <AuthForm
              onSubmit={submit}
              loading={loading}
              error={error}
              buttonText="Send reset link"
            >
              <AuthInput label="Email" onChange={e => setEmail(e.target.value)} />
            </AuthForm>

            <p className="mt-6 text-center text-sm text-gray-500 dark:text-zinc-400">
              Remembered your password?{" "}
              <Link href="/login" className="text-black dark:text-zinc-100 underline">
                Log in
              </Link>
            </p>
          </>
        )}
      </AuthCard>
    </div>
  )
}
