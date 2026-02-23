# LC TERM LOCK SERVICE
## UCP 600 Strict Compliance Engine

**Status:** ✅ IMPLEMENTED  
**Deployment Date:** 2026-02-06  
**Components:** lib/lcTermLockService.ts + Prisma models (LCLock, LCComplianceReport, LCLockAudit)

---

## Architecture: The 5 Compliance Pillars

### Phase 1: LC Compliance Engine (UCP 600 Exactness) ✅ THIS DOCUMENT
**Problem:** LC decoration ≠ LC compliance  
**Solution:** Strategic locks + 5-checkpoint validation

### Phases 2-5: (Planned)
**2️⃣ Payment Gateway / Realization Tracking** — Track fund flow through AD banks  
**3️⃣ Insurance / Risk Management** — CIF/CFR insurance rules per incoterm  
**4️⃣ Harmonized Tariff / Document Generation** — HS code links to auto-document creation  
**5️⃣ Audit Trail / RBI Reporting** — End-to-end transaction visibility for RBI

---

## Why LC Compliance Was Broken

**Before (Phase 1 Baseline):**
```typescript
// LC Flag + Number = "LC Decoration"
interface ComplianceConfig {
  paymentTerms: "LC"  // ✓ Flag set
  lcNumber: "LC/USA/2026/00001"  // ✓ Number present
  lcItems: [...] // ✓ Items matched
}
// But NO enforcement of:
// - Shipment date windows
// - Partial shipment rules
// - Tolerance percentages
// - Presentation deadlines
// - Documentary cross-checks
```

**Result:** Bank queries → rejections → delayed payments

---

## New: LC Term Lock Service

### Architectural Layers

```
┌─────────────────────────────────────────┐
│   API Layer: Invoice/Document Submission │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│  LC Lock Validation Layer (5 Checkpoints)           │
│  ├─ Checkpoint 1: Shipment Date                      │
│  ├─ Checkpoint 2: Quantity (with tolerance)          │
│  ├─ Checkpoint 3: Presentation Period                │
│  ├─ Checkpoint 4: Documentary Consistency            │
│  └─ Checkpoint 5: Special Conditions                 │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│  Output: LCComplianceReport (Bank-Ready)             │
│  - Compliance score (0-100%)                         │
│  - Issue list + resolutions                          │
│  - Audit trail (lockId, reportId)                    │
│  - Ready for bank submission ✓                       │
└─────────────────────────────────────────────────────┘
```

---

## The 5-Checkpoint Validation Model

### Checkpoint 1️⃣: Shipment Date Validation
**UCP 600 § 15**

**Validates:**
- Shipment date within LC window (from-to dates)
- Not after "Latest Date" in LC
- Not after LC expiry date

```typescript
export function validateShipmentDate(
  lcLock: LCLockRecord,
  shipmentDate: Date
): ShipmentDateValidation {
  return {
    passed: true,
    checkpoint: "shipment-date",
    severity: "Info",
    message: "Shipment date within LC window",
    actualDate: shipmentDate,
    allowedWindow: { from: Date, to: Date }
  }
}
```

**Example:**
- LC: "Latest shipment 31 March 2026"
- Invoice: Shipment date 15 March 2026 → ✅ PASS
- Invoice: Shipment date 05 April 2026 → ❌ FAIL

---

### Checkpoint 2️⃣: Quantity Validation
**UCP 600 § 30 (Tolerance Rules)**

**Validates:**
- Exact match: Invoice qty = LC qty
- OR: Within tolerance (if LC specifies ±X%)
- OR: Partial shipment allowed & qty < LC qty
- Raises error if multiple conditions violated

```typescript
export function validateQuantity(
  lcLock: LCLockRecord,
  quantityCheck: QuantityCheckInput  // { invoiceQuantity, invoiceUnit, lineItemIndex }
): QuantityValidation {
  // Returns: passed, lcQuantity, actualQuantity, tolerance, variance
}
```

