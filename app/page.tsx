"use client"

import Link from "next/link"

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col bg-white dark:bg-zinc-900">

      <section className="flex flex-col items-center justify-center flex-1 text-center px-6 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-gray-50 to-white dark:from-zinc-800 dark:to-zinc-900" />

        <h1 className="text-4xl md:text-5xl font-semibold mb-6 text-gray-900 dark:text-zinc-100 leading-tight">
          Simplify your document workflow
        </h1>

        <p className="text-gray-500 dark:text-zinc-400 max-w-xl mb-10 text-base md:text-lg">
          Create accurate export documents — invoices, packing lists,
          certificates, and more — without agents or paperwork stress.
        </p>

        <Link href="/documents">
          <button className="px-10 py-3 rounded-lg bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-black dark:hover:bg-white transition shadow-sm">
            Get Started
          </button>
        </Link>

        <div className="mt-8 text-sm text-gray-400 dark:text-zinc-500">
          Built for Indian exporters · ICEGATE-aligned drafts · No login required
        </div>
      </section>

      <footer className="text-sm text-gray-400 dark:text-zinc-500 text-center py-6">
        Privacy · Terms · Contact · © {new Date().getFullYear()}
      </footer>
    </main>
  )
}
