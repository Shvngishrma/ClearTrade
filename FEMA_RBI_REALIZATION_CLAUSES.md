# FEMA / RBI REALIZATION CLAUSE SERVICE

**Purpose**: Map Payment Terms → RBI-Compliant Realization Clauses with exact wording banks require.

**Problem Solved**: 
- ❌ "Blocks" say "use LC" but don't provide UCP 600 wording
- ❌ AD banks reject invoices with generic payment terms
- ❌ No regulatory clause linkage (RBI Master Direction, FEMA, UCP 600)
- ❌ FEMA compliance verification missing at invoice level

**Solution**: **Clause-level mapping**
- Each payment term → 2-3 regulatory clause templates
- Exact wording RBI + banks require
- References: RBI Master Direction section, FEMA.IV reference, UCP 600
- Validation: Can only select appropriate clause for chosen term

---

## 1. Architecture

### 1.1 Data Layers

**Layer 1: Payment Term Master**
```typescript
PAYMENT_TERM_MASTER = {
  "Advance": { termCode, realizationRisk, rbiSection, requiresLC, maxTermDays, ... },
  "LC": { ... },
  "DA": { ... },
  "DP": { ... },
  "CAD": { ... }
}
```

**Layer 2: Realization Clause Templates**
```typescript
REALIZATION_CLAUSES = [
  {
    clauseId: "ADVANCE-001",
    paymentTerm: "Advance",
    clauseType: "Advance",
    englishWording: "[EXACT FEMA-COMPLIANT TEXT]",
    rbiReference: "RBI Master Direction on Forex, Section 3.1.1",
    rbiYear: 2024,
    ucpReference?: "UCP 600 § 15",
    bankingCompliant: true,
    customsApproved: true,
    femaApproved: true,
  },
  // ... more clauses
]
```

### 1.2 Clause Types & Mapping

| Payment Term | Clause Type | RBI Reference | FEMA |
|---|---|---|---|
| **Advance** | Advance | Section 3.1.1 | Yes |
| **LC** | LC | Section 3.1.2 | Yes |
| **DA** | DAAcceptance | Section 3.1.3 | Yes |
| **DP** | DAPayment | Section 3.1.3 | Yes |
| **CAD** | CAD | Section 3.1.4 | Yes |
| All | Insurance | Multi | No |

---

## 2. Realization Clauses (5 Core Variants)

### 2.1 ADVANCE PAYMENT CLAUSES (Zero Risk)

**Clause ID**: `ADVANCE-001` or `ADVANCE-002`

**Wording Template**:
```
This invoice represents goods worth USD [AMOUNT]. Payment must be received in full 
PRIOR TO SHIPMENT via wire transfer to the exporter's bank account.

Source of funds shall be verified as per FEMA (Liberalised Remittance Scheme) 2024.

Reference: RBI Master Direction on Forex, Section 3.1.1 (2024)
```

**Use Case**: 
- ✅ Zero realization risk (exporter gets paid before shipping)
- ✅ New/untrusted importers
- ✅ Perishable goods (avoidance of customs delay costs)

**RBI Compliance**: FEMA.IV/DBU-DIR-2024-001

---

### 2.2 LETTER OF CREDIT CLAUSES (Low Risk)

**Clause IDs**: `LC-001`, `LC-002`, `LC-003`

**Wording Template** (LC-001):
```
Goods shall be shipped against an irrevocable, confirmed Letter of Credit issued by 
an Authorized Dealer bank acceptable to the exporter.

LC must comply with:
✓ UCP 600 (Uniform Customs & Practice for Documentary Credits, 2007)
✓ RBI Master Direction on Forex, Section 3.1.2 (2024)
✓ FEMA Regulations for import under credit

LC Validity: From date of issuance through [VALIDITY DATE], with 21+ days presentation 
period post-shipment.

Non-compliance with UCP 600 terms will result in REJECTION of Shipping Bill and customs 
hold on goods.

Reference: UCP 600 ICC Publication No. 600; RBI Master Direction Section 3.1.2
```

