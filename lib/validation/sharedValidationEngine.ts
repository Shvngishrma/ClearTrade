export type SharedValidationError = {
  field: string
  code: string
  message: string
}

export type SharedValidationResult = {
  valid: boolean
  errors: SharedValidationError[]
}

export type CrossDocumentValidationInput = {
  incoterm?: string | null
  portOfLoading?: string | null
  portOfDischarge?: string | null
  freight?: number | null
  insurance?: number | null
  totalValue?: number | null
  insuranceValue?: number | null
  invoiceItems?: Array<{
    quantity?: number | null
    netWeight?: number | null
    grossWeight?: number | null
  }>
  packingCartons?: Array<{
    quantity?: number | null
    netWeightKg?: number | null
    grossWeightKg?: number | null
  }>
  packingItems?: Array<{
    quantity?: number | null
  }>
  shippingBillPortOfLoading?: string | null
  shippingBillPortOfDischarge?: string | null
}

const VALID_INCOTERMS = ["FOB", "CIF", "CFR", "EXW", "DDP", "CNF"]

function normalizeIncoterm(incoterm?: string | null): string {
  return String(incoterm || "").trim().substring(0, 3).toUpperCase()
}

function safeNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function validateCrossDocumentInputs(input: CrossDocumentValidationInput): SharedValidationResult {
  const errors: SharedValidationError[] = []

  const incoterm = normalizeIncoterm(input.incoterm)
  const portOfLoading = String(input.portOfLoading || "").trim().toUpperCase()
  const portOfDischarge = String(input.portOfDischarge || "").trim().toUpperCase()

  const totalValue = safeNumber(input.totalValue)
  const freight = safeNumber(input.freight)
  const insurance = safeNumber(input.insurance)

  const insuranceValue =
    input.insuranceValue === null || input.insuranceValue === undefined
      ? undefined
      : safeNumber(input.insuranceValue)

  if (incoterm) {
    if (!VALID_INCOTERMS.includes(incoterm)) {
      errors.push({
        field: "incoterm",
        code: "INVALID_INCOTERM",
        message: `Invalid Incoterm: ${incoterm}. Must be one of: ${VALID_INCOTERMS.join(", ")}`,
      })
    }

    if (incoterm === "EXW") {
      if (portOfLoading || portOfDischarge) {
        errors.push({
          field: "incoterm",
          code: "INCOTERM_LOGIC_FAIL",
          message: "EXW shipments should not include port information.",
        })
      }
    } else if (incoterm === "FOB") {
      if (!portOfLoading) {
        errors.push({
          field: "portOfLoading",
          code: "INCOTERM_LOGIC_FAIL",
          message: "FOB requires a port of loading.",
        })
      }
    } else if (incoterm === "CIF" || incoterm === "CFR") {
      if (!portOfLoading || !portOfDischarge) {
        errors.push({
          field: "portOfDischarge",
          code: "INCOTERM_LOGIC_FAIL",
          message: `${incoterm} requires both loading and discharge ports.`,
        })
      }
    } else if (incoterm === "DDP") {
      if (!portOfDischarge) {
        errors.push({
          field: "portOfDischarge",
          code: "INCOTERM_LOGIC_FAIL",
          message: "DDP requires a destination/discharge port.",
        })
      }
    }
  }

  if (totalValue > 0) {
    const maxAllowedFreight = totalValue * 0.2
    if (freight > maxAllowedFreight) {
      errors.push({
        field: "freight",
        code: "FREIGHT_LOGIC_FAIL",
        message: `Freight exceeds 20% of invoice value (${maxAllowedFreight.toFixed(2)} max).`,
      })
    } else if (incoterm === "FOB" && freight > 0) {
      errors.push({
        field: "freight",
        code: "FREIGHT_LOGIC_FAIL",
        message: "FOB: Freight should be 0. Buyer pays freight beyond port of loading.",
      })
    } else if ((incoterm === "CIF" || incoterm === "CFR") && freight <= 0) {
      errors.push({
        field: "freight",
        code: "FREIGHT_LOGIC_FAIL",
        message: `${incoterm}: Freight must be greater than 0.`,
      })
    }
  }

  if (incoterm === "CIF" && insurance <= 0) {
    errors.push({
      field: "insurance",
      code: "INSURANCE_LOGIC_FAIL",
      message: "CIF requires insurance to be greater than 0.",
    })
  }

  if ((incoterm === "CFR" || incoterm === "CNF") && insurance > 0) {
    errors.push({
      field: "insurance",
      code: "INSURANCE_LOGIC_FAIL",
      message: "CFR should not include insurance. Buyer arranges insurance separately.",
    })
  }

  if (incoterm === "FOB" && insurance > 0) {
    errors.push({
      field: "insurance",
      code: "INSURANCE_LOGIC_FAIL",
      message: "FOB: Insurance should be 0. Buyer arranges insurance.",
    })
  }

  if (insuranceValue !== undefined && totalValue > 0) {
    const minInsured = totalValue * 0.95
    const maxInsured = totalValue * 1.15

    if (insuranceValue < minInsured || insuranceValue > maxInsured) {
      errors.push({
        field: "insuredValue",
        code: "VALUE_MISMATCH",
        message: `Insurance must be 95-115% of invoice value (${minInsured.toFixed(2)} - ${maxInsured.toFixed(2)}).`,
      })
    }
  }

  const billLoading = String(input.shippingBillPortOfLoading || "").trim().toUpperCase()
  const billDischarge = String(input.shippingBillPortOfDischarge || "").trim().toUpperCase()

  if ((billLoading && billLoading !== portOfLoading) || (billDischarge && billDischarge !== portOfDischarge)) {
    errors.push({
      field: "ports",
      code: "PORT_MISMATCH",
      message: "Invoice ports and shipping bill ports must match.",
    })
  }

  const invoiceQty = (input.invoiceItems || []).reduce((sum, item) => sum + safeNumber(item.quantity), 0)
  const packingQtySource = (input.packingItems && input.packingItems.length > 0)
    ? input.packingItems
    : (input.packingCartons || [])
  const packingQty = packingQtySource.reduce((sum, item) => sum + safeNumber(item.quantity), 0)

  if (packingQtySource.length > 0 && invoiceQty !== packingQty) {
    errors.push({
      field: "packingList",
      code: "QUANTITY_MISMATCH",
      message: `Quantity mismatch: Invoice (${invoiceQty}) vs Packing (${packingQty}).`,
    })
  }

  const invoiceHasNet = (input.invoiceItems || []).length > 0 &&
    (input.invoiceItems || []).every((item) => item.netWeight !== null && item.netWeight !== undefined)
  const invoiceHasGross = (input.invoiceItems || []).length > 0 &&
    (input.invoiceItems || []).every((item) => item.grossWeight !== null && item.grossWeight !== undefined)

  if (invoiceHasNet && (input.packingCartons || []).length > 0) {
    const invoiceNet = (input.invoiceItems || []).reduce((sum, item) => sum + safeNumber(item.netWeight), 0)
    const packingNet = (input.packingCartons || []).reduce((sum, carton) => sum + safeNumber(carton.netWeightKg), 0)

    if (Math.abs(invoiceNet - packingNet) > 1e-9) {
      errors.push({
        field: "packingList",
        code: "NET_WEIGHT_MISMATCH",
        message: `Net weight mismatch: Invoice (${invoiceNet}) vs Packing (${packingNet}).`,
      })
    }
  }

  if (invoiceHasGross && (input.packingCartons || []).length > 0) {
    const invoiceGross = (input.invoiceItems || []).reduce((sum, item) => sum + safeNumber(item.grossWeight), 0)
    const packingGross = (input.packingCartons || []).reduce((sum, carton) => sum + safeNumber(carton.grossWeightKg), 0)

    if (Math.abs(invoiceGross - packingGross) > 1e-9) {
      errors.push({
        field: "packingList",
        code: "GROSS_WEIGHT_MISMATCH",
        message: `Gross weight mismatch: Invoice (${invoiceGross}) vs Packing (${packingGross}).`,
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

const FRIENDLY_CODE_MESSAGES: Record<string, string> = {
  INVALID_INCOTERM: "The selected INCOTERM is not supported.",
  INCOTERM_LOGIC_FAIL: "The selected INCOTERM conflicts with port information.",
  INCOTERM_PORT_MISMATCH: "The selected INCOTERM requires valid loading/discharge ports.",
  CROSS_DOCUMENT_CONSISTENCY: "Some document values are inconsistent across selected documents.",
  FREIGHT_LOGIC_FAIL: "Freight value conflicts with INCOTERM or exceeds allowed limits.",
  VALUE_MISMATCH: "Insurance value must stay within allowed range of invoice value.",
  PORT_MISMATCH: "Port details are inconsistent across documents.",
  QUANTITY_MISMATCH: "Item quantities are inconsistent between invoice and packing list.",
  NET_WEIGHT_MISMATCH: "Net weight is inconsistent between invoice and packing list.",
  GROSS_WEIGHT_MISMATCH: "Gross weight is inconsistent between invoice and packing list.",
  INSURANCE_LOGIC_FAIL: "Insurance value conflicts with selected INCOTERM.",
}

export function toFriendlyValidationMessage(code?: string, fallbackMessage?: string): string {
  if (code && FRIENDLY_CODE_MESSAGES[code]) {
    return FRIENDLY_CODE_MESSAGES[code]
  }
  return fallbackMessage || "Validation failed. Please review the entered data."
}

export function humanizeReleaseBlockers<T extends { code?: string; message?: string }>(
  blockers: T[]
): Array<T & { userMessage: string }> {
  return blockers.map((blocker) => ({
    ...blocker,
    userMessage: toFriendlyValidationMessage(blocker.code, blocker.message),
  }))
}
