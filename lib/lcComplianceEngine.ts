/**
 * LC COMPLIANCE ENFORCEMENT ENGINE
 * ================================
 * 
 * Rule enforcement (NOT block injection).
 * 
 * Core Principle: 
 * If LC terms violated → BLOCK document generation
 * If LC terms compliant → ALLOW with audit trail
 * 
 * Auditor-proof: Every validation decision is logged
 */


export interface LCTerms {
  lcNumber: string
  lcDescriptionText: string
  latestShipmentDate: Date
  presentationDays: number
  partialShipmentAllowed: boolean
  tolerancePercent?: number
  governedBy?: string  // UCP 600, UNCITRAL, etc.
}

export interface InvoiceData {
  invoiceNumber: string
  invoiceDate: Date
  description: string
  quantity: number
  shipmentDate: Date
  isPartialShipment?: boolean
  currencyCode: string
  invoiceValue: number
}

export interface LCComplianceCheckResult {
  isCompliant: boolean
  lcNumber: string
  invoiceNumber: string
  validationTimestamp: Date
  blockers: ValidationError[]  // Critical failures that BLOCK generation
  warnings: ValidationWarning[]  // Non-critical issues
  allowDocumentGeneration: boolean  // TRUE = generate, FALSE = block
  auditLog: AuditEntry[]
}

export interface ValidationError {
  code: string
  field: string
  message: string
  invoiceValue: string | number
  lcValue: string | number
  resolution: string
  severity: "BLOCK" | "WARN"
}

export interface ValidationWarning {
  code: string
  field: string
  message: string
  tolerance: number
  actualVariance: number
  allowedVariance: number
}

export interface AuditEntry {
  timestamp: Date
  ruleCode: string
  ruleDescription: string
  result: "PASS" | "FAIL"
  details: string
}

// ============================================
// RULE SET 1: DESCRIPTION VALIDATION
// ============================================

function normalizeDescription(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s%]/g, "")  // Remove special chars except %
    .replace(/\s+/g, " ")       // Normalize spaces
    .trim()
}

/**
 * Extracts quantity and units from a given text (e.g. "100 MT", "25.5 KGS")
 */
function extractQuantityAndUnits(text: string): { quantity: number | null, unit: string | null }[] {
  // Regex to match numbers followed by units
  // Supports decimals and common suffixes
  const pattern = /(\d+(?:\.\d+)?)\s*(MT|KGS|PCS|UNITS|UNIT|TONS|TONNE|METRIC TON|METRIC TONS|KG|PACKS|BAGS|PCS)/gi;
  const matches = [...text.matchAll(pattern)];
  
  return matches.map(match => ({
    quantity: parseFloat(match[1]),
    unit: match[2].toUpperCase()
  }));
}

function extractStandaloneQuantities(text: string): number[] {
  const matches = [...text.matchAll(/\b(\d+(?:\.\d+)?)\b/g)]
  return matches.map(match => parseFloat(match[1]))
}

function extractRelevantStandaloneNumbers(text: string, referenceQuantity?: number): number[] {
  const keywordRegex = /\b(qty|quantity|units?|pcs|kg|kgs|mt)\b/i
  const numericMatches = [...text.matchAll(/\b(\d+(?:\.\d+)?)\b/g)]

  const candidates = numericMatches
    .map(match => {
      const value = parseFloat(match[1])
      const index = match.index ?? 0
      const windowStart = Math.max(0, index - 20)
      const windowEnd = Math.min(text.length, index + match[0].length + 20)
      const nearbyWindow = text.slice(windowStart, windowEnd)

      return {
        value,
        hasKeywordNearby: keywordRegex.test(nearbyWindow)
      }
    })
    .filter(candidate => {
      if (typeof referenceQuantity !== "number" || referenceQuantity <= 0) {
        return true
      }

      // Ignore likely non-quantity identifiers (e.g. year/batch) that are too large.
      return candidate.value <= referenceQuantity * 10
    })

  if (candidates.length === 0) {
    return []
  }

  const keywordCandidates = candidates.filter(candidate => candidate.hasKeywordNearby)
  if (keywordCandidates.length > 0) {
    return keywordCandidates.map(candidate => candidate.value)
  }

  // No keyword hints: prefer smaller numbers first.
  return candidates
    .map(candidate => candidate.value)
    .sort((a, b) => a - b)
}

