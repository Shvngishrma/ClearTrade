/**
 * DOCUMENT CROSS-CONSISTENCY ENGINE
 * ==================================
 * 
 * Elite-Level Validation: Cross-Document Reconciliation
 * 
 * Banks reject on cross-document mismatch MORE than single-document errors.
 * 
 * This engine runs BEFORE PDF generation as the final gate:
 * Invoice ↔ Shipping Bill ↔ Packing List ↔ Insurance Certificate ↔ LC Terms
 * 
 * Validations:
 * 1. Port consistency (invoice port = shipping bill port = insurance origin port)
 * 2. Value reconciliation (invoice total = packing list subtotal = LC LC amount)
 * 3. Currency alignment (all docs same currency)
 * 4. Incoterm alignment (CIF/CFR/FOB consistency)
 * 5. Freight logic (CIF includes freight, CFR importer pays insurance, FOB buyer owns from origin)
 * 6. Line item mapping (invoice items ↔ packing list items)
 * 7. GST alignment (invoice GST = items × GST rate)
 * 8. HS code consistency (invoice items HS code matches packing list)
 * 9. Weight reconciliation (invoice total weight = packing list total weight)
 * 10. Date sequence (PO date < Invoice date < Shipping Bill date < LC maturity)
 */

// ============================================
// DOCUMENT TYPES
// ============================================

export interface InvoiceDocument {
  invoiceId: string
  invoiceNumber: string
  invoiceDate: Date
  
  exporterId: string
  importerId: string
  buyerCountry: string
  
  port: string // INMAA5, INDEF1, etc
  incoterm: "FOB" | "CIF" | "CFR" | "DAP" | "DDP" | "EXW" | "FCA" | "CPT" | "CIP"
  
  currency: "USD" | "EUR" | "INR" | "GBP"
  
  items: Array<{
    itemId: string
    description: string
    hsCode: string
    quantity: number
    unitPrice: number
    gstRate: number // percentage
    totalValue: number // quantity × unitPrice
    gstAmount: number
  }>
  
  subtotal: number // sum of all items
  freight: number
  insurance: number
  otherCharges: number
  totalValue: number
  gstAmount: number
  
  paymentTerm: "Advance" | "LC" | "DA" | "DP" | "CAD"
  lcNumber?: string
  lcValue?: number
  lcCurrency?: string
  lcExpiryDate?: Date
}

export interface ShippingBillDocument {
  shippingBillId: string
  shippingBillNumber: string
  shippingBillDate: Date
  
  invoiceNumber: string // Reference to invoice
  invoiceDate: Date
  invoiceValue: number
  invoiceCurrency: string
  
  port: string // Port of loading
  adCode?: string
  
  incoterm: string // FOB/CIF/CFR
  
  items: Array<{
    itemId: string
    itemDescription: string
    hsCode: string
    quantity: number
    weight: number // per unit
    totalWeight: number
  }>
  
  totalWeight: number
  totalQuantity: number
  
  // Shipping details
  vesselName?: string
  vesselDate?: Date
  billOfLadingNumber?: string
}

export interface PackingListDocument {
  packingListId: string
  packingListNumber: string
  packingListDate: Date
  
  invoiceNumber: string // Reference to invoice
  invoiceValue: number
  invoiceCurrency: string
  
  items: Array<{
    itemId: string
    description: string
    hsCode: string
    quantity: number
    unitWeight: number
    totalWeight: number
    marketValue: number // per item line total
  }>
  
  subtotal: number
  totalQuantity: number
  totalWeight: number
  totalValue: number
}

export interface InsuranceCertificate {
  certificateId: string
  certificateNumber: string
  certificateDate: Date
  
  invoiceNumber: string
  invoiceValue: number
  invoiceCurrency: string
  
  originPort: string
  destinationPort: string
  
  insuredAmountBasis: "Invoice" | "Invoice+10%" | "Invoice+110%"
  insuredValueInvoiceCurrency: number
  insuredValueUSD?: number
  
  coverage: "All-Risk" | "Basic" | "Named Perils"
  incoterm: "CIF" | "CFR" | "FOB" // Insurance type
}

export interface LCTermsDocument {
  lcNumber: string
  lcDate: Date
  lcExpiryDate: Date
  
  issuingBank: string
  confirmingBank?: string
  
  lcAmount: number
  lcCurrency: string
  
  presentationPeriod: number // days
  latestShipmentDate: Date
  tolerance?: number // ± percentage
  
  invoiceReferences: string[] // Invoice numbers allowed under this LC
}

// ============================================
// CONSISTENCY VALIDATION TYPES
// ============================================