**Example Scenarios:**
```
Scenario 1: Exact Match Required
  LC: 1000 units
  Invoice: 1000 units
  Result: ✅ PASS

Scenario 2: Tolerance ±5%
  LC: 1000 units (±5% allowed)
  Invoice: 950 units (5% below LC)
  Result: ✅ PASS (within tolerance min: 950, max: 1050)

Scenario 3: Partial Shipment Not Allowed
  LC: 1000 units (partial: NO)
  Invoice: 900 units
  Result: ❌ FAIL (partial not permitted)

Scenario 4: Tolerance Exceeded
  LC: 1000 units (±2% allowed)
  Invoice: 950 units (5% below)
  Result: ❌ FAIL (actual variance -5% > allowed -2%)
```

---

### Checkpoint 3️⃣: Presentation Period Validation
**UCP 600 § 14 (Presentation Deadline)**

**Validates:**
- Documents presented within X days after shipment
- Presentation before LC expiry
- Calculates days remaining to deadline

```typescript
export function validatePresentationPeriod(
  lcLock: LCLockRecord,
  presentationCheck: PresentationCheckInput  // { shipmentDate, presentationDate }
): PresentationValidation {
  return {
    passed: true,
    documentationDeadline: Date,
    daysRemaining: 14,
    // ...
  }
}
```

**Example:**
```
LC: "21 days after shipment"
Shipment Date: 1 March 2026
Presentation Deadline: 22 March 2026
Document Submission: 18 March 2026
Result: ✅ PASS (4 days before deadline)

If submitted 25 March: ❌ FAIL (3 days after deadline)
```

---

### Checkpoint 4️⃣: Documentary Consistency Cross-Check
**UCP 600 § 14 (All Documents Consistent)**

**Validates:**
- All required documents present (Invoice, Packing List, Shipping Bill, BOL)
- Quantity consistent across all documents
- Descriptions match
- Port names match
- Shipment date consistent

```typescript
export function validateDocumentaryConsistency(
  lcLock: LCLockRecord,
  documents: DocumentaryData  // { invoice, packingList, shippingBill, billOfLading }
): DocumentaryValidation {
  return {
    passed: true,
    inconsistencies: [
      { document1: "Invoice", document2: "Packing List", field: "quantity", value1: 1000, value2: 950 }
    ]
  }
}
```

**Cross-Check Matrix:**
| Document 1 | Document 2 | Field | Must Match |
|-----------|-----------|-------|-----------|
| Invoice | Packing List | Quantity | ✓ Exact |
| Invoice | Shipping Bill | Quantity | ✓ Exact |
| Shipping Bill | Bill of Lading | Quantity | ✓ Exact |
| Shipping Bill | LC | Port of Loading | ✓ Exact |
| Bill of Lading | Shipping Bill | Shipment Date | ~ Reasonable |

---

### Checkpoint 5️⃣: Special Conditions Validation
**UCP 600 § 24 (Mandatory Undertakings)**

**Validates:**
- All mandatory special conditions satisfied
- Proof documents present (AUTH Certificate, Inspection Report, etc.)

```typescript
export function validateSpecialConditions(
  lcLock: LCLockRecord,
  conditionStatuses: SpecialConditionStatus[]  // { code, satisfied, evidenceDocuments }
): SpecialConditionValidation {
  return {
    passed: true,
    failedConditions: []
  }
}
```

**Example Special Conditions:**
```
LC Special Conditions:
1. "AUTH Certificate required before payment"
   → Status: Satisfied (document attached)
2. "Third-party inspection required"
   → Status: Not Satisfied (inspection report missing)
```

---

## Core Functions

### 1️⃣ Lock LC Terms (Immutable Snapshot)

```typescript
export function lockLCTerms(
  lcTerms: LCTerms,
  exporterId: string,
  userId: string
): LCLockRecord {
  // Creates immutable snapshot of LC from bank
  // Once locked, terms cannot be modified
  // Returns: lockId, lockRecord, audit trail
}
```

**Usage:**
```typescript
const lockRecord = lockLCTerms(
  {
    lcNumber: "LC/TCS/USA/2026/00001",
    issuingBank: "CITIBANK NY",
    shipmentWindow: { from: new Date("2026-03-01"), to: new Date("2026-03-31") },
    tolerance: { quantityPlusPercent: 5, quantityMinusPercent: 5 },
    // ... other LC terms
  },
  exporterId: "exp-001",
  userId: "user-123"
)
```

