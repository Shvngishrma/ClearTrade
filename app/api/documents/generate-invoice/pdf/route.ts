import { DocumentGenerationError, generateInvoicePdfBuffer } from "@/lib/documentPdfService"
import { checkUsage, incrementUsage } from "@/lib/usage"
import { lockInvoiceOnFirstPdfDownload } from "@/lib/documentLifecycle"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

function toErrorResponse(error: unknown) {
  if (error instanceof DocumentGenerationError) {
    return NextResponse.json(error.payload, { status: error.status })
  }

  return NextResponse.json(
    {
      error: "INVOICE_PDF_GENERATION_FAILED",
      message: error instanceof Error ? error.message : "Unable to generate invoice PDF",
    },
    { status: 500 }
  )
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const invoiceId = searchParams.get("invoiceId")

  if (!invoiceId) {
    return new NextResponse("Missing invoiceId", { status: 400 })
  }

  const isInternalZip = req.headers.get("x-internal-zip") === "1"

  try {
    const usage = !isInternalZip ? await checkUsage() : undefined
    const pdfData = await generateInvoicePdfBuffer(invoiceId, { usage })

    if (!isInternalZip) {
      await incrementUsage()
    }

    await lockInvoiceOnFirstPdfDownload(invoiceId)

    return new NextResponse(Buffer.from(pdfData) as any, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Commercial_Invoice_${invoiceId}.pdf"`,
      },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