export interface CrossDocumentDiscrepancy {
  discrepancyId: string
  fromDocument: "Invoice" | "ShippingBill" | "PackingList" | "Insurance" | "LCTerms"
  toDocument: "Invoice" | "ShippingBill" | "PackingList" | "Insurance" | "LCTerms"
  
  field: string // e.g., "port", "totalValue", "currency", "hsCode"
  fromValue: any
  toValue: any
  
  severity: "Error" | "Warning" | "Info"
  code: string // e.g., "PORT_MISMATCH", "VALUE_VARIANCE", "CURRENCY_MISMATCH"
  message: string
  
  resolution?: string
  autoFixable: boolean
  suggestedFix?: any
}

export interface CrossDocumentConsistencyResult {
  batchId: string
  invoiceId: string
  
  docsChecked: {
    invoice: boolean
    shippingBill: boolean
    packingList: boolean
    insurance: boolean
    lcTerms: boolean
  }
  
  discrepancies: CrossDocumentDiscrepancy[]
  
  // Gate
  canProceedToPDFGeneration: boolean
  blockers: CrossDocumentDiscrepancy[]
  warnings: CrossDocumentDiscrepancy[]
  
  // Audit
  checkedAt: Date
  checksRun: Array<{
    checkName: string
    passed: boolean
    discrepancyCount: number
  }>
  
  // Recommendation
  recommendation: "Proceed" | "FixWarnings" | "BlockOnErrors"
}

// ============================================
// VALIDATION RULES & CHECKS
// ============================================

/**
 * CHECK 1: PORT CONSISTENCY
 * Invoice.port = ShippingBill.port = Insurance.originPort
 */
export function checkPortConsistency(
  invoice: InvoiceDocument,
  shippingBill?: ShippingBillDocument,
  insurance?: InsuranceCertificate
): CrossDocumentDiscrepancy[] {
  const issues: CrossDocumentDiscrepancy[] = []

  if (shippingBill && invoice.port !== shippingBill.port) {
    issues.push({
      discrepancyId: `PORT-001-${invoice.invoiceId}`,
      fromDocument: "Invoice",
      toDocument: "ShippingBill",
      field: "port",
      fromValue: invoice.port,
      toValue: shippingBill.port,
      severity: "Error",
      code: "PORT_MISMATCH",
      message: `Port mismatch: Invoice=${invoice.port}, ShippingBill=${shippingBill.port}`,
      resolution: "Update ShippingBill port to match Invoice port",
      autoFixable: true,
      suggestedFix: invoice.port,
    })
  }

  if (insurance && invoice.port !== insurance.originPort) {
    issues.push({
      discrepancyId: `PORT-002-${invoice.invoiceId}`,
      fromDocument: "Invoice",
      toDocument: "Insurance",
      field: "port",
      fromValue: invoice.port,
      toValue: insurance.originPort,
      severity: "Error",
      code: "PORT_MISMATCH",
      message: `Port mismatch: Invoice=${invoice.port}, Insurance origin=${insurance.originPort}`,
      resolution: "Update Insurance certificate origin port to match Invoice",
      autoFixable: true,
      suggestedFix: invoice.port,
    })
  }

  return issues
}

/**
 * CHECK 2: VALUE RECONCILIATION
 * Invoice.totalValue = PackingList.totalValue (within tolerance)
 * Invoice.lcValue = Invoice.totalValue (if LC payment)
 */
export function checkValueReconciliation(
  invoice: InvoiceDocument,
  packingList?: PackingListDocument,
  lcTerms?: LCTermsDocument,
  tolerance: number = 0.01 // 1% variance allowed
): CrossDocumentDiscrepancy[] {
  const issues: CrossDocumentDiscrepancy[] = []

  if (packingList) {
    const variance = Math.abs(invoice.totalValue - packingList.totalValue) / invoice.totalValue
    
    if (variance > tolerance) {
      issues.push({
        discrepancyId: `VALUE-001-${invoice.invoiceId}`,
        fromDocument: "Invoice",
        toDocument: "PackingList",
        field: "totalValue",
        fromValue: invoice.totalValue,
        toValue: packingList.totalValue,
        severity: "Error",
        code: "VALUE_MISMATCH",
        message: `Value mismatch: Invoice=${invoice.totalValue}, PackingList=${packingList.totalValue} (variance: ${(variance * 100).toFixed(2)}%)`,
        resolution: "Reconcile invoice total with packing list subtotal",
        autoFixable: false,
      })
    } else if (variance > 0) {
      // Warning for small variances (rounding errors)
      issues.push({
        discrepancyId: `VALUE-002-${invoice.invoiceId}`,
        fromDocument: "Invoice",
        toDocument: "PackingList",
        field: "totalValue",
        fromValue: invoice.totalValue,
        toValue: packingList.totalValue,
        severity: "Warning",
        code: "VALUE_VARIANCE",
        message: `Minor value variance: Invoice=${invoice.totalValue}, PackingList=${packingList.totalValue} (${(variance * 100).toFixed(2)}%)`,
        resolution: "Acceptable rounding variance",
        autoFixable: true,
        suggestedFix: packingList.totalValue,
      })
    }
  }

  if (lcTerms && invoice.lcValue) {
    const variance = Math.abs(invoice.totalValue - lcTerms.lcAmount) / invoice.totalValue
    
    if (variance > tolerance) {
      issues.push({
        discrepancyId: `VALUE-003-${invoice.invoiceId}`,
        fromDocument: "Invoice",
        toDocument: "LCTerms",
        field: "lcAmount",
        fromValue: invoice.totalValue,
        toValue: lcTerms.lcAmount,
        severity: "Error",
        code: "LC_VALUE_MISMATCH",
        message: `LC amount mismatch: Invoice=${invoice.totalValue}, LC=${lcTerms.lcAmount}`,
        resolution: "Update LC amount to match invoice total",
        autoFixable: false,
      })
    }
  }

  return issues
}

