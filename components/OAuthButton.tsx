"use client"

import { FcGoogle } from "react-icons/fc"
import { FaApple } from "react-icons/fa"

const icons: Record<string, React.ReactNode> = {
  google: <FcGoogle size={20} />,
  apple: <FaApple size={18} />,
}

export default function OAuthButton({
  provider,
  label,
  onClick,
}: {
  provider: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-md py-2 hover:bg-gray-50 transition"
    >
      <span className="flex items-center justify-center">
        {icons[provider] || icons.google}
      </span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}
