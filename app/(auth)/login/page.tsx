"use client"

import { signIn, useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import AuthCard from "@/components/AuthCard"
import AuthInput from "@/components/AuthInput"
import OAuthButton from "@/components/OAuthButton"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const authError = searchParams.get("error")
    if (!authError) return

    const messageByCode: Record<string, string> = {
      OAuthSignin: "Google sign-in could not be started.",
      OAuthCallback: "Google sign-in callback failed. Check Google Client ID/Secret and authorized redirect URI.",
      OAuthCreateAccount: "Could not create user account from Google login.",
      AccessDenied: "Access denied. Please try again.",
      Callback: "Authentication callback failed. Please try again.",
    }

    setError(messageByCode[authError] || `Login failed: ${authError}`)
  }, [searchParams])

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard")
    }
  }, [status, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    if (res?.error) {
      setError("Invalid email or password")
      setLoading(false)
    } else if (res?.ok) {
      router.push("/dashboard")
    }
  }

  if (status === "loading" || status === "authenticated") return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <AuthCard>
        <h1 className="text-2xl font-semibold text-center">
          Welcome back
        </h1>
        <p className="text-sm text-gray-500 text-center mt-1">
          Log in to your account
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <AuthInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <AuthInput
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full bg-black text-white rounded-md py-2 hover:bg-gray-900 transition disabled:opacity-50"
          >
            {loading ? "Loading..." : "Continue"}
          </button>
        </form>

        <div className="flex items-center gap-4 my-6">
          <div className="h-px bg-gray-200 flex-1" />
          <span className="text-xs text-gray-400">OR</span>
          <div className="h-px bg-gray-200 flex-1" />
        </div>

        <div className="space-y-3">
          <OAuthButton
            provider="google"
            label="Continue with Google"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          />
        </div>

        <div className="mt-6 text-center text-sm">
          Don't have an account?{" "}
          <a href="/signup" className="underline">
            Sign up
          </a>
        </div>

        <div className="text-center mt-2">
          <a href="/forgot-password" className="text-sm underline text-gray-500">
            Forgot password?
          </a>
        </div>
      </AuthCard>
    </div>
  )
}
