import JSZip from "jszip"
import { prisma } from "@/lib/db"
import { checkUsage } from "@/lib/usage"
import { validateBeforeRelease } from "@/lib/preSubmissionValidationGate"

const DOCX_ROUTES: Record<string, string> = {
  invoice: "/api/documents/generate-invoice/docx",
  packingList: "/api/documents/generate-packing-list/docx",
  shippingBill: "/api/documents/generate-shipping-bill/docx",
  declaration: "/api/documents/generate-declaration/docx",
  coo: "/api/documents/generate-coo/docx",
  insurance: "/api/documents/generate-insurance/docx",
  lc: "/api/documents/generate-lc/docx",
}

const FILE_NAMES: Record<string, string> = {
  invoice: "Commercial_Invoice.docx",
  packingList: "Packing_List.docx",
  shippingBill: "Shipping_Bill_Draft.docx",
  declaration: "Export_Declaration.docx",
  coo: "Certificate_of_Origin.docx",
  insurance: "Insurance_Certificate.docx",
  lc: "LC_Summary.docx",
}

function parseRequestedDocs(raw: string | null): string[] {
  if (!raw) return []

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value in DOCX_ROUTES)
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const invoiceId = searchParams.get("invoiceId")
    const requestedDocs = parseRequestedDocs(searchParams.get("docs"))

    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "Missing invoiceId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const usage = await checkUsage()
    if (!usage.isPro) {
      return new Response(
        JSON.stringify({ error: "DOCX export is available only for Pro users. Please upgrade to access this feature." }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        packingLists: true,
        shippingBills: true,
        certificatesOfOrigin: true,
        insurances: true,
        declarations: true,
        lettersOfCredit: true,
      },
    })

    if (!invoice) {
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
          message: "Critical validation failed. Fix issues before DOCX ZIP download.",
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

    const availableDocs = Object.keys(DOCX_ROUTES).filter((doc) => {
      if (doc === "invoice") {
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

    const docsToFetch = requestedDocs.length > 0
      ? availableDocs.filter((doc) => requestedDocs.includes(doc))
      : availableDocs

    const zip = new JSZip()
    const baseUrl = new URL(req.url).origin

    for (const doc of docsToFetch) {
      const url = `${baseUrl}${DOCX_ROUTES[doc]}?invoiceId=${invoiceId}`

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
            error: "DOCX_GENERATION_BLOCKED",
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
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" })

    if (zipBuffer.length === 0) {
      return new Response(JSON.stringify({ error: "No documents to download" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="export-documents-docx.zip"',
        "Content-Length": zipBuffer.length.toString(),
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: "DOCX ZIP generation failed", details: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