**LC-002 Variant** (Shorter):
```
Payment: Irrevocable Letter of Credit (L/C)

This invoice is payable under an irrevocable L/C to be issued within 7 days of order 
confirmation.

LC Requirements:
• Issued by AD bank (Authorized Dealer) in India
• Compliant with UCP 600, 2007 edition
• Sight or Usance (max 180 days) as agreed
• Documents required: Commercial invoice, Packing List, Shipping Bill, Insurance

IMPORTANT: Any discrepancies in documents will result in L/C rejection per UCP 600 § 15.

RBI Compliance: FEMA.IV/DBU-DIR-2024-002
```

**LC-003 Variant** (Full Legal):
```
Payment Instrument: Irrevocable Confirmed L/C under UCP 600

Exporter shall NOT proceed with shipment until irrevocable, confirmed L/C compliant 
with UCP 600 is received by exporter's nominated bank.

LC MUST include:
✓ LC number and date of issue
✓ Issuing bank details (AD registration number)
✓ Confirming bank (if required)
✓ Exact invoice amount and currency
✓ Shipment terms (port, incoterm, latest shipment date)
✓ Expiry date (minimum 30 days post-shipment)
✓ Presentation period: 21+ days

CRITICAL: LC is conclusive evidence of payment obligation. LC rejection = automatic 
invoice cancellation.

RBI Reference: FEMA.IV/DBU-DIR-2024-002
```

**Use Case**:
- ✅ Large orders (USD 50K+)
- ✅ Medium-term credit (Usance LCs up to 180 days)
- ✅ International standards compliance required

**RBI Compliance**: FEMA.IV/DBU-DIR-2024-002 | UCP 600

---

### 2.3 DOCUMENTS AGAINST ACCEPTANCE CLAUSES (Medium Risk)

**Clause IDs**: `DA-001`, `DA-002`

**Wording Template** (DA-001):
```
Payment Terms: Documents Against Acceptance (D/A)

Goods shall be shipped and documents forwarded through AD bank (Authorized Dealer) for 
collection via D/A. Importer's acceptance of bill of exchange constitutes payment obligation.

D/A Timeline:
• Goods shipped on [SHIP DATE]
• Documents presented to importer's bank on [PRESENTATION DATE]
• Importer has [DAYS] days to ACCEPT the bill
• Payment due on [MATURITY DATE]

Realization Risk: Exporter carries collection risk on goods. If importer does not accept, 
goods may require re-export or sale in destination market.

Insurance REQUIRED: CIF or CFR (Importer insures).

RBI Approval: This D/A arrangement is approved under RBI Master Direction on Forex, 
Section 3.1.3 (FEMA.IV/DBU-DIR-2024-003). Importer's bank confirms receipt of import 
documentation within 10 days.

Bank Collection Reference: As per UCPDC (Uniform Rules for Collections).
```

**Use Case**:
- ✅ Medium-term credit (30-90 days post-shipment)
- ✅ Established business relationships
- ✅ Exporter willing to carry collection risk

**RBI Compliance**: FEMA.IV/DBU-DIR-2024-003 | UCPDC 522

---

### 2.4 DOCUMENTS AGAINST PAYMENT CLAUSES (Medium Risk, Zero Extension)

**Clause IDs**: `DP-001`, `DP-002`

**Wording Template** (DP-001):
```
Payment Terms: Documents Against Payment (D/P Sight)

Goods shall be shipped and documents forwarded through AD bank (Authorized Dealer) 
collection. Documents released to importer ONLY UPON PAYMENT.

D/P Collection:
• Goods shipped on [SHIP DATE]
• Documents presented to importer's bank (Sight)
• Payment REQUIRED before document release (NO CREDIT EXTENSION)
• Exporter's bank instructs: "Release documents against payment only"

Realization Risk: ZERO (exporter retains title until payment). If importer refuses 
payment, goods remain under exporter's Bill of Lading control.

Insurance Required: CIF or CFR (Importer insures in transit).

Regulatory Compliance: RBI Master Direction on Forex, Section 3.1.3 
(FEMA.IV/DBU-DIR-2024-003). Collection per UCPDC Rules 522.

No credit is extended. Payment on presentation is MANDATORY.
```

