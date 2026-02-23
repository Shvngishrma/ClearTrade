"use client"

import { useState } from "react"

type AuthInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string
}

export default function AuthInput({ label, type, ...props }: AuthInputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const isPasswordField = type === "password"
  const inputType = isPasswordField && showPassword ? "text" : type

  return (
    <div className="mb-4">
      <label className="mb-1 block text-sm text-gray-600">
        {label}
      </label>
      <div className="relative">
        <input
          {...props}
          type={inputType}
          className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black ${
            isPasswordField ? "pr-16" : ""
          }`}
        />

        {isPasswordField && (
          <button
            type="button"
            onClick={() => setShowPassword(prev => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-600 hover:text-gray-900"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        )}
      </div>
    </div>
  )
}