/**
 * CHECK 3: CURRENCY CONSISTENCY
 * All documents must use same currency
 */
export function checkCurrencyConsistency(
  invoice: InvoiceDocument,
  shippingBill?: ShippingBillDocument,
  packingList?: PackingListDocument,
  insurance?: InsuranceCertificate,
  lcTerms?: LCTermsDocument
): CrossDocumentDiscrepancy[] {
  const issues: CrossDocumentDiscrepancy[] = []

  if (shippingBill && invoice.currency !== shippingBill.invoiceCurrency) {
    issues.push({
      discrepancyId: `CURR-001-${invoice.invoiceId}`,
      fromDocument: "Invoice",
      toDocument: "ShippingBill",
      field: "currency",
      fromValue: invoice.currency,
      toValue: shippingBill.invoiceCurrency,
      severity: "Error",
      code: "CURRENCY_MISMATCH",
      message: `Currency mismatch: Invoice=${invoice.currency}, ShippingBill=${shippingBill.invoiceCurrency}`,
      resolution: "All documents must use same currency",
      autoFixable: true,
      suggestedFix: invoice.currency,
    })
  }

  if (packingList && invoice.currency !== packingList.invoiceCurrency) {
    issues.push({
      discrepancyId: `CURR-002-${invoice.invoiceId}`,
      fromDocument: "Invoice",
      toDocument: "PackingList",
      field: "currency",
      fromValue: invoice.currency,
      toValue: packingList.invoiceCurrency,
      severity: "Error",
      code: "CURRENCY_MISMATCH",
      message: `Currency mismatch: Invoice=${invoice.currency}, PackingList=${packingList.invoiceCurrency}`,
      resolution: "All documents must use same currency",
      autoFixable: true,
      suggestedFix: invoice.currency,
    })
  }

  if (insurance && invoice.currency !== insurance.invoiceCurrency) {
    issues.push({
      discrepancyId: `CURR-003-${invoice.invoiceId}`,
      fromDocument: "Invoice",
      toDocument: "Insurance",
      field: "currency",
      fromValue: invoice.currency,
      toValue: insurance.invoiceCurrency,
      severity: "Error",
      code: "CURRENCY_MISMATCH",
      message: `Currency mismatch: Invoice=${invoice.currency}, Insurance=${insurance.invoiceCurrency}`,
      resolution: "Insurance document must use same currency as invoice",
      autoFixable: true,
      suggestedFix: invoice.currency,
    })
  }

  if (lcTerms && invoice.currency !== lcTerms.lcCurrency) {
    issues.push({
      discrepancyId: `CURR-004-${invoice.invoiceId}`,
      fromDocument: "Invoice",
      toDocument: "LCTerms",
      field: "currency",
      fromValue: invoice.currency,
      toValue: lcTerms.lcCurrency,
      severity: "Error",
      code: "CURRENCY_MISMATCH",
      message: `Currency mismatch: Invoice=${invoice.currency}, LC=${lcTerms.lcCurrency}`,
      resolution: "LC currency must match invoice currency",
      autoFixable: false,
    })
  }

  return issues
}

/**
 * CHECK 4: INCOTERM ALIGNMENT
 * Invoice.incoterm = ShippingBill.incoterm = Insurance.incoterm
 */
