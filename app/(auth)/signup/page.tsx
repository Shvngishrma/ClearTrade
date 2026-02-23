"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import AuthCard from "@/components/AuthCard"
import AuthInput from "@/components/AuthInput"
import Link from "next/link"
import { signIn } from "next-auth/react"

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        setError("Email already exists or signup failed")
        setLoading(false)
        return
      }

      // Auto-login after signup
      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (signInRes?.error) {
        setError("Signup successful but login failed")
        setLoading(false)
        return
      }

      router.push("/dashboard")
    } catch (err) {
      setError("An error occurred")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <AuthCard>
        <h1 className="text-2xl font-semibold text-center">
          Create account
        </h1>
        <p className="text-sm text-gray-500 text-center mt-1">
          Start your free account
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
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="text-black underline">
            Log in
          </Link>
        </p>
      </AuthCard>
    </div>
  )
}
