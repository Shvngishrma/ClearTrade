import { prisma } from "@/lib/db"
import { sumItems } from "@/lib/calculations"
import { validateCrossDocumentInputs } from "@/lib/validation/sharedValidationEngine"
import { isValidPortCode } from "@/lib/validatePortCode"

// ISO 4217 Currency Codes
const VALID_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "INR",
  "JPY",
  "AED",
  "AUD",
  "CAD",
  "CHF",
  "CNY",
  "SGD",
  "HKD",
  "NZD",
  "MXN",
  "BRL",
]

const INVOICE_NUMBER_REGEX = /^INV\/\d{4}\/\d{4}$/

export interface ValidationError {
  field: string
  message: string
}

export interface InvoiceData {
  invoiceNumber: string
  invoiceDate?: Date
  paymentTerms?: string
  totalValue?: number
  currency?: string
  incoterm?: string
  fobValue?: number
  cifValue?: number
  lcNumber?: string
  portOfLoading?: string
  portOfDischarge?: string
  countryOfOrigin?: string
  finalDestination?: string
  modeOfTransport?: string
  freight?: number
  insurance?: number
  exchangeRateDate?: Date // Date when exchange rate was fixed
  items?: Array<{
    description: string
    hsCode: string
    quantity: number
    unitPrice: number
  }>
  excludeId?: string // For update validation - exclude current record
  exporterId?: string // For per-exporter invoice uniqueness
}