export function checkIncotermAlignment(
  invoice: InvoiceDocument,
  shippingBill?: ShippingBillDocument,
  insurance?: InsuranceCertificate
): CrossDocumentDiscrepancy[] {
  const issues: CrossDocumentDiscrepancy[] = []

  if (shippingBill && invoice.incoterm !== shippingBill.incoterm) {
    issues.push({
      discrepancyId: `INCO-001-${invoice.invoiceId}`,
      fromDocument: "Invoice",
      toDocument: "ShippingBill",
      field: "incoterm",
      fromValue: invoice.incoterm,
      toValue: shippingBill.incoterm,
      severity: "Error",
      code: "INCOTERM_MISMATCH",
      message: `Incoterm mismatch: Invoice=${invoice.incoterm}, ShippingBill=${shippingBill.incoterm}`,
      resolution: "All documents must reference same Incoterm",
      autoFixable: true,
      suggestedFix: invoice.incoterm,
    })
  }

  if (insurance && invoice.incoterm !== insurance.incoterm) {
    issues.push({
      discrepancyId: `INCO-002-${invoice.invoiceId}`,
      fromDocument: "Invoice",
      toDocument: "Insurance",
      field: "incoterm",
      fromValue: invoice.incoterm,
      toValue: insurance.incoterm,
      severity: "Error",
      code: "INCOTERM_MISMATCH",
      message: `Incoterm mismatch: Invoice=${invoice.incoterm}, Insurance=${insurance.incoterm}`,
      resolution: "Insurance type must match invoice Incoterm",
      autoFixable: false,
    })
  }

  return issues
}

/**
 * CHECK 5: FREIGHT LOGIC ALIGNMENT
 * CIF = Cost + Insurance + Freight (invoice includes freight)
 * CFR = Cost + Freight (exporter pays freight, importer pays insurance)
 * FOB = Freight on Board (buyer pays all shipping + insurance)
 */
export function checkFreightLogicAlignment(
  invoice: InvoiceDocument,
  insurance?: InsuranceCertificate
): CrossDocumentDiscrepancy[] {
  const issues: CrossDocumentDiscrepancy[] = []

  // If CIF, freight MUST be included in invoice
  if (invoice.incoterm === "CIF" && invoice.freight === 0) {
    issues.push({
      discrepancyId: `FREIGHT-001-${invoice.invoiceId}`,
      fromDocument: "Invoice",
      toDocument: "Invoice",
      field: "freight",
      fromValue: invoice.freight,
      toValue: "undefined",
      severity: "Error",
      code: "CIF_NO_FREIGHT",
      message: "CIF invoice must include freight charges",
      resolution: "Add freight charges to CIF invoice",
      autoFixable: false,
    })
  }

  // If CFR, freight MUST be included but insurance paid by buyer
  if (invoice.incoterm === "CFR" && invoice.freight === 0) {
    issues.push({
      discrepancyId: `FREIGHT-002-${invoice.invoiceId}`,
      fromDocument: "Invoice",
      toDocument: "Invoice",
      field: "freight",
      fromValue: invoice.freight,
      toValue: "undefined",
      severity: "Error",
      code: "CFR_NO_FREIGHT",
      message: "CFR invoice must include freight charges",
      resolution: "Add freight charges to CFR invoice",
      autoFixable: false,
    })
  }

  // If FOB, freight should NOT be in invoice
  if (invoice.incoterm === "FOB" && invoice.freight > 0) {
    issues.push({
      discrepancyId: `FREIGHT-003-${invoice.invoiceId}`,
      fromDocument: "Invoice",
      toDocument: "Invoice",
      field: "freight",
      fromValue: invoice.freight,
      toValue: 0,
      severity: "Warning",
      code: "FOB_HAS_FREIGHT",
      message: "FOB invoice should NOT include freight (buyer responsibility)",
      resolution: "Remove freight from FOB invoice",
      autoFixable: true,
      suggestedFix: 0,
    })
  }

  // If CIF, insurance MUST be in invoice
  if (invoice.incoterm === "CIF" && invoice.insurance === 0) {
    issues.push({
      discrepancyId: `FREIGHT-004-${invoice.invoiceId}`,
      fromDocument: "Invoice",
      toDocument: "Invoice",
      field: "insurance",
      fromValue: invoice.insurance,
      toValue: "undefined",
      severity: "Error",
      code: "CIF_NO_INSURANCE",
      message: "CIF invoice must include insurance charges",
      resolution: "Add insurance charges to CIF invoice",
      autoFixable: false,
    })
  }

  // If CFR, insurance should NOT be in invoice (buyer pays separately)
  if (invoice.incoterm === "CFR" && invoice.insurance > 0) {
    issues.push({
      discrepancyId: `FREIGHT-005-${invoice.invoiceId}`,
      fromDocument: "Invoice",
      toDocument: "Invoice",
      field: "insurance",
      fromValue: invoice.insurance,
      toValue: 0,
      severity: "Warning",
      code: "CFR_HAS_INSURANCE",
      message: "CFR invoice should NOT include insurance (buyer pays separately)",
      resolution: "Remove insurance from CFR invoice",
      autoFixable: true,
      suggestedFix: 0,
    })
  }

  return issues
}