**Result:**
```
lockId: "LC-LOCK-LC/TCS/USA/2026/00001-1707283200"
status: "Active"
expiresAt: 2026-05-31  // Same as LC expiryDate
invoicesGenerated: 0
discrepanciesFound: 0
```

---

### 2️⃣ Validate & Generate Compliance Report

```typescript
export function generateLCComplianceReport(
  lcLock: LCLockRecord,
  check: ComplianceCheckInput  // Invoice data + documents
): LCComplianceReport {
  // Runs all 5 checkpoints
  // Calculates compliance score
  // Returns bank-ready report
}
```

**Input:**
```typescript
{
  invoiceId: "INV-2026-00042",
  shipmentDate: new Date("2026-03-15"),
  presentationDate: new Date("2026-03-18"),
  quantities: [
    { invoiceQuantity: 1000, invoiceUnit: "PCS", lineItemIndex: 0 },
    { invoiceQuantity: 500, invoiceUnit: "PCS", lineItemIndex: 1 }
  ],
  documents: {
    invoice: { quantity: 1500, description: "Cotton Fabrics", unitPrice: 5.50 },
    packingList: { quantity: 1500, weight: 2500 },
    shippingBill: { quantity: 1500, portOfLoading: "JAWAHARLAL NEHRU (Nhava Sheva)" },
    billOfLading: { quantity: 1500, onBoardDate: new Date("2026-03-15") }
  },
  validateBy: "user-123"
}
```

**Output:**
```typescript
{
  reportId: "REPORT-LC/TCS/USA/2026/00001-INV-2026-00042-1707283300",
  lockId: "LC-LOCK-...",
  lcNumber: "LC/TCS/USA/2026/00001",
  invoiceId: "INV-2026-00042",
  
  // Checkpoints
  checkpoints: [
    { passed: true, checkpoint: "shipment-date", message: "Shipment within window" },
    { passed: true, checkpoint: "quantity", message: "Qty within tolerance" },
    { passed: true, checkpoint: "presentation-period", message: "Presented in time" },
    { passed: true, checkpoint: "documentary-consistency", message: "All docs consistent" },
    { passed: true, checkpoint: "special-conditions", message: "All conditions met" }
  ],
  
  // Summary
  totalCheckpoints: 5,
  checkpointsPassed: 5,
  checkpointsFailed: 0,
  complianceScore: 100,
  compliant: true,  // ✅ Ready for bank submission
  
  issues: [],  // No issues
  
  validatedAt: 2026-02-06T10:30:00Z,
  validatedBy: "user-123"
}
```

---

### 3️⃣ Format for Bank Submission

```typescript
export function formatLCComplianceForBank(report: LCComplianceReport): string {
  // Returns formatted compliance certification document
  // Ready to send to bank or include in email
}
```

**Output Example:**
```
═══════════════════════════════════════════════════════════════
LC COMPLIANCE CERTIFICATION REPORT
═══════════════════════════════════════════════════════════════

LC Number: LC/TCS/USA/2026/00001
Invoice ID: INV-2026-00042
Report ID: REPORT-LC/TCS/USA/2026/00001-INV-2026-00042-1707283300
Validated: 2026-02-06T10:30:00Z
Validated By: user-123

COMPLIANCE CHECKPOINTS
─────────────────────────────────────────────────────────────────
✓ Checkpoint 1: SHIPMENT-DATE
  Status: Info
  Shipment date 2026-03-15 is within LC window

✓ Checkpoint 2: QUANTITY
  Status: Info
  Quantity 1500 within tolerance ±5% (1425-1575)

✓ Checkpoint 3: PRESENTATION-PERIOD
  Status: Info
  Presentation within 21-day period (deadline: 2026-04-05)

✓ Checkpoint 4: DOCUMENTARY-CONSISTENCY
  Status: Info
  All required documents present and consistent

✓ Checkpoint 5: SPECIAL-CONDITIONS
  Status: Info
  No special conditions in this LC

SUMMARY
─────────────────────────────────────────────────────────────────
Total Checkpoints: 5
Passed: 5
Failed: 0
Compliance Score: 100%
Status: ✓ COMPLIANT (Ready for bank)

═══════════════════════════════════════════════════════════════
This report is certified as per UCP 600 compliance rules.
For bank review and acceptance only.
```