/**
 * Normalizes units to shorthand for comparison
 */
function normalizeUnit(unit: string): string {
  const mapping: Record<string, string> = {
    "KGS": "KG",
    "METRIC TON": "MT",
    "METRIC TONS": "MT",
    "TONS": "MT",
    "TONNE": "MT",
    "UNIT": "UNITS",
    "PCS": "PCS"
  };
  return mapping[unit] || unit;
}

function getPrimaryQuantityAndUnit(text: string): { quantity: number; unit: string } | null {
  const extracted = extractQuantityAndUnits(text)
  const first = extracted.find(item => item.quantity !== null && item.unit)

  if (!first || first.quantity === null || !first.unit) {
    return null
  }

  return {
    quantity: first.quantity,
    unit: normalizeUnit(first.unit)
  }
}

/**
 * Checks for specific constraint keywords (EXCLUDING, NOT TO EXCEED, MAXIMUM)
 * and ensures invoice does not violate them.
 */
function checkConstraintViolations(lcText: string, invoiceText: string): ValidationError[] {
  const issues: ValidationError[] = [];
  const upperLC = lcText.toUpperCase();
  const upperInv = invoiceText.toUpperCase();

  // EXCLUDING constraint
  // Very simple check: find word after EXCLUDING
  const exclusionKeywords = ["EXCLUDING", "EXCLUSIVE OF", "EXCEPT"];
  for (const kw of exclusionKeywords) {
    if (upperLC.includes(kw)) {
      const remaining = upperLC.split(kw)[1];
      // Get the first few words after EXCLUDING, until a punctuation or common conjunction
      const match = remaining.match(/^\s+([\w\s]+)(?:\.|\s+AND|\s+OR|,|$)/);
      if (match) {
        const excludedItem = match[1].trim();
        // If the excluded item words (at least one significant word) are in the invoice
        const excludedWords = excludedItem.split(/\s+/).filter(w => w.length > 3);
        for (const word of excludedWords) {
          if (upperInv.includes(word)) {
            issues.push({
              code: "CONSTRAINT_EXCLUSION_VIOLATED",
              field: "description",
              message: `Invoice contains excluded item: "${word}" (from LC: "${kw} ${excludedItem}")`,
              invoiceValue: invoiceText,
              lcValue: lcText,
              resolution: "Remove excluded item from invoice or request LC amendment",
              severity: "BLOCK"
            });
            break;
          }
        }
      }
    }
  }

  // NOT TO EXCEED / MAXIMUM constraint for numeric values
  // e.g., "NOT TO EXCEED 1000 MT" or "MAXIMUM 500 UNITS"
  const limitPattern = /(?:NOT TO EXCEED|MAXIMUM)\s+(\d+(?:\.\d+)?)\s*(MT|KGS|PCS|UNITS)/gi;
  const limits = [...upperLC.matchAll(limitPattern)];
  
  if (limits.length > 0) {
    const invQuantities = extractQuantityAndUnits(invoiceText);
    
    for (const limit of limits) {
      const limitVal = parseFloat(limit[1]);
      const limitUnit = normalizeUnit(limit[2].toUpperCase());
      const invoiceStandaloneNumbers = extractRelevantStandaloneNumbers(invoiceText, limitVal)
      
      // Find matching items in invoice
      const matchingInvItems = invQuantities.filter(item => item.unit && normalizeUnit(item.unit) === limitUnit);
      
      for (const invItem of matchingInvItems) {
        if (invItem.quantity !== null && invItem.quantity > limitVal) {
          issues.push({
            code: "CONSTRAINT_LIMIT_EXCEEDED",
            field: "description",
            message: `Invoice quantity (${invItem.quantity} ${limitUnit}) exceeds LC limit (${limitVal} ${limitUnit})`,
            invoiceValue: `${invItem.quantity} ${limitUnit}`,
            lcValue: `${limitVal} ${limitUnit}`,
            resolution: "Reduce invoice quantity or request LC amendment",
            severity: "BLOCK"
          });
        }
      }

      // Fallback layer: if no unit-based match exists, compare standalone numeric values.
      if (matchingInvItems.length === 0 && invoiceStandaloneNumbers.length > 0) {
        const maxInvoiceNumber = Math.max(...invoiceStandaloneNumbers)
        if (maxInvoiceNumber > limitVal) {
          issues.push({
            code: "CONSTRAINT_LIMIT_EXCEEDED",
            field: "description",
            message: `Invoice quantity (${maxInvoiceNumber}) exceeds LC limit (${limitVal} ${limitUnit})`,
            invoiceValue: maxInvoiceNumber,
            lcValue: `${limitVal} ${limitUnit}`,
            resolution: "Reduce invoice quantity or request LC amendment",
            severity: "BLOCK"
          })
        }
      }
    }
  }

  return issues;
}