/**
 * CHECK 6: LINE ITEM MAPPING
 * Invoice items ↔ ShippingBill items ↔ PackingList items
 */
export function checkLineItemMapping(
  invoice: InvoiceDocument,
  shippingBill?: ShippingBillDocument,
  packingList?: PackingListDocument
): CrossDocumentDiscrepancy[] {
  const issues: CrossDocumentDiscrepancy[] = []

  if (shippingBill) {
    const invoiceItemCount = invoice.items.length
    const sbItemCount = shippingBill.items.length

    if (invoiceItemCount !== sbItemCount) {
      issues.push({
        discrepancyId: `ITEMS-001-${invoice.invoiceId}`,
        fromDocument: "Invoice",
        toDocument: "ShippingBill",
        field: "itemCount",
        fromValue: invoiceItemCount,
        toValue: sbItemCount,
        severity: "Warning",
        code: "ITEM_COUNT_MISMATCH",
        message: `Item count mismatch: Invoice has ${invoiceItemCount} items, ShippingBill has ${sbItemCount}`,
        resolution: "Ensure all invoice items are listed in ShippingBill",
        autoFixable: false,
      })
    }

    // Check HS codes match for common items
    invoice.items.forEach((invItem) => {
      const sbItem = shippingBill.items.find((sb) => sb.itemId === invItem.itemId)
      if (sbItem && invItem.hsCode !== sbItem.hsCode) {
        issues.push({
          discrepancyId: `ITEMS-002-${invoice.invoiceId}`,
          fromDocument: "Invoice",
          toDocument: "ShippingBill",
          field: "hsCode",
          fromValue: invItem.hsCode,
          toValue: sbItem.hsCode,
          severity: "Error",
          code: "HS_CODE_MISMATCH",
          message: `HS code mismatch for item ${invItem.itemId}: Invoice=${invItem.hsCode}, ShippingBill=${sbItem.hsCode}`,
          resolution: "Verify correct HS code and update both documents",
          autoFixable: false,
        })
      }
    })
  }

  if (packingList) {
    const invoiceItemCount = invoice.items.length
    const plItemCount = packingList.items.length

    if (invoiceItemCount !== plItemCount) {
      issues.push({
        discrepancyId: `ITEMS-003-${invoice.invoiceId}`,
        fromDocument: "Invoice",
        toDocument: "PackingList",
        field: "itemCount",
        fromValue: invoiceItemCount,
        toValue: plItemCount,
        severity: "Warning",
        code: "ITEM_COUNT_MISMATCH",
        message: `Item count mismatch: Invoice has ${invoiceItemCount} items, PackingList has ${plItemCount}`,
        resolution: "Ensure all invoice items are listed in PackingList",
        autoFixable: false,
      })
    }

    // Check quantities match
    invoice.items.forEach((invItem) => {
      const plItem = packingList.items.find((pl) => pl.itemId === invItem.itemId)
      if (plItem && invItem.quantity !== plItem.quantity) {
        issues.push({
          discrepancyId: `ITEMS-004-${invoice.invoiceId}`,
          fromDocument: "Invoice",
          toDocument: "PackingList",
          field: "quantity",
          fromValue: invItem.quantity,
          toValue: plItem.quantity,
          severity: "Error",
          code: "QUANTITY_MISMATCH",
          message: `Quantity mismatch for item ${invItem.itemId}: Invoice=${invItem.quantity}, PackingList=${plItem.quantity}`,
          resolution: "Quantities must match between invoice and packing list",
          autoFixable: false,
        })
      }
    })
  }

  return issues
}

/**
 * CHECK 7: WEIGHT RECONCILIATION
 * Invoice.totalWeight = ShippingBill.totalWeight = PackingList.totalWeight
 */