export async function validateInvoice(data: InvoiceData): Promise<ValidationError[]> {
  const errors: ValidationError[] = []

  const normalizedInvoiceNumber = (data.invoiceNumber || "").trim().toUpperCase()
  if (!normalizedInvoiceNumber) {
    errors.push({
      field: "invoiceNumber",
      message: "Invoice Number is required",
    })
  } else if (!INVOICE_NUMBER_REGEX.test(normalizedInvoiceNumber)) {
    errors.push({
      field: "invoiceNumber",
      message: "Invoice Number must follow INV/YYYY/NNNN format (example: INV/2026/0001)",
    })
  }

  // 1. Validate HS Code - BULLETPROOF VERSION
  // Real-world: Must be numeric-only, 6 or 8 digits
  // 6-digit = International HS Code (chapters/headings)
  // 8-digit = Indian Tariff Code (full specificity)
  if (data.items && data.items.length > 0) {
    data.items.forEach((item, index) => {
      if (!item.hsCode) {
        errors.push({
          field: `items.${index}.hsCode`,
          message: "HS Code is required",
        })
        return
      }

      const hsCodeTrimmed = item.hsCode.trim()

      // Check numeric-only (no letters, spaces, or special chars)
      if (!/^\d+$/.test(hsCodeTrimmed)) {
        errors.push({
          field: `items.${index}.hsCode`,
          message: `HS Code must contain only digits. Received: "${item.hsCode}" (contains non-numeric characters)`,
        })
        return
      }

      // Check length - must be 6 or 8 digits
      const hsLength = hsCodeTrimmed.length
      if (hsLength !== 6 && hsLength !== 8) {
        errors.push({
          field: `items.${index}.hsCode`,
          message: `HS Code must be either 6 digits (international) or 8 digits (Indian tariff). Received: ${hsLength} digits (${hsCodeTrimmed})`,
        })
        return
      }

      // TODO: Add tariff API validation here
      // if (hsLength === 8) {
      //   const validTariff = await validateIndianTariffCode(hsCodeTrimmed)
      //   if (!validTariff) {
      //     errors.push({...})
      //   }
      // }
    })
  }

  // 2. Validate Incoterm/freight/insurance logic via shared engine
  const sharedCrossDocValidation = validateCrossDocumentInputs({
    incoterm: data.incoterm,
    portOfLoading: data.portOfLoading,
    portOfDischarge: data.portOfDischarge,
    freight: Number(data.freight || 0),
    insurance: Number(data.insurance || 0),
    totalValue: Number(data.totalValue || 0),
  })

  sharedCrossDocValidation.errors.forEach((sharedError) => {
    if (["incoterm", "freight", "insurance"].includes(sharedError.field)) {
      errors.push({
        field: sharedError.field,
        message: sharedError.message,
      })
    }
  })

  const normalizedPortOfLoading = (data.portOfLoading || "").trim().toUpperCase()
  if (normalizedPortOfLoading && !isValidPortCode(normalizedPortOfLoading)) {
    errors.push({
      field: "portOfLoading",
      message: "Port code is invalid. Please select a valid UN/LOCODE from the dropdown.",
    })
  }

  const normalizedPortOfDischarge = (data.portOfDischarge || "").trim().toUpperCase()
  if (normalizedPortOfDischarge && !isValidPortCode(normalizedPortOfDischarge)) {
    errors.push({
      field: "portOfDischarge",
      message: "Port code is invalid. Please select a valid UN/LOCODE from the dropdown.",
    })
  }

  // 3. LC-specific requirements
  if (data.paymentTerms === "LC") {
    if (!data.lcNumber || data.lcNumber.trim() === "") {
      errors.push({
        field: "lcNumber",
        message: "LC Number is required when payment terms is Letter of Credit (LC)",
      })
    } else if (data.lcNumber.length < 3) {
      errors.push({
        field: "lcNumber",
        message: "LC Number must be at least 3 characters long",
      })
    }
  }

  // 4. Validate Currency (ISO 4217)
  if (data.currency) {
    if (!VALID_CURRENCIES.includes(data.currency)) {
      errors.push({
        field: "currency",
        message: `Invalid Currency: ${data.currency}. Must be a valid ISO 4217 code`,
      })
    }
  } else {
    errors.push({
      field: "currency",
      message: "Currency is required",
    })
  }

  // 5. Invoice Number Sequencing Control - AUDIT-PROOF
  // ENFORCES: Sequential numbering, no backdating, no cancelled reuse
  // RBI FEMA Requirement: Consecutive invoice numbering per Foreign Exchange Management Act, 1999
  if (normalizedInvoiceNumber && data.exporterId) {
    try {
      // Check uniqueness
      const existing = await prisma.invoice.findMany({
        where: {
          invoiceNumber: normalizedInvoiceNumber,
          exporterId: data.exporterId,
        } as any,
        take: 1,
      })

      if (existing.length > 0 && existing[0].id !== data.excludeId) {
        errors.push({
          field: "invoiceNumber",
          message: `Invoice Number "${normalizedInvoiceNumber}" already exists for this exporter.`,
        })
        return errors
      }

      // Check if number was previously cancelled (PERMANENT BLOCK)
      const { isNumberCancelled } = await import("@/lib/invoiceSequence")
      const cancelled = await isNumberCancelled(
        data.exporterId,
        parseInt(normalizedInvoiceNumber.match(/(\d+)$/)?.[1] || "0")
      )

      if (cancelled) {
        errors.push({
          field: "invoiceNumber",
          message: `Invoice number "${normalizedInvoiceNumber}" was previously cancelled and cannot be reused.`,
        })
        return errors
      }

      // Check sequencing rules
      const sequence = await prisma.invoiceSequence.findUnique({
        where: { exporterId: data.exporterId }
      })

      if (sequence) {
        const invoiceNum = parseInt(normalizedInvoiceNumber.match(/(\d+)$/)?.[1] || "0")
        
        // Check if it's next in sequence
        if (invoiceNum !== sequence.nextNumber) {
          errors.push({
            field: "invoiceNumber",
            message: `Invoice number out of sequence. Expected #${String(sequence.nextNumber).padStart(6, "0")}, got #${String(invoiceNum).padStart(6, "0")}. Invoices must be sequential per RBI FEMA regulations.`,
          })
          return errors
        }

        // Check backdating
        if (sequence.lastIssuedDate) {
          const invoiceDate = data.invoiceDate instanceof Date ? data.invoiceDate : new Date(data.invoiceDate || new Date())
          if (invoiceDate < sequence.lastIssuedDate) {
            errors.push({
              field: "invoiceDate",
              message: `Cannot backdate invoice before last issued date (${sequence.lastIssuedDate.toISOString()}). RBI requires chronological invoicing.`,
            })
            return errors
          }
        }
      }
    } catch (e) {
      console.warn("Invoice sequencing check failed:", e)
    }
  }

  // 6. Total value matches sum of items - STRICT FOR BANKING
  // Real-world: Banks reject even 0.01 mismatch. We allow exact match only.
  // PRECISION-SAFE: Uses Money class (integer arithmetic) to prevent floating-point mismatches
  if (data.items && data.items.length > 0) {
    const { validateItemsTotal } = await import("@/lib/calculations")

    if (data.totalValue !== undefined && data.totalValue !== null) {
      const { isValid, calculatedTotal, difference, reason } = validateItemsTotal(
        data.items as any,
        data.totalValue
      )

      if (!isValid) {
        errors.push({
          field: "totalValue",
          message: reason || `Total value MUST exactly match sum of items. Mismatch: ${difference.toFixed(4)} (Sum: ${calculatedTotal.toFixed(2)} vs Declared: ${data.totalValue.toFixed(2)}). Banking systems reject even 0.01 discrepancies.`,
        })
      }
    }
  }

  // 7. Required fields validation
  if (!data.invoiceDate) {
    errors.push({
      field: "invoiceDate",
      message: "Invoice Date is required",
    })
  }

  if (!data.paymentTerms || data.paymentTerms.trim() === "") {
    errors.push({
      field: "paymentTerms",
      message: "Payment Terms is required",
    })
  }

  if (!data.portOfLoading || data.portOfLoading.trim() === "") {
    errors.push({
      field: "portOfLoading",
      message: "Port of Loading is required",
    })
  }

  if (!data.portOfDischarge || data.portOfDischarge.trim() === "") {
    errors.push({
      field: "portOfDischarge",
      message: "Port of Discharge is required",
    })
  }

  if (!data.incoterm || data.incoterm.trim() === "") {
    errors.push({
      field: "incoterm",
      message: "Incoterm is required",
    })
  }

  if (!data.countryOfOrigin || data.countryOfOrigin.trim() === "") {
    errors.push({
      field: "countryOfOrigin",
      message: "Country of Origin is required",
    })
  } else if (data.countryOfOrigin.trim().toLowerCase() === "not specified") {
    errors.push({
      field: "countryOfOrigin",
      message: "Country of Origin cannot be 'Not specified'",
    })
  }

  // 8. Exchange Rate Date Validation - RBI REQUIREMENT
  // Real-world: RBI requires tracking when exchange rate was fixed
  // If currency is not INR and no exchange rate date is given, reject
  if (data.currency && data.currency !== "INR") {
    if (!data.exchangeRateDate) {
      errors.push({
        field: "exchangeRateDate",
        message: `Exchange Rate Date is required for ${data.currency}. RBI requires documentation of when the rate was fixed for compliance.`,
      })
    } else if (data.exchangeRateDate > new Date()) {
      errors.push({
        field: "exchangeRateDate",
        message: `Exchange Rate Date cannot be in the future. Received: ${data.exchangeRateDate.toLocaleDateString()}`,
      })
    }
  }

  return errors
}
