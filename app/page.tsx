"use client"

import Link from "next/link"
import PrimaryButton from "../components/PrimaryButton"

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col bg-white dark:bg-zinc-900">

      <section className="flex flex-col items-center justify-center flex-1 text-center px-6 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-gray-50 to-white dark:from-zinc-800 dark:to-zinc-900" />

        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100">
            Generate export documents
          </h1>

          <p className="text-gray-500 dark:text-zinc-400 text-base md:text-lg max-w-xl mx-auto">
            Invoices, packing lists, and more — structured, compliant, and ready for submission.
          </p>

          <PrimaryButton href="/documents">Generate first document</PrimaryButton>

          <p className="mt-4 text-xs tracking-wide text-gray-500 dark:text-zinc-500 text-center">
            Trusted engine · ICEGATE aligned · Bank-safe
          </p>
        </div>
      </section>

      <footer className="text-sm text-gray-400 dark:text-zinc-500 text-center py-6">
        Privacy · Terms · Contact · © {new Date().getFullYear()}
      </footer>
    </main>
  )
}