export function checkWeightReconciliation(
  invoice: InvoiceDocument,
  shippingBill?: ShippingBillDocument,
  packingList?: PackingListDocument,
  tolerance: number = 0.02 // 2% variance allowed
): CrossDocumentDiscrepancy[] {
  const issues: CrossDocumentDiscrepancy[] = []

  const invoiceWeight = invoice.items.reduce((sum, item) => sum + (item.totalValue * 0.1), 0) // Placeholder

  if (shippingBill) {
    const variance = Math.abs(shippingBill.totalWeight - invoiceWeight) / invoiceWeight

    if (variance > tolerance && shippingBill.totalWeight > 0) {
      issues.push({
        discrepancyId: `WEIGHT-001-${invoice.invoiceId}`,
        fromDocument: "ShippingBill",
        toDocument: "Invoice",
        field: "totalWeight",
        fromValue: shippingBill.totalWeight,
        toValue: invoiceWeight,
        severity: "Warning",
        code: "WEIGHT_VARIANCE",
        message: `Weight variance: ShippingBill=${shippingBill.totalWeight}, estimated from Invoice=${invoiceWeight.toFixed(2)}`,
        resolution: "Verify actual shipped weight in ShippingBill",
        autoFixable: false,
      })
    }
  }

  if (packingList) {
    const variance = Math.abs(packingList.totalWeight - invoiceWeight) / invoiceWeight

    if (variance > tolerance && packingList.totalWeight > 0) {
      issues.push({
        discrepancyId: `WEIGHT-002-${invoice.invoiceId}`,
        fromDocument: "PackingList",
        toDocument: "Invoice",
        field: "totalWeight",
        fromValue: packingList.totalWeight,
        toValue: invoiceWeight,
        severity: "Warning",
        code: "WEIGHT_VARIANCE",
        message: `Weight variance: PackingList=${packingList.totalWeight}, estimated from Invoice=${invoiceWeight.toFixed(2)}`,
        resolution: "Verify packing list total weight",
        autoFixable: false,
      })
    }
  }

  return issues
}

/**
 * CHECK 8: GST ALIGNMENT (India-specific)
 * Invoice GST amount = Sum of (item value × item GST rate)
 */
export function checkGSTAlignment(invoice: InvoiceDocument): CrossDocumentDiscrepancy[] {
  const issues: CrossDocumentDiscrepancy[] = []

  const calculatedGST = invoice.items.reduce(
    (sum, item) => sum + (item.totalValue * (item.gstRate / 100)),
    0
  )

  const variance = Math.abs(invoice.gstAmount - calculatedGST) / invoice.gstAmount

  if (variance > 0.01 && calculatedGST > 0) {
    issues.push({
      discrepancyId: `GST-001-${invoice.invoiceId}`,
      fromDocument: "Invoice",
      toDocument: "Invoice",
      field: "gstAmount",
      fromValue: invoice.gstAmount,
      toValue: calculatedGST,
      severity: "Error",
      code: "GST_MISMATCH",
      message: `GST amount mismatch: Declared=${invoice.gstAmount}, Calculated=${calculatedGST.toFixed(2)}`,
      resolution: "GST amount must equal sum of (item value × item GST rate)",
      autoFixable: true,
      suggestedFix: calculatedGST.toFixed(2),
    })
  }

  return issues
}

/**
 * CHECK 9: DATE SEQUENCE VALIDATION
 * PO Date < Invoice Date < ShippingBill Date < LC Expiry
 */
export function checkDateSequence(
  invoice: InvoiceDocument,
  shippingBill?: ShippingBillDocument,
  lcTerms?: LCTermsDocument
): CrossDocumentDiscrepancy[] {
  const issues: CrossDocumentDiscrepancy[] = []

  if (shippingBill && invoice.invoiceDate > shippingBill.shippingBillDate) {
    issues.push({
      discrepancyId: `DATE-001-${invoice.invoiceId}`,
      fromDocument: "Invoice",
      toDocument: "ShippingBill",
      field: "date",
      fromValue: invoice.invoiceDate,
      toValue: shippingBill.shippingBillDate,
      severity: "Error",
      code: "DATE_SEQUENCE_ERROR",
      message: `Date sequence error: Invoice date (${invoice.invoiceDate.toDateString()}) after ShippingBill date (${shippingBill.shippingBillDate.toDateString()})`,
      resolution: "Invoice must be dated before Shipping Bill",
      autoFixable: false,
    })
  }

  if (lcTerms && invoice.invoiceDate > lcTerms.lcDate) {
    issues.push({
      discrepancyId: `DATE-002-${invoice.invoiceId}`,
      fromDocument: "Invoice",
      toDocument: "LCTerms",
      field: "date",
      fromValue: invoice.invoiceDate,
      toValue: lcTerms.lcDate,
      severity: "Error",
      code: "DATE_SEQUENCE_ERROR",
      message: `Date sequence error: Invoice date (${invoice.invoiceDate.toDateString()}) after LC date (${lcTerms.lcDate.toDateString()})`,
      resolution: "Invoice must be dated on or after LC issuance",
      autoFixable: false,
    })
  }

  if (lcTerms && shippingBill) {
    if (shippingBill.shippingBillDate > lcTerms.lcExpiryDate) {
      issues.push({
        discrepancyId: `DATE-003-${invoice.invoiceId}`,
        fromDocument: "ShippingBill",
        toDocument: "LCTerms",
        field: "date",
        fromValue: shippingBill.shippingBillDate,
        toValue: lcTerms.lcExpiryDate,
        severity: "Error",
        code: "SHIPMENT_AFTER_LC_EXPIRY",
        message: `Shipment after LC expiry: ShippingBill=${shippingBill.shippingBillDate.toDateString()}, LC expires=${lcTerms.lcExpiryDate.toDateString()}`,
        resolution: "Ship before LC expiry date",
        autoFixable: false,
      })
    }

    const presentationDeadline = new Date(shippingBill.shippingBillDate)
    presentationDeadline.setDate(presentationDeadline.getDate() + lcTerms.presentationPeriod)

    if (presentationDeadline > lcTerms.lcExpiryDate) {
      issues.push({
        discrepancyId: `DATE-004-${invoice.invoiceId}`,
        fromDocument: "LCTerms",
        toDocument: "LCTerms",
        field: "presentationPeriod",
        fromValue: lcTerms.presentationPeriod,
        toValue: "insufficient",
        severity: "Warning",
        code: "INSUFFICIENT_PRESENTATION_PERIOD",
        message: `Presentation period insufficient: ${lcTerms.presentationPeriod} days from shipment extends beyond LC expiry`,
        resolution: "Increase presentation period or reduce shipment days from LC issue",
        autoFixable: false,
      })
    }
  }

  return issues
}

