import Link from "next/link"
import PrimaryButton from "../../components/PrimaryButton"

const FEATURES = [
  {
    title: "One-click document generation",
    description: "Generate commercial invoice, packing list, shipping bill, COO, insurance, and LC support docs from one workflow.",
  },
  {
    title: "Compliance-first validation",
    description: "Built-in checks for LC terms, HS format rules, cross-document consistency, and release blockers before final download.",
  },
  {
    title: "ZIP + DOCX workflows",
    description: "Download complete document bundles as ZIP and unlock DOCX export for editable business document operations.",
  },
  {
    title: "Lifecycle control",
    description: "Track DRAFT, READY, LOCKED, and AMENDED states with controlled versioning and traceable document integrity.",
  },
  {
    title: "Exporter-friendly UX",
    description: "Auto-fill shipment details, structural field validation, and guided corrections to reduce manual errors while drafting.",
  },
  {
    title: "Audit-ready outputs",
    description: "Generate compliance certificates, proof layers, and structured report sections designed for operational and banking review.",
  },
]

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-zinc-900">
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 dark:text-zinc-100 mb-4">Features</h1>
          <p className="text-gray-500 dark:text-zinc-400 max-w-2xl mx-auto text-base md:text-lg">
            Everything you need to draft, validate, and deliver export documents with confidence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="border border-gray-200 dark:border-zinc-700 rounded-xl p-5 bg-gray-50 dark:bg-zinc-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">{feature.title}</h2>
              <p className="text-sm text-gray-600 dark:text-zinc-300 leading-6">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <PrimaryButton href="/documents" className="px-8">
            Start generating documents
          </PrimaryButton>
        </div>
      </section>
    </main>
  )
}
