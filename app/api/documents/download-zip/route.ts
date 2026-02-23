import JSZip from "jszip"
import { prisma } from "@/lib/db"
import { checkUsage, incrementUsage } from "@/lib/usage"
import { validateBeforeRelease } from "@/lib/preSubmissionValidationGate"
import { lockInvoiceOnFirstPdfDownload } from "@/lib/documentLifecycle"

const DOC_ROUTES: Record<string, string> = {
  invoice: "/api/documents/generate-invoice/pdf",
  packingList: "/api/documents/generate-packing-list/pdf",
  shippingBill: "/api/documents/generate-shipping-bill/pdf",
  declaration: "/api/documents/generate-declaration/pdf",
  coo: "/api/documents/generate-coo/pdf",
  insurance: "/api/documents/generate-insurance/pdf",
  lc: "/api/documents/generate-lc/pdf",
  complianceReport: "/api/documents/generate-compliance-report/pdf",
}

const FILE_NAMES: Record<string, string> = {
  invoice: "Commercial_Invoice.pdf",
  packingList: "Packing_List.pdf",
  shippingBill: "Shipping_Bill_Draft.pdf",
  declaration: "Declaration.pdf",
  coo: "Certificate_of_Origin_Draft.pdf",
  insurance: "Insurance_Declaration.pdf",
  lc: "LC_Supporting_Document.pdf",
  complianceReport: "Compliance_Certificate.pdf",
}

export async function GET(req: Request) {
  console.log("[ZIP] GET /api/documents/download-zip called")

  try {
    const { searchParams } = new URL(req.url)
    const invoiceId = searchParams.get("invoiceId")

    console.log("[ZIP] invoiceId from query:", invoiceId)

    if (!invoiceId) {
      console.error("[ZIP] Missing invoiceId")
      return new Response(JSON.stringify({ error: "Missing invoiceId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Verify invoice exists
    console.log("[ZIP] Fetching invoice from DB:", invoiceId)
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: true,
        packingLists: true,
        shippingBills: true,
        certificatesOfOrigin: true,
        insurances: true,
        declarations: true,
        lettersOfCredit: true,
      },
    })

    if (!invoice) {
      console.error("[ZIP] Invoice not found:", invoiceId)
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    const validation = await validateBeforeRelease(invoiceId)
    if (!validation.canRelease) {
      return new Response(
        JSON.stringify({
          error: "PRE_SUBMISSION_VALIDATION_FAILED",
          message: "Critical validation failed. Fix issues before ZIP download.",
          blockers: validation.blockers,
          warnings: validation.warnings,
          engines: validation.engines,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    console.log("[ZIP] Invoice found, creating ZIP")
    const zip = new JSZip()
    const baseUrl = new URL(req.url).origin

    const docsToFetch = Object.keys(DOC_ROUTES).filter((doc) => {
      if (doc === "invoice" || doc === "complianceReport") {
        return true
      }

      if (doc === "packingList") return invoice.packingLists.length > 0
      if (doc === "shippingBill") return invoice.shippingBills.length > 0
      if (doc === "declaration") return invoice.declarations.length > 0
      if (doc === "coo") return invoice.certificatesOfOrigin.length > 0
      if (doc === "insurance") return invoice.insurances.length > 0
      if (doc === "lc") return invoice.lettersOfCredit.length > 0

      return false
    })

    console.log("[ZIP] Docs to fetch:", docsToFetch)
    let filesAdded = 0

    await checkUsage()

    for (const doc of docsToFetch) {
      const url = `${baseUrl}${DOC_ROUTES[doc]}?invoiceId=${invoiceId}`

      console.log(`[ZIP] Fetching ${doc} from:`, url)

      try {
        const res = await fetch(url, {
          headers: {
            cookie: req.headers.get("cookie") ?? "",
            "x-internal-zip": "1",
          },
        })

        if (!res.ok) {
          const errorPayload = await res.json().catch(async () => ({ message: await res.text() }))
          return new Response(
            JSON.stringify({
              error: "PDF_GENERATION_BLOCKED",
              document: doc,
              status: res.status,
              details: errorPayload,
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          )
        }

        const buffer = Buffer.from(await res.arrayBuffer())
        zip.file(FILE_NAMES[doc], buffer)
        filesAdded++
        console.log(`[ZIP] Added ${doc} (${buffer.length} bytes)`)
      } catch (err) {
        console.error(`[ZIP] Error fetching ${doc}:`, err)
      }
    }

    console.log(`[ZIP] Generating ZIP with ${filesAdded} files`)
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" })

    console.log(`[ZIP] ZIP buffer generated, size: ${zipBuffer.length} bytes`)

    if (zipBuffer.length === 0) {
      console.error("[ZIP] Generated ZIP is empty!")
      return new Response(
        JSON.stringify({
          error: "No documents to download",
          filesAdded,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    console.log(`[ZIP] Returning ZIP file (${zipBuffer.length} bytes)`)

    await incrementUsage()
    await lockInvoiceOnFirstPdfDownload(invoiceId)

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="export-documents.zip"',
        "Content-Length": zipBuffer.length.toString(),
      },
    })
  } catch (err) {
    console.error("[ZIP] Error:", err)
    return new Response(JSON.stringify({ error: "ZIP generation failed", details: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