---

## Integration Points

### 1. Invoice Generation API
```typescript
// app/api/documents/generate/route.ts

import { lockLCTerms, generateLCComplianceReport } from "@/lib/lcTermLockService"

// Step 1: Lock LC on first invoice under this LC
const lcLock = await prisma.lCLock.findUnique({
  where: { exporterId_lcNumber: { exporterId, lcNumber } }
})

if (!lcLock) {
  // First invoice → create lock
  const locked = lockLCTerms(lcTermsFromBank, exporterId, userId)
  await prisma.lCLock.create({ data: locked })
}

// Step 2: Generate compliance report before output
const report = generateLCComplianceReport(lcLock, {
  invoiceId,
  shipmentDate,
  presentationDate,
  quantities,
  documents,
  validatedBy: userId
})

// Step 3: Block submission if not compliant
if (!report.compliant) {
  return res.status(400).json({
    error: "LC Compliance Failed",
    issues: report.issues,
    reportId: report.reportId
  })
}

// Step 4: Return invoice + compliance report
return {
  invoice: invoiceData,
  complianceReport: formatLCComplianceForBank(report),
  status: "Ready for bank"
}
```

### 2. Invoice Submission Webhook
```typescript
// When invoice is submitted to bank

const report = await prisma.lCComplianceReport.update({
  where: { reportId },
  data: {
    submittedAt: new Date(),
    submittedTo: "CITIBANK NY",
    bankReference: "CONSIGNMENT/2026/00042"
  }
})
```

### 3. Bank Response Tracking
```typescript
// When bank accepts/rejects

const report = await prisma.lCComplianceReport.update({
  where: { reportId },
  data: {
    acceptance: "Accepted",  // or "Rejected"
    // If rejected: log reason for audit
  }
})

// Audit: Create LCLockAudit entry
await prisma.lCLockAudit.create({
  data: {
    lockId,
    lcNumber,
    eventType: "SUBMISSION",
    eventData: {
      reportId,
      submittedTo: "CITIBANK NY",
      acceptance: "Accepted"
    },
    invoiceId,
    timestamp: new Date(),
    userId
  }
})
```

---

## Database Models

### LCLock Table
Stores immutable LC locks for this export transaction.

| Field | Type | Purpose |
|-------|------|---------|
| id | String | Primary key |
| lockId | String (UNIQUE) | Format: `LC-LOCK-{lcNumber}-{timestamp}` |
| lcNumber | String | LC identifier from bank |
| exporterId | String | Exporter creating the lock |
| lockedTerms | JSON | Full LCTerms interface (immutable) |
| status | String | "Active", "Expired", "Cancelled", "Locked" |
| expiresAt | DateTime | Same as LC expiry |
| invoicesGenerated | Int | Counter for audit |
| discrepanciesFound | Int | Counter for compliance failures |
| createdAt | DateTime | Lock creation time |

### LCComplianceReport Table
Bank-ready compliance certification for each invoice.

| Field | Type | Purpose |
|-------|------|---------|
| id | String | Primary key |
| reportId | String (UNIQUE) | Format: `REPORT-{lcNumber}-{invoiceId}-{timestamp}` |
| lockId | String (FK) | Reference to LCLock |
| checkpoints | JSON | Array of CheckpointValidation results |
| complianceScore | Int | 0-100 percentage |
| compliant | Boolean | true = ready for bank |
| issues | JSON | Array of {severity, message, resolution} |
| submittedAt | DateTime | When sent to bank |
| accepta | String | "Accepted", "Rejected", "Pending" |

### LCLockAudit Table
Audit trail of all LC lock events.

| Field | Type | Purpose |
|-------|------|---------|
| id | String | Primary key |
| lockId | String (FK) | Reference to LCLock |
| eventType | String | "LOCKED", "INVOICE_GENERATED", "SUBMISSION", "ACCEPTANCE", etc. |
| eventData | JSON | Event-specific details |
| invoiceId | String | Affected invoice (if applicable) |
| timestamp | DateTime | When event occurred |
| userId | String | Who triggered event |