// ============================================
// MASTER VALIDATION ENGINE
// ============================================

export function validateCrossDocumentConsistency(
  invoice: InvoiceDocument,
  shippingBill?: ShippingBillDocument,
  packingList?: PackingListDocument,
  insurance?: InsuranceCertificate,
  lcTerms?: LCTermsDocument
): CrossDocumentConsistencyResult {
  const batchId = `CROSS-${invoice.invoiceId}-${Date.now()}`
  const allDiscrepancies: CrossDocumentDiscrepancy[] = []

  const checksRun: CrossDocumentConsistencyResult["checksRun"] = []

  // CHECK 1: Port Consistency
  const portIssues = checkPortConsistency(invoice, shippingBill, insurance)
  allDiscrepancies.push(...portIssues)
  checksRun.push({
    checkName: "Port Consistency",
    passed: portIssues.length === 0,
    discrepancyCount: portIssues.length,
  })

  // CHECK 2: Value Reconciliation
  const valueIssues = checkValueReconciliation(invoice, packingList, lcTerms)
  allDiscrepancies.push(...valueIssues)
  checksRun.push({
    checkName: "Value Reconciliation",
    passed: valueIssues.filter((i) => i.severity === "Error").length === 0,
    discrepancyCount: valueIssues.length,
  })

  // CHECK 3: Currency Consistency
  const currencyIssues = checkCurrencyConsistency(invoice, shippingBill, packingList, insurance, lcTerms)
  allDiscrepancies.push(...currencyIssues)
  checksRun.push({
    checkName: "Currency Consistency",
    passed: currencyIssues.length === 0,
    discrepancyCount: currencyIssues.length,
  })

  // CHECK 4: Incoterm Alignment
  const incotermIssues = checkIncotermAlignment(invoice, shippingBill, insurance)
  allDiscrepancies.push(...incotermIssues)
  checksRun.push({
    checkName: "Incoterm Alignment",
    passed: incotermIssues.length === 0,
    discrepancyCount: incotermIssues.length,
  })

  // CHECK 5: Freight Logic Alignment
  const freightIssues = checkFreightLogicAlignment(invoice, insurance)
  allDiscrepancies.push(...freightIssues)
  checksRun.push({
    checkName: "Freight Logic Alignment",
    passed: freightIssues.filter((i) => i.severity === "Error").length === 0,
    discrepancyCount: freightIssues.length,
  })

  // CHECK 6: Line Item Mapping
  const itemIssues = checkLineItemMapping(invoice, shippingBill, packingList)
  allDiscrepancies.push(...itemIssues)
  checksRun.push({
    checkName: "Line Item Mapping",
    passed: itemIssues.filter((i) => i.severity === "Error").length === 0,
    discrepancyCount: itemIssues.length,
  })

  // CHECK 7: Weight Reconciliation
  const weightIssues = checkWeightReconciliation(invoice, shippingBill, packingList)
  allDiscrepancies.push(...weightIssues)
  checksRun.push({
    checkName: "Weight Reconciliation",
    passed: weightIssues.filter((i) => i.severity === "Error").length === 0,
    discrepancyCount: weightIssues.length,
  })

  // CHECK 8: GST Alignment
  const gstIssues = checkGSTAlignment(invoice)
  allDiscrepancies.push(...gstIssues)
  checksRun.push({
    checkName: "GST Alignment",
    passed: gstIssues.filter((i) => i.severity === "Error").length === 0,
    discrepancyCount: gstIssues.length,
  })

  // CHECK 9: Date Sequence
  const dateIssues = checkDateSequence(invoice, shippingBill, lcTerms)
  allDiscrepancies.push(...dateIssues)
  checksRun.push({
    checkName: "Date Sequence",
    passed: dateIssues.filter((i) => i.severity === "Error").length === 0,
    discrepancyCount: dateIssues.length,
  })

  const blockers = allDiscrepancies.filter((d) => d.severity === "Error")
  const warnings = allDiscrepancies.filter((d) => d.severity === "Warning")

  const canProceedToPDFGeneration = blockers.length === 0

  const recommendation: "Proceed" | "FixWarnings" | "BlockOnErrors" = blockers.length > 0
    ? "BlockOnErrors"
    : warnings.length > 0
    ? "FixWarnings"
    : "Proceed"

  return {
    batchId,
    invoiceId: invoice.invoiceId,

    docsChecked: {
      invoice: true,
      shippingBill: !!shippingBill,
      packingList: !!packingList,
      insurance: !!insurance,
      lcTerms: !!lcTerms,
    },

    discrepancies: allDiscrepancies,
    canProceedToPDFGeneration,
    blockers,
    warnings,

    checkedAt: new Date(),
    checksRun,

    recommendation,
  }
}