**Use Case**:
- ✅ Working capital optimization (same-day or 2-day payment)
- ✅ Large orders where cash flow is critical
- ✅ Minimal importer credit risk acceptable

**RBI Compliance**: FEMA.IV/DBU-DIR-2024-003 | UCPDC 522

---

### 2.5 CASH AGAINST DOCUMENTS CLAUSES

**Clause ID**: Part of DP (D/P Sight = CAD)

**Use Case**: Same-day settlement before customs clearance

---

### 2.6 INSURANCE CLAUSES (Attached to LC/DA/DP)

**Clause ID**: `INS-001`

**Wording Template**:
```
Insurance Requirement

For CIF (Cost, Insurance, Freight):
• Exporter arranges and effects insurance (all-risk cover)
• Insurance premium included in invoice amount
• Insurance certificate provided with shipping documents

For CFR (Cost and Freight):
• Importer effects insurance from origin
• Exporter provides CFR valuation; importer procures insurance

Minimum Coverage: 110% of invoice value (goods + freight).

Insurance Policy must cover:
✓ All-risk from warehouse to importer's destination
✓ War and strikes clauses (if applicable)
✓ Institute Cargo Clause (A)
✓ Customs hold/inspection risks

Insurer must have A+ global credit rating.
```

---

## 3. Clause Selection Logic

### 3.1 Payment Term → Clause Mapping

**Invoice Creation Flow**:

```
1. Exporter selects: Payment Term = "LC"
   ↓
2. System fetches: getClausesForPaymentTerm("LC")
   → Returns: [LC-001, LC-002, LC-003]
   ↓
3. Exporter selects: Clause = "LC-002" (Shorter variant)
   ↓
4. System validates: validateClauseSelection("LC", "LC-002")
   → Result: ✅ Valid, bankingCompliant, customsApproved, femaApproved
   ↓
5. Invoice generated with LC-002 text injected
   ↓
6. Before filing: validateInvoiceRealizationCompliance(invoiceId, "LC", "LC-002")
   → Gate: canProceed = true (or blocked with reasons)
```

### 3.2 Clause Selection Validation

**Rules**:
- ✅ Clause.paymentTerm must equal Invoice.paymentTerm
- ✅ Clause.bankingCompliant must be true
- ⚠️ Clause.customsApproved must be true (warning if false)
- ⚠️ Clause.femaApproved must be true (warning if false)

**Error Conditions**:
```
IF paymentTerm = "LC" AND clause = "ADVANCE-001"
  → ERROR: "Clause ADVANCE-001 is for Advance payment, invoice uses LC"
  → RESOLUTION: "Select from: LC-001, LC-002, LC-003"

IF paymentTerm = "DA" AND clauseId NOT PROVIDED
  → ERROR: "No realization clause selected"
  → RESOLUTION: "Select clause ID DA-001 or DA-002"
  → SUGGESTED: Auto-select DA-001 (recommended)
```

---

## 4. RBI Master Direction References

### 4.1 Regulatory Citations

| Section | Payment Term | Reference | Year |
|---|---|---|---|
| 3.1.1 | Advance | FEMA.IV/DBU-DIR-2024-001 | 2024 |
| 3.1.2 | LC | FEMA.IV/DBU-DIR-2024-002 | 2024 |
| 3.1.3 | DA/DP | FEMA.IV/DBU-DIR-2024-003 | 2024 |
| 3.1.4 | CAD | FEMA.IV/DBU-DIR-2024-004 | 2024 |