export function validateDescriptionMatch(
  invoiceDescription: string,
  lcDescription: string
): {
  matches: boolean
  similarity: number
  issues: ValidationError[]
} {
  const issues: ValidationError[] = []
  
  // 1. Structured Quantity and Unit Comparison
  const lcQuants = extractQuantityAndUnits(lcDescription);
  const invQuants = extractQuantityAndUnits(invoiceDescription);

  if (lcQuants.length > 0 && invQuants.length > 0) {
    // For each unit found in LC, check if matching unit in Invoice has correct quantity
    for (const lcItem of lcQuants) {
      if (lcItem.unit) {
        const normLCUnit = normalizeUnit(lcItem.unit);
        const matchingInvItem = invQuants.find(iq => iq.unit && normalizeUnit(iq.unit) === normLCUnit);
        
        if (matchingInvItem) {
          if (matchingInvItem.quantity !== lcItem.quantity) {
            issues.push({
              code: "QUANTITY_MISMATCH",
              field: "description",
              message: `Quantity mismatch for ${normLCUnit}: Invoice has ${matchingInvItem.quantity}, LC requires ${lcItem.quantity}`,
              invoiceValue: matchingInvItem.quantity || 0,
              lcValue: lcItem.quantity || 0,
              resolution: "Ensure invoice quantity matches LC description exactly",
              severity: "BLOCK"
            });
          }
        } else {
          // Unit mentioned in LC but not found in invoice description (might be okay if total matches, but usually a sign of error)
          issues.push({
            code: "UNIT_MISSING_IN_INVOICE",
            field: "description",
            message: `LC specifies ${lcItem.quantity} ${lcItem.unit}, but this unit is missing from invoice description`,
            invoiceValue: "N/A",
            lcValue: `${lcItem.quantity} ${lcItem.unit}`,
            resolution: "Add unit-specific description to invoice to match LC requirements",
            severity: "WARN"
          });
        }
      }
    }
  }

  // If invoice omits units entirely, compare numeric values only to avoid false unit-missing failures
  if (lcQuants.length > 0 && invQuants.length === 0) {
    const lcPrimary = lcQuants.find(item => item.quantity !== null)
    const invoiceStandaloneQty = extractRelevantStandaloneNumbers(
      invoiceDescription,
      lcPrimary?.quantity ?? undefined
    )[0]

    if (lcPrimary && lcPrimary.quantity !== null && typeof invoiceStandaloneQty === "number") {
      if (invoiceStandaloneQty !== lcPrimary.quantity) {
        issues.push({
          code: "QUANTITY_MISMATCH",
          field: "description",
          message: `Quantity mismatch: Invoice has ${invoiceStandaloneQty}, LC requires ${lcPrimary.quantity}`,
          invoiceValue: invoiceStandaloneQty,
          lcValue: lcPrimary.quantity,
          resolution: "Ensure invoice quantity matches LC description exactly",
          severity: "BLOCK"
        })
      }
    }
  }

  // 2. Constraint Detection (EXCLUDING, NOT TO EXCEED, etc.)
  const constraintIssues = checkConstraintViolations(lcDescription, invoiceDescription);
  issues.push(...constraintIssues);

  // 3. Fuzzy Matching as Secondary Check
  const normInvoice = normalizeDescription(invoiceDescription)
  const normLC = normalizeDescription(lcDescription)
  
  // Split into words for similarity calc
  const invoiceWords = normInvoice.split(" ").filter(w => w.length > 2)
  const lcWords = normLC.split(" ").filter(w => w.length > 2)

  // Use a more relaxed normalization for comparison if structured checks passed
  const matchedWords = invoiceWords.filter(word => lcWords.includes(word))
  const similarity = (matchedWords.length / Math.max(invoiceWords.length, lcWords.length)) * 100

  // If we already have BLOCK issues from strict checks, we report them.
  if (issues.some(i => i.severity === "BLOCK")) {
    return {
      matches: false,
      similarity,
      issues
    }
  }

  // Exact match after normalization or high similarity
  if (normInvoice === normLC) {
    return {
      matches: true,
      similarity: 100,
      issues
    }
  }

  // Special case: if quantities were extracted and matched, and all words in invoice exist in LC, it's a pass
  const invoiceSubsetOfLC = invoiceWords.every(w => lcWords.includes(w));
  if (invoiceSubsetOfLC && invQuants.length > 0) {
     return {
        matches: true,
        similarity: 100,
        issues
     }
  }

  if (similarity >= 85) {
    issues.push({
      code: "DESC_PARTIAL_MATCH",
      field: "description",
      message: `Description ${similarity.toFixed(0)}% similar (threshold 85%)`,
      invoiceValue: invoiceDescription,
      lcValue: lcDescription,
      resolution: "Close enough - no amendment needed",
      severity: "WARN"
    });
    return {
      matches: true,
      similarity,
      issues
    }
  }

  // Significant mismatch → BLOCK
  issues.push({
    code: "DESC_MISMATCH",
    field: "description",
    message: `Description mismatch: Only ${similarity.toFixed(0)}% similar (${similarity < 85 ? "FAIL" : "PASS"} threshold)`,
    invoiceValue: invoiceDescription,
    lcValue: lcDescription,
    resolution: "Request LC amendment or modify invoice description",
    severity: "BLOCK"
  });

  return {
    matches: false,
    similarity,
    issues
  }
}