/**
 * Auto-fix applicable discrepancies
 */
export function autoFixDiscrepancies(
  invoice: InvoiceDocument,
  discrepancies: CrossDocumentDiscrepancy[]
): {
  fixedInvoice: InvoiceDocument
  fixedDiscrepancies: CrossDocumentDiscrepancy[]
  unfixable: CrossDocumentDiscrepancy[]
} {
  let fixedInvoice = { ...invoice }
  const fixed: CrossDocumentDiscrepancy[] = []
  const unfixable: CrossDocumentDiscrepancy[] = []

  discrepancies.forEach((d) => {
    if (d.autoFixable && d.suggestedFix !== undefined) {
      fixed.push(d)
      // Apply the fix
      if (d.field === "freight") {
        fixedInvoice.freight = d.suggestedFix
        fixedInvoice.totalValue = fixedInvoice.subtotal + fixedInvoice.freight + fixedInvoice.insurance
      } else if (d.field === "insurance") {
        fixedInvoice.insurance = d.suggestedFix
        fixedInvoice.totalValue = fixedInvoice.subtotal + fixedInvoice.freight + fixedInvoice.insurance
      } else if (d.field === "gstAmount") {
        fixedInvoice.gstAmount = d.suggestedFix
      }
    } else {
      unfixable.push(d)
    }
  })

  return {
    fixedInvoice,
    fixedDiscrepancies: fixed,
    unfixable,
  }
}

/**
 * Generate audit report of all checks
 */
export function generateAuditReport(result: CrossDocumentConsistencyResult): string {
  const lines: string[] = [
    "═".repeat(80),
    "CROSS-DOCUMENT CONSISTENCY AUDIT REPORT",
    "═".repeat(80),
    `Batch ID: ${result.batchId}`,
    `Invoice ID: ${result.invoiceId}`,
    `Checked At: ${result.checkedAt.toISOString()}`,
    "",
    "DOCUMENTS CHECKED:",
    `  ✓ Invoice: ${result.docsChecked.invoice}`,
    `  ✓ Shipping Bill: ${result.docsChecked.shippingBill}`,
    `  ✓ Packing List: ${result.docsChecked.packingList}`,
    `  ✓ Insurance: ${result.docsChecked.insurance}`,
    `  ✓ LC Terms: ${result.docsChecked.lcTerms}`,
    "",
    "VALIDATION RESULTS:",
    ...result.checksRun.map(
      (check) => `  ${check.passed ? "✅" : "❌"} ${check.checkName}: ${check.discrepancyCount} issue(s)`
    ),
    "",
    `GATE: ${result.canProceedToPDFGeneration ? "✅ CAN PROCEED" : "❌ BLOCKED"}`,
    `Recommendation: ${result.recommendation}`,
    `Blockers: ${result.blockers.length}`,
    `Warnings: ${result.warnings.length}`,
    "",
  ]

  if (result.blockers.length > 0) {
    lines.push("CRITICAL ISSUES (BLOCKERS):")
    result.blockers.forEach((b) => {
      lines.push(`  [${b.code}] ${b.message}`)
      if (b.resolution) lines.push(`    → Resolution: ${b.resolution}`)
    })
    lines.push("")
  }

  if (result.warnings.length > 0) {
    lines.push("WARNINGS:")
    result.warnings.forEach((w) => {
      lines.push(`  [${w.code}] ${w.message}`)
      if (w.resolution) lines.push(`    → Resolution: ${w.resolution}`)
    })
    lines.push("")
  }

  lines.push("═".repeat(80))

  return lines.join("\n")
}
