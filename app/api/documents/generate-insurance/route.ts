import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()

  const policyNumber = String(body.policyNumber || "").trim()
  const policyNumberPattern = /^[A-Z0-9][A-Z0-9/-]{4,28}[A-Z0-9]$/i

  if (!policyNumber) {
    return new NextResponse(
      JSON.stringify({
        error: "VALIDATION_ERROR",
        message: "Policy number is required for insurance declaration.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  if (!policyNumberPattern.test(policyNumber)) {
    return new NextResponse(
      JSON.stringify({
        error: "VALIDATION_ERROR",
        message: "Policy number format invalid. Use 6-30 characters: letters, numbers, '/' or '-' (example: POL-2026-001).",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  const insurance = await prisma.insurance.create({
    data: {
      invoiceId: body.invoiceId,
      policyNumber,
      insuredValue: body.insuredValue,
    },
  })

  return NextResponse.json(insurance)
}