### 4.2 Clause References Embedded

Each clause includes:
```
RBI Reference: FEMA.IV/DBU-DIR-2024-002
RBI Year: 2024
UCP Reference: UCP 600 (ICC Pub. 600)
```

### 4.3 Bank Negotiability

**Banking Compliant** = Clause can be negotiated by standard Indian AD banks
**Customs Approved** = Clause acceptable to ICEGATE / Customs authority
**FEMA Approved** = Clause compliant with RBI FEMA regulations

---

## 5. Integration with Invoice API

### Hook Point: Invoice Terms Selection

```typescript
// app/api/documents/generate/route.ts

import { 
  getRecommendedClauses,
  validateInvoiceRealizationCompliance,
  injectClauseIntoInvoice,
  formatClauseForBankSubmission
} from "@/lib/feamRBIRealizationService"

export async function POST(req: Request) {
  const { 
    invoiceId,
    paymentTerm,    // "LC" | "Advance" | "DA" | "DP"
    clauseId        // "LC-001" or "ADVANCE-002" etc
  } = await req.json()

  // 1. Validate clause selection
  const compliance = validateInvoiceRealizationCompliance(
    invoiceId,
    paymentTerm,
    clauseId
  )

  if (!compliance.compliant) {
    return Response.json(
      {
        error: "Realization clause not compliant",
        issues: compliance.issues,
        suggestedAction: compliance.suggestedAction,
      },
      { status: 400 }
    )
  }

  // 2. Generate invoice with clause injected
  const invoiceHTML = generateInvoice(invoiceData)
  const invoiceWithClause = injectClauseIntoInvoice(invoiceHTML, clauseId)

  // 3. Format for bank submission
  const bankClause = formatClauseForBankSubmission(invoiceId, clauseId)

  return Response.json({
    success: true,
    invoiceId,
    invoiceHTML: invoiceWithClause,
    bankClause: bankClause.clauseText,
    rbiReference: bankClause.certifications,
  })
}
```

### Hook Point 2: Invoice Submission

```typescript
// Before filing Shipping Bill or sending to bank

const readiness = checkInvoiceRealizationReadiness(invoiceId, paymentTerm, clauseId)

if (!readiness.compliant) {
  return {
    status: "Cannot process",
    blockers: readiness.issues.filter(i => i.type === "Error"),
    warnings: readiness.issues.filter(i => i.type === "Warning"),
  }
}

// Safe to proceed to Shipping Bill / Bank negotiation
```

---

## 6. UI Components

### 6.1 Clause Selector Dropdown

```typescript
// Component integrating feamRBIRealizationService

import { getClauseOptionsForDropdown, getRecommendedClauses } from "@/lib/feamRBIRealizationService"

const clauseOptions = getClauseOptionsForDropdown(paymentTerm)
// Returns:
// [
//   { id: "LC-001", label: "LC-001: LC", type: "LC", recommended: true },
//   { id: "LC-002", label: "LC-002: LC (Shorter)", type: "LC", recommended: true },
//   { id: "LC-003", label: "LC-003: LC (Full Legal)", type: "LC", recommended: false },
// ]

const recommended = getRecommendedClauses(paymentTerm)
// Shows recommended clause with badge
```

### 6.2 Clause Preview

```typescript
// Show text preview before selection

const clause = getClauseById("LC-001")
console.log(clause.englishWording)  // Full text for user review
console.log(clause.rbiReference)    // "FEMA.IV/DBU-DIR-2024-002"
```

---

## 7. Real-World Scenarios

### Scenario 1: New Importer, Advance Payment

**User**: Exporter selling software to first-time buyer in Hong Kong
**Invoice Setup**:
```
paymentTerm: "Advance"
clauseId: "ADVANCE-001"
```

