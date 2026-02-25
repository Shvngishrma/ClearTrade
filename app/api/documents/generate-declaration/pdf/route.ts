import { DocumentGenerationError, generateDeclarationPdfBuffer } from "@/lib/documentPdfService"
import { checkUsage, incrementUsage } from "@/lib/usage"
import { lockInvoiceOnFirstPdfDownload } from "@/lib/documentLifecycle"
import { NextResponse } from "next/server"

function toErrorResponse(error: unknown) {
  if (error instanceof DocumentGenerationError) {
    return NextResponse.json(error.payload, { status: error.status })
  }

  return NextResponse.json(
    {
      error: "DECLARATION_PDF_GENERATION_FAILED",
      message: error instanceof Error ? error.message : "Unable to generate declaration PDF",
    },
    { status: 500 }
  )
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const invoiceId = searchParams.get("invoiceId")
  const type = searchParams.get("type") || "fema"

  if (!invoiceId) {
    return new NextResponse("Missing invoiceId", { status: 400 })
  }

  const isInternalZip = req.headers.get("x-internal-zip") === "1"

  try {
    const usage = !isInternalZip ? await checkUsage() : undefined
    const pdf = await generateDeclarationPdfBuffer(invoiceId, {
      usage,
      type,
    })

    if (!isInternalZip) {
      await incrementUsage()
    }

    await lockInvoiceOnFirstPdfDownload(invoiceId)

    return new NextResponse(Buffer.from(pdf) as any, {
      headers: { "Content-Type": "application/pdf" },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
