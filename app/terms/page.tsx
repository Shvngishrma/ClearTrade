export default function TermsPage() {
  return (
    <main className="min-h-screen p-6 sm:p-10">
      <div className="max-w-3xl mx-auto ui-panel p-6 sm:p-8">
        <h1 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-zinc-100">Terms of Service</h1>
        <p className="text-sm text-gray-600 dark:text-zinc-400 mb-6">
          These terms govern your use of Export SaaS and document generation services.
        </p>

        <div className="space-y-4 text-sm text-gray-700 dark:text-zinc-300">
        <section>
          <h2 className="font-medium text-gray-900 dark:text-zinc-100 mb-1">Service usage</h2>
          <p>You are responsible for the accuracy and legality of all data submitted for document generation.</p>
        </section>

        <section>
          <h2 className="font-medium text-gray-900 dark:text-zinc-100 mb-1">Subscriptions and access</h2>
          <p>Some features may require a paid subscription. Plan details and availability may change over time.</p>
        </section>

        <section>
          <h2 className="font-medium text-gray-900 dark:text-zinc-100 mb-1">Contact</h2>
          <p>
            For terms-related questions, email {" "}
            <a className="underline" href="mailto:support@exportsaas.com">support@exportsaas.com</a>.
          </p>
        </section>
        </div>
      </div>
    </main>
  )
}