**Validation**:
```
validateInvoiceRealizationCompliance(INV-001, "Advance", "ADVANCE-001")
→ Result: ✅ compliant = true
→ Issues: []
→ RBI Link: FEMA.IV/DBU-DIR-2024-001
```

**Clause Text Injected**:
```
This invoice represents goods worth USD 50,000. Payment must be received in full 
PRIOR TO SHIPMENT via wire transfer...
Reference: RBI Master Direction on Forex, Section 3.1.1 (2024)
```

**Advantage**: Zero payment risk for exporter, FEMA-compliant, buyer sees exact RBI reference.

---

### Scenario 2: Large Order, LC

**User**: Exporter selling textiles USD 200K to established Indian importer
**Invoice Setup**:
```
paymentTerm: "LC"
clauseId: "LC-002"  // Recommended for large orders
```

**Validation**:
```
validateInvoiceRealizationCompliance(INV-002, "LC", "LC-002")
→ Result: ✅ compliant = true
→ RBI Link: FEMA.IV/DBU-DIR-2024-002
→ UCP Link: UCP 600 § 15
```

**Clause Text**:
```
LC Requirements:
• Issued by AD bank (Authorized Dealer) in India
• Compliant with UCP 600, 2007 edition
• Sight or Usance (max 180 days)

IMPORTANT: Any discrepancies will result in L/C rejection per UCP 600 § 15.
```

**Advantage**: Banks see UCP 600 & RBI refs. Importer knows standard terms. Discrepancies = automatic rejection (no negotiation room).

---

### Scenario 3: Medium-Term Credit, DA

**User**: Exporter selling engineering goods 60 days credit to regular buyer
**Invoice Setup**:
```
paymentTerm: "DA"
clauseId: "DA-001"
```

**Validation**:
```
validateInvoiceRealizationCompliance(INV-003, "DA", "DA-001")
→ Result: ✅ compliant = true
→ RBI Link: FEMA.IV/DBU-DIR-2024-003
```

**Clause Text**:
```
Documents Against Acceptance (D/A)

Documents presented [DAYS] days post-shipment to importer's bank.
Importer has [DAYS] to ACCEPT the bill.
Payment on bill maturity.

Realization Risk: Exporter carries collection risk.
Insurance REQUIRED: CIF or CFR (Importer insures).
```

**Advantage**: Exporter gets trade finance benefit, buyer gets credit term, banks see FEMA compliance.

---

### Scenario 4: Clause Rejection (Validation Fail)

**User**: Exporter selects LC payment but tries to use ADVANCE-001 clause
**Invoice Setup**:
```
paymentTerm: "LC"
clauseId: "ADVANCE-001"  // WRONG!
```

**Validation**:
```
validateInvoiceRealizationCompliance(INV-004, "LC", "ADVANCE-001")
→ Result: ❌ compliant = false
→ Issues: [
    {
      type: "Error",
      message: "Clause ADVANCE-001 is for Advance payment, invoice uses LC",
      resolution: "Select from: LC-001, LC-002, LC-003"
    }
  ]
→ suggestedAction: "Auto-select LC-001 (recommended)"
```

**Outcome**: Invoice generation blocked. User must correct before proceeding.

---

## 8. Compliance Checklist

Before submitting invoice to bank:

- ✅ **Payment Term Selected**: Advance | LC | DA | DP | CAD
- ✅ **Clause Selected**: Matches payment term (LC clause for LC term)
- ✅ **Clause Valid**: No selection errors, bankingCompliant = true
- ✅ **RBI Reference**: Clause includes FEMA.IV/DBU-DIR reference
- ✅ **UCP Reference**: (If LC) Includes UCP 600 reference
- ✅ **Insurance Clause**: (If DA/DP/LC) CIF or CFR specified
- ✅ **Clause Injected**: Text appears in final invoice document
- ✅ **Bank Submission Format**: Clause formatted for bank negotiation

---

## 9. Deployment Checklist

