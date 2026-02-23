export default function PrivacyPage() {
  return (
    <main className="min-h-screen p-6 sm:p-10">
      <div className="max-w-3xl mx-auto ui-panel p-6 sm:p-8">
        <h1 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-zinc-100">Privacy Policy</h1>
        <p className="text-sm text-gray-600 dark:text-zinc-400 mb-6">
          This policy explains how Export SaaS collects, uses, and protects account and document data.
        </p>

        <div className="space-y-4 text-sm text-gray-700 dark:text-zinc-300">
        <section>
          <h2 className="font-medium text-gray-900 dark:text-zinc-100 mb-1">Information collected</h2>
          <p>We store account identity details and export document data required to provide the service.</p>
        </section>

        <section>
          <h2 className="font-medium text-gray-900 dark:text-zinc-100 mb-1">How data is used</h2>
          <p>Data is used to authenticate users, generate requested documents, and support compliance workflows.</p>
        </section>

        <section>
          <h2 className="font-medium text-gray-900 dark:text-zinc-100 mb-1">Contact</h2>
          <p>
            For privacy questions, email {" "}
            <a className="underline" href="mailto:support@exportsaas.com">support@exportsaas.com</a>.
          </p>
        </section>
        </div>
      </div>
    </main>
  )
}