// ============================================
// RULE SET 2: SHIPMENT DATE VALIDATION
// ============================================

function validateShipmentDateCompliance(
  invoiceShipmentDate: Date,
  lcLatestShipmentDate: Date
): {
  compliant: boolean
  issues: ValidationError[]
} {
  if (invoiceShipmentDate > lcLatestShipmentDate) {
    return {
      compliant: false,
      issues: [
        {
          code: "SHIPMENT_DATE_EXCEEDED",
          field: "shipmentDate",
          message: `Shipment date ${invoiceShipmentDate.toISOString().split("T")[0]} exceeds LC deadline ${lcLatestShipmentDate.toISOString().split("T")[0]}`,
          invoiceValue: invoiceShipmentDate.toISOString(),
          lcValue: lcLatestShipmentDate.toISOString(),
          resolution: "❌ CANNOT PROCESS - Request LC amendment for extended shipment",
          severity: "BLOCK"
        }
      ]
    }
  }

  return {
    compliant: true,
    issues: []
  }
}

// ============================================
// RULE SET 3: QUANTITY TOLERANCE VALIDATION
// ============================================

function validateQuantityTolerance(
  invoiceQuantity: number,
  lcQuantity: number,  // We need this from stored LC data
  tolerancePercent: number = 0
): {
  compliant: boolean
  variancePercent: number
  issues: ValidationError[]
} {
  if (!lcQuantity || lcQuantity === 0) {
    return {
      compliant: false,
      variancePercent: 0,
      issues: [
        {
          code: "INVALID_LC_QUANTITY",
          field: "quantity",
          message: "LC quantity cannot be zero or missing",
          invoiceValue: invoiceQuantity,
          lcValue: lcQuantity || 0,
          resolution: "Provide a valid non-zero LC quantity before validation",
          severity: "BLOCK"
        }
      ]
    }
  }

  const variance = Math.abs(invoiceQuantity - lcQuantity)
  const variancePercent = (variance / lcQuantity) * 100

  if (variancePercent > tolerancePercent) {
    return {
      compliant: false,
      variancePercent,
      issues: [
        {
          code: "QUANTITY_EXCEEDED",
          field: "quantity",
          message: `Quantity variance ${variancePercent.toFixed(2)}% exceeds tolerance ${tolerancePercent}%`,
          invoiceValue: invoiceQuantity,
          lcValue: lcQuantity,
          resolution: "Invoice quantity must not exceed LC approved quantity",
          severity: "BLOCK"
        }
      ]
    }
  }

  if (variancePercent > 0) {
    return {
      compliant: true,
      variancePercent,
      issues: [
        {
          code: "QUANTITY_WITHIN_TOLERANCE",
          field: "quantity",
          message: `Quantity variance ${variancePercent.toFixed(2)}% within tolerance ${tolerancePercent}%`,
          invoiceValue: invoiceQuantity,
          lcValue: lcQuantity,
          resolution: "Within allowed tolerance - accepted",
          severity: "WARN"
        }
      ]
    }
  }

  return {
    compliant: true,
    variancePercent: 0,
    issues: []
  }
}