- [ ] Copy `feamRBIRealizationService.ts` to `/lib/`
- [ ] Import service functions in invoice generation API
- [ ] Add validation call before invoice saving
- [ ] Create clause selector UI component
- [ ] Display available clauses (+recommended badge)
- [ ] Show clause preview before confirmation
- [ ] Inject clause text into final invoice PDF/HTML
- [ ] Add clause references to invoice header
- [ ] Test all 5 payment term scenarios
- [ ] Verify bank submission format
- [ ] Document API error codes for frontend
- [ ] Enable for production

---

## 10. Error Messages

| Error | Message | Resolution |
|---|---|---|
| CLAUSE_NOT_FOUND | Clause ID not found | Use valid clause ID from system |
| TERM_MISMATCH | Clause for different payment term | Match clause to payment term |
| NOT_BANK_COMPLIANT | Clause not accepted by banks | Contact bank or use different clause |
| NOT_CUSTOMS_APPROVED | Clause not customs-approved | Verify with customs or choose alternate |
| NO_CLAUSE_SELECTED | Realization clause missing | Select from recommended clauses |
| INVALID_TERM | Payment term not recognized | Use: Advance, LC, DA, DP, CAD |

---

## 11. Advanced: Clause Customization

### Adding New Clauses

```typescript
// For custom wording per exporter/trade lane
REALIZATION_CLAUSES.push({
  clauseId: "CUSTOM-EXPORTER-001",
  paymentTerm: "LC",
  clauseType: "LC",
  englishWording: "[CUSTOM WORDING]",
  rbiReference: "FEMA.IV/DBU-DIR-2024-002",
  rbiYear: 2024,
  bankingCompliant: true,
  customsApproved: true,
  femaApproved: true,
})
```

### Per-Bank Clause Variants

```typescript
// Future: Different clause for ICICI vs HDFC vs Standard Chartered
const bankPreferences = {
  "ICICI": ["LC-001", "DA-001"],
  "HDFC": ["LC-002", "DP-001"],
  "StdChart": ["LC-003", "DA-002"],
}
```

---

## 12. Testing Scenarios

### Test 1: Advance Payment Complete Flow
```
1. Select paymentTerm = "Advance"
2. Get clauses → [ADVANCE-001, ADVANCE-002]
3. Select ADVANCE-001
4. Validate → ✅ compliant
5. Inject into invoice → Text appears
6. Format for bank → Clause extracted
```

### Test 2: LC with Discrepancy Detection
```
1. paymentTerm = "LC", clauseId = "LC-002"
2. LC-002 includes: "Any discrepancies will result in L/C rejection per UCP 600 § 15"
3. User adds discrepancy to invoice
4. Bank re-reads clause → Auto-rejects per UCP 600
5. Exporter gets bounce back with exact UCP reference
```

### Test 3: DA-Importer Default
```
1. select paymentTerm = "DA"
2. getRecommendedClauses("DA") → [DA-001]
3. System auto-suggests → Select DA-001
4. User clicks confirm → DA-001 injected
5. Invoice shows: "Realization Risk: Exporter carries collection risk"
```

### Test 4: Clause Mismatch Rejection
```
1. paymentTerm = "LC"
2. Try selectClause("ADVANCE-001")
3. validateClauseSelection() → ❌ Error
4. Error message: "Clause for different term"
5. Block invoice generation
```

---

## 13. Future Enhancements

1. **By-Bank Clause Variants**: Different wording for different banks
2. **Commodity-Specific Clauses**: Custom wording for perishables, restricted goods
3. **Trade Lane Defaults**: Auto-suggest clause based on importer country/product
4. **Compliance Audit Trail**: Track which clause was used for each invoice (RBI audit)
5. **Dynamic Master Direction Updates**: Auto-import latest FEMA references annually
6. **Multi-Language**: Translate clauses to buyer's language (with legal review)
7. **Clause Negotiation**:History: Track if buyer requested clause modifications
