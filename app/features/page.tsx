import Link from "next/link"
import PrimaryButton from "../../components/PrimaryButton"

const FEATURES = [
  {
    title: "One-click document generation",
    description: "Produce structured export documents — invoices, packing lists, and supporting files — in a single controlled workflow.",
  },
  {
    title: "Compliance-first validation",
    description: "Validate against LC terms, HS classification, DGFT restrictions, and cross-document consistency before final output.",
  },
  {
    title: "ZIP + DOCX workflows",
    description: "Export validated document sets as ZIP or editable DOCX for downstream business and banking workflows.",
  },
  {
    title: "Lifecycle control",
    description: "Manage document states — draft, ready, locked, and amended — with version control and audit traceability.",
  },
  {
    title: "Exporter-friendly UX",
    description: "Capture shipment data accurately, validate inputs in real time, and reduce manual errors during drafting.",
  },
  {
    title: "Audit-ready outputs",
    description: "Generate structured outputs with compliance summaries, validation logs, and formats ready for bank and customs review.",
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
          <PrimaryButton href="/documents">
            Generate first document
          </PrimaryButton>
        </div>
      </section>
    </main>
  )
}