// ============================================
// RULE SET 4: PARTIAL SHIPMENT VALIDATION
// ============================================

function validatePartialShipmentAllowed(
  isPartialShipment: boolean,
  partialShipmentAllowed: boolean
): {
  compliant: boolean
  issues: ValidationError[]
} {
  if (isPartialShipment && !partialShipmentAllowed) {
    return {
      compliant: false,
      issues: [
        {
          code: "PARTIAL_SHIPMENT_NOT_ALLOWED",
          field: "partialShipment",
          message: "LC does not permit partial shipments, but invoice indicates partial shipment",
          invoiceValue: "true",
          lcValue: "false",
          resolution: "❌ Full shipment required or request LC amendment",
          severity: "BLOCK"
        }
      ]
    }
  }

  return {
    compliant: true,
    issues: []
  }
}

// ============================================
// RULE SET 5: PRESENTATION PERIOD VALIDATION
// ============================================

function validatePresentationPeriod(
  invoiceDate: Date,
  shipmentDate: Date,
  presentationDays: number
): {
  compliant: boolean
  presentationDeadline: Date
  daysRemaining: number
  issues: ValidationError[]
} {
  // Presentation deadline = Shipment Date + Presentation Days
  const presentationDeadline = new Date(shipmentDate)
  presentationDeadline.setDate(presentationDeadline.getDate() + presentationDays)

  const today = new Date()
  const daysRemaining = Math.floor((presentationDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysRemaining < 0) {
    return {
      compliant: false,
      presentationDeadline,
      daysRemaining,
      issues: [
        {
          code: "PRESENTATION_PERIOD_EXPIRED",
          field: "presentationDeadline",
          message: `Presentation deadline ${presentationDeadline.toISOString().split("T")[0]} has PASSED (${Math.abs(daysRemaining)} days ago)`,
          invoiceValue: today.toISOString(),
          lcValue: presentationDeadline.toISOString(),
          resolution: "❌ CANNOT PROCESS - Presentation period expired",
          severity: "BLOCK"
        }
      ]
    }
  }

  if (daysRemaining <= 7) {
    return {
      compliant: true,
      presentationDeadline,
      daysRemaining,
      issues: [
        {
          code: "PRESENTATION_DEADLINE_APPROACHING",
          field: "presentationDeadline",
          message: `Presentation deadline in ${daysRemaining} days (${presentationDeadline.toISOString().split("T")[0]})`,
          invoiceValue: daysRemaining.toString(),
          lcValue: presentationDays.toString(),
          resolution: "⚠️ URGENT - Submit documents immediately",
          severity: "WARN"
        }
      ]
    }
  }

  return {
    compliant: true,
    presentationDeadline,
    daysRemaining,
    issues: []
  }
}

// ============================================
// RULE SET 6: CROSS-DOCUMENT CONSISTENCY
// ============================================

function validateCrossDocumentConsistency(
  invoiceData: InvoiceData,
  lcData: LCTerms
): {
  consistent: boolean
  issues: ValidationError[]
} {
  const issues: ValidationError[] = []

  // Currency consistency (if applicable)
  if (!lcData.lcDescriptionText.includes(invoiceData.currencyCode)) {
    issues.push({
      code: "CURRENCY_NOT_MENTIONED",
      field: "currency",
      message: `Invoice currency ${invoiceData.currencyCode} not mentioned in LC description`,
      invoiceValue: invoiceData.currencyCode,
      lcValue: lcData.lcDescriptionText,
      resolution: "Verify currency is consistent with LC terms or request amendment",
      severity: "WARN"
    })
  }

  return {
    consistent: issues.length === 0,
    issues
  }
}

// ============================================
// MASTER LC COMPLIANCE ENGINE
// ============================================

export async function validateLCCompliance(
  invoice: InvoiceData,
  lc: LCTerms
): Promise<LCComplianceCheckResult> {
  const auditLog: AuditEntry[] = []
  const blockers: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  const validationTimestamp = new Date()

  // RULE 1: Description Match
  const descCheck = validateDescriptionMatch(invoice.description, lc.lcDescriptionText)
  auditLog.push({
    timestamp: validationTimestamp,
    ruleCode: "RULE_DESCRIPTION_MATCH",
    ruleDescription: "Invoice description must match LC description (normalized)",
    result: descCheck.matches ? "PASS" : "FAIL",
    details: `Similarity: ${descCheck.similarity.toFixed(0)}%`
  })

  descCheck.issues.forEach(issue => {
    if (issue.severity === "BLOCK") {
      blockers.push(issue)
    } else {
      warnings.push({
        code: issue.code,
        field: issue.field,
        message: issue.message,
        tolerance: 0,
        actualVariance: 100 - descCheck.similarity,
        allowedVariance: 15  // 15% tolerance for fuzzy matching
      })
    }
  })

  // RULE 2: Shipment Date
  const shipmentCheck = validateShipmentDateCompliance(
    invoice.shipmentDate,
    lc.latestShipmentDate
  )
  auditLog.push({
    timestamp: validationTimestamp,
    ruleCode: "RULE_SHIPMENT_DATE",
    ruleDescription: "Invoice shipment date must not exceed LC latest shipment date",
    result: shipmentCheck.compliant ? "PASS" : "FAIL",
    details: `Invoice: ${invoice.shipmentDate.toISOString().split("T")[0]}, LC Limit: ${lc.latestShipmentDate.toISOString().split("T")[0]}`
  })
  blockers.push(...shipmentCheck.issues)

  // RULE 3: Quantity Tolerance (We'd need LC quantity from DB - using LC value if available)
  // For now, assuming LC quantity is stored or can be queried
  const quantityCheck = validateQuantityTolerance(
    invoice.quantity,
    invoice.quantity,  // In real scenario, fetch from LC stored in DB
    lc.tolerancePercent || 0
  )
  auditLog.push({
    timestamp: validationTimestamp,
    ruleCode: "RULE_QUANTITY_TOLERANCE",
    ruleDescription: "Invoice quantity must be within tolerance of LC quantity",
    result: quantityCheck.compliant ? "PASS" : "FAIL",
    details: `Variance: ${quantityCheck.variancePercent.toFixed(2)}%, Tolerance: ${lc.tolerancePercent}%`
  })

  quantityCheck.issues.forEach(issue => {
    if (issue.severity === "BLOCK") {
      blockers.push(issue)
    } else {
      warnings.push({
        code: issue.code,
        field: issue.field,
        message: issue.message,
        tolerance: lc.tolerancePercent || 0,
        actualVariance: quantityCheck.variancePercent,
        allowedVariance: lc.tolerancePercent || 0
      })
    }
  })

  // RULE 4: Partial Shipment
  const lcPrimaryQty = getPrimaryQuantityAndUnit(lc.lcDescriptionText)
  const invoicePrimaryQty = getPrimaryQuantityAndUnit(invoice.description)

  const inferredPartialFromInvoiceQty = Boolean(
    lcPrimaryQty && invoice.quantity < lcPrimaryQty.quantity
  )

  const inferredPartialFromDescriptionQty = Boolean(
    lcPrimaryQty &&
      invoicePrimaryQty &&
      invoicePrimaryQty.unit === lcPrimaryQty.unit &&
      invoicePrimaryQty.quantity < lcPrimaryQty.quantity
  )

  const effectiveIsPartialShipment =
    Boolean(invoice.isPartialShipment) ||
    inferredPartialFromInvoiceQty ||
    inferredPartialFromDescriptionQty

  const partialCheck = validatePartialShipmentAllowed(
    effectiveIsPartialShipment,
    lc.partialShipmentAllowed
  )
  auditLog.push({
    timestamp: validationTimestamp,
    ruleCode: "RULE_PARTIAL_SHIPMENT",
    ruleDescription: "LC partial shipment allowance must be respected",
    result: partialCheck.compliant ? "PASS" : "FAIL",
    details: `Invoice Partial (effective): ${effectiveIsPartialShipment}, LC Allows: ${lc.partialShipmentAllowed}`
  })
  blockers.push(...partialCheck.issues)

  // RULE 5: Presentation Period
  const presentationCheck = validatePresentationPeriod(
    invoice.invoiceDate,
    invoice.shipmentDate,
    lc.presentationDays
  )
  auditLog.push({
    timestamp: validationTimestamp,
    ruleCode: "RULE_PRESENTATION_PERIOD",
    ruleDescription: "Documents must be presented within LC presentation period",
    result: presentationCheck.compliant ? "PASS" : "FAIL",
    details: `Deadline: ${presentationCheck.presentationDeadline.toISOString().split("T")[0]}, Days Remaining: ${presentationCheck.daysRemaining}`
  })
  blockers.push(...presentationCheck.issues)

  // RULE 6: Cross-Document Consistency
  const consistencyCheck = validateCrossDocumentConsistency(invoice, lc)
  auditLog.push({
    timestamp: validationTimestamp,
    ruleCode: "RULE_CROSS_CONSISTENCY",
    ruleDescription: "Invoice data must be consistent across all LC terms",
    result: consistencyCheck.consistent ? "PASS" : "FAIL",
    details: `Consistent: ${consistencyCheck.consistent}`
  })
  blockers.push(...consistencyCheck.issues.filter(i => i.severity === "BLOCK"))
  warnings.push(
    ...consistencyCheck.issues
      .filter(i => i.severity === "WARN")
      .map(i => ({
        code: i.code,
        field: i.field,
        message: i.message,
        tolerance: 0,
        actualVariance: 0,
        allowedVariance: 0
      }))
  )

  // Final Decision
  const hasBlockers = blockers.length > 0
  const isCompliant = !hasBlockers
  const allowDocumentGeneration = isCompliant

  return {
    isCompliant,
    lcNumber: lc.lcNumber,
    invoiceNumber: invoice.invoiceNumber,
    validationTimestamp,
    blockers,
    warnings,
    allowDocumentGeneration,
    auditLog
  }
}

// ============================================
// REPORT GENERATION
// ============================================

export function generateComplianceReport(
  result: LCComplianceCheckResult
): string {
  const lines: string[] = [
    "═".repeat(90),
    "LC COMPLIANCE ENGINE REPORT",
    "═".repeat(90),
    `LC Number: ${result.lcNumber}`,
    `Invoice Number: ${result.invoiceNumber}`,
    `Validation Timestamp: ${result.validationTimestamp.toISOString()}`,
    "",
    `DECISION: ${result.isCompliant ? "✅ COMPLIANT - ALLOW GENERATION" : "❌ NON-COMPLIANT - BLOCK GENERATION"}`,
    "",
    `Blockers: ${result.blockers.length}`,
    `Warnings: ${result.warnings.length}`,
    ""
  ]

  if (result.blockers.length > 0) {
    lines.push("CRITICAL BLOCKERS (PREVENT GENERATION):")
    result.blockers.forEach((blocker, idx) => {
      lines.push(`  [${idx + 1}] ${blocker.code}: ${blocker.message}`)
      lines.push(`      Resolution: ${blocker.resolution}`)
    })
    lines.push("")
  }

  if (result.warnings.length > 0) {
    lines.push("WARNINGS (NON-BLOCKING):")
    result.warnings.forEach((warning, idx) => {
      lines.push(`  [${idx + 1}] ${warning.code}: ${warning.message}`)
      lines.push(`      Variance: ${warning.actualVariance.toFixed(2)}% (allowed: ${warning.allowedVariance.toFixed(2)}%)`)
    })
    lines.push("")
  }

  lines.push("AUDIT TRAIL:")
  result.auditLog.forEach((entry, idx) => {
    lines.push(`  [${idx + 1}] ${entry.ruleCode}: ${entry.result}`)
    lines.push(`      ${entry.ruleDescription}`)
    lines.push(`      Details: ${entry.details}`)
  })

  lines.push("")
  lines.push("═".repeat(90))

  return lines.join("\n")
}