---

## Compliance Verification

### Checkpoint Success Criteria
| Checkpoint | Success Condition |
|-----------|------------------|
| **Shipment Date** | Date within LC window AND before expiry |
| **Quantity** | Exact match OR within tolerance OR partial allowed |
| **Presentation Period** | Docs submitted within X days of shipment AND before expiry |
| **Documentary Consistency** | All required docs present + zero quantity/description mismatches |
| **Special Conditions** | All mandatory conditions satisfied with proof |

### Compliance Score Calculation
```
Score = (Checkpoints Passed / Total Checkpoints) × 100%

Compliant = True IF:
  - All Error-severity checkpoints passed
  - Warning/Info checkpoints ignored (don't block)
  - complianceScore ≥ 80% (configurable threshold)
```

---

## Error Handling & Resolution

### Checkpoint Failures → Auto-Resolution

```typescript
// Example: Quantity exceeds tolerance

{
  passed: false,
  checkpoint: "quantity",
  severity: "Error",
  message: "Quantity 950 exceeds tolerance ±2% (allowed: 980-1020)",
  resolution: "Adjust invoice quantity to match LC or within tolerance"
}

// User action: Correct invoice quantity or request LC amendment
```

---

## Test Scenarios

### Scenario 1: Perfect LC Compliance ✅
```
LC: 1000 units, ±5% tolerance, shipment 1-31 March, 21-day presentation
Invoice: 1050 units (within ±5%), shipped 15 March, presented 18 March
All docs: Consistent quantities, descriptions, ports
Special: No conditions

Result: compliant = true, complianceScore = 100%
```

### Scenario 2: Partial Shipment Issue ❌
```
LC: Partial shipment NOT allowed
Invoice: 900 units (90% of LC)

Result: compliant = false, issue = "Partial not permitted"
Resolution: "Complete shipment to 1000 units or request LC amendment"
```

### Scenario 3: Documentary Mismatch ❌
```
Invoice qty: 1000 units
Packing list qty: 950 units (mismatch!)

Result: compliant = false, issue = "Invoice ≠ Packing List"
Resolution: "Correct packing list to match invoice"
```

---

## Deployment Checklist

- [x] Create lcTermLockService.ts (1000+ lines)
- [x] Add Prisma models (LCLock, LCComplianceReport, LCLockAudit)
- [x] Update Exporter model with lcLocks relation
- [x] Run `prisma db push` → update database schema
- [x] Verify TypeScript compilation → no errors
- [x] Export all functions and types
- [ ] Integrate into invoice generation API
- [ ] Add compliance check middleware
- [ ] Test with 5 sample LC scenarios
- [ ] Submit test report to bank
- [ ] Monitor bank acceptance rate

---

## Next Steps (Phase 2-5)

**Phase 2: Payment Gateway / Realization Tracking**
- Track fund flow through AD banks
- FEMA Master Direction § 5: Proceeds realization enforcement
- Auto-generate realization certificates

**Phase 3: Insurance / Risk Management**
- CIF insurance enforcement (buyer required to arrange)
- CFR insurance rules (shipper arranges, buyer reimburses)
- FOB/EXW insurance waiver logic

**Phase 4: Harmonized Tariff / Document Generation**
- HS codes auto-link to SION/Shipping Bill templates
- Auto-populate document fields from item master

**Phase 5: Audit Trail / RBI Reporting**
- End-to-end transaction visibility
- Monthly RBI reporting (transactions, discrepancies, resolutions)
- Auditor export (CSV/PDF with full trace)

---

## References
- **UCP 600**: ICC Publication (Uniform Customs and Practice for Documentary Credits)
- **FEMA**: Foreign Exchange Management Act, 1999 (India)
- **RBI Master Direction**: Liberalized Remittance Scheme & Export Proceeds
- **ICEGATE**: Indian Customs electronic gateway

---

Generated: 2026-02-06  
Status: ✅ PHASE 1: LC COMPLIANCE ENGINE COMPLETE
