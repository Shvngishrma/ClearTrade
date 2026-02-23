import Link from "next/link"

export default function AuthHeader() {
  return (
    <div className="absolute top-6 left-6">
      <Link href="/" className="text-sm text-gray-600 hover:text-black">
        ← Home
      </Link>
    </div>
  )
}
