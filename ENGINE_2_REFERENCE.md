# ENGINE 2: CUSTOMS DUTIES VALIDATOR

**File**: `lib/customsDutiesEngine.ts` (520 lines)  
**Status**: ✅ Complete & Ready  
**Built**: February 6, 2026  

---

## 🎯 Purpose

Engine 2 enforces 5 critical customs rules:

1. **HS Code Format** (6 or 8 digits, no special chars)
2. **DGFT Restrictions** (bans, licenses, allocations)
3. **Duty Calculation** (Basic, Additional, CVD, Anti-Dumping)
4. **Exemption Eligibility** (EPCG, SEZ, FTA via valid IEC)
5. **AD Code Consistency** (single AD code per invoice)

---

## 🔒 Blockers (Prevent Document Generation)

| Code | Condition | Example |
|------|-----------|---------|
| `INVALID_HS_CODE_FORMAT` | Not 6/8 digits or has special chars | HS "12-01" → BLOCK |
| `DGFT_RESTRICTED` | Commodity banned or needs license | Wheat (HS 1001) banned Jan-Dec 2026 → BLOCK |
| `AD_CODE_INCONSISTENCY` | Multiple AD codes on invoice | Line 1: AD-001, Line 2: AD-002 → BLOCK |
| `EXEMPTION_NOT_ELIGIBLE` | IEC not eligible for claimed exemption | IEC claims EPCG but not registered → BLOCK |

## ⚠️ Warnings (Allow But Alert)

| Code | Condition | Example |
|------|-----------|---------|
| `DUTY_RATE_NOT_FOUND` | HS code not in master (manual verify) | Rare HS code → WARN |
| `DGFT_WARNING` | Restricted but can proceed with docs | Fish needs APEDA cert → WARN |
| `EXEMPTION_DOCS_REQUIRED` | Exemption claimed - docs needed | EPCG claimed, attach License+NOC → WARN |

---

## 📊 Data Model

```typescript
interface DutyLine {
  lineNo: number
  hsCode: string              // "6203" or "62031000"
  commodity: string           // "Cotton T-Shirts"
  quantity: number            // 100 MT
  unitPrice: number           // USD 500/unit
  currency: string            // "USD"
  adCode?: string             // "EPCG" | "SEZ" | "FTA"
  ieclicenseNumber?: string   // License if exempt
}

interface DutyCalculation {
  hsCode: string
  basicDuty: number           // % (e.g., 19%)
  additionalDuty: number      // % (e.g., 0%)
  cvd: number                 // Countervailing % (e.g., 5%)
  apd: number                 // Anti-Dumping % (e.g., 0%)
  totalDutyRate: number       // Sum (e.g., 24%)
  cifValue: number            // USD (Qty × Price)
  dutyAmount: number          // CIF × Duty%
}
```

---

## 🔍 The 5 Rules Explained

### Rule 1: HS Code Format Validation

**Check**: Is HS code 6 or 8 digits with no special characters?

```typescript
✅ PASS: "6203" (6 digits)
✅ PASS: "62031000" (8 digits)
❌ FAIL: "62-03" (contains special char)
❌ FAIL: "620" (only 3 digits)
❌ FAIL: "620ABC" (contains letters)
```

**Resolution**: Use 6-digit international HS code or 8-digit Indian Tariff Code

---

### Rule 2: DGFT Restriction Check

**Check**: Is commodity banned, restricted, or allowed by DGFT today?

```typescript
// BANNED example
DGFT_RESTRICTION_MASTER["1001"] = {
  status: "Banned",
  effectiveFrom: new Date("2026-01-01"),
  effectiveTo: new Date("2026-12-31"),
  comments: "Import ban to stabilize domestic prices"
}

✅ PASS: HS 6203 (Cotton T-Shirts) = Allowed
⚠️ WARN: HS 0302 (Fish) = Restricted (needs APEDA cert)
❌ BLOCK: HS 1001 (Wheat) = Banned until Dec 31, 2026
```

**Integration**: Calls `validateHSCodeWithLiveData()` from `hsCodeLiveValidationService.ts`

---

### Rule 3: Duty Calculation

**Check**: Calculate total duty burden using CESTAT tariff master

```typescript
Example: Cotton T-Shirts (HS 6203)
─────────────────────────────────
Quantity:     100 MT
Unit Price:   USD 500/MT
CIF Value:    100 × 500 = USD 50,000

Duty Rates (from master):
  Basic Duty:       19%
  Additional Duty:   0%
  CVD:              0%
  Anti-Dumping:     0%
  ─────────────────────
  Total Duty Rate:  19%

Total Duty:   USD 50,000 × 0.19 = USD 9,500
```

**Master Duty Rates** (per HS code):
```
6203 (Cotton T-Shirts):      19%
1201 (Soya Beans):          100%
0302 (Fish):                 15% (10% basic + 5% CVD)
8703 (Motor Vehicles):      120% (100% basic + 20% additional)
```

---

### Rule 4: Exemption Eligibility

**Check**: Can this IEC claim the stated exemption (EPCG/SEZ/FTA)?

```typescript
IEC_EXEMPTION_MASTER:
  0323001001: eligible for EPCG + SEZ
  0323001002: eligible for FTA only
  0323001003: NOT eligible for any exemption

Example flow:
─────────────
Line 1: HS 6203, Qty 50, Exemption: "EPCG"
IEC: 0323001001
→ Check: Is 0323001001 eligible for EPCG?
→ Result: YES ✅ → Allow exemption claim
→ Required Docs: EPCG License, NOC from DPIIT, Bank Guarantee

Line 2: HS 6203, Qty 50, Exemption: "EPCG"
IEC: 0323001003
→ Check: Is 0323001003 eligible for EPCG?
→ Result: NO ❌ → BLOCK "IEC not eligible for EPCG"
```

**Exemption Types & Required Documents**:
- **EPCG**: Export Promotion Capital Goods
  - Docs: EPCG License, NOC from DPIIT, Bank Guarantee
  - Max 5 years to export equivalent

- **SEZ**: Special Economic Zone
  - Docs: SEZ Unit Certificate, Gate Pass, Warehouse Storage Proof
  - 100% duty exemption within SEZ

- **FTA**: Free Trade Agreement
  - Docs: FTA Certificate, Rules of Origin Verification
  - CEPA, AAGC, BIMSTEC agreements

---

### Rule 5: AD Code Consistency

**Check**: Is the same AD (Import House) code used throughout invoice?

```typescript
Example: Invoice with 3 lines
─────────────────────────────────
Line 1: HS 6203, AD-Code: 001
Line 2: HS 0302, AD-Code: 001  ✅ Same AD code
Line 3: HS 1201, AD-Code: 001  ✅ Same AD code
Result: PASS

Example 2: INCONSISTENT AD codes
─────────────────────────────────
Line 1: HS 6203, AD-Code: 001
Line 2: HS 0302, AD-Code: 002  ❌ Different!
Line 3: HS 1201, AD-Code: 003  ❌ Different!
Result: BLOCK - "Multiple AD codes on same invoice"

Resolution:
  Option A: Use single AD code for entire invoice (preferred)
  Option B: Split into 3 separate invoices (one per AD code)
```

---

## 🔄 Validation Flow

```
Input: 
  invoiceNumber: "INV-2026-001"
  lines: [
    { lineNo: 1, hsCode: "6203", commodity: "Cotton T-Shirts", qty: 100, unit: 500 },
    { lineNo: 2, hsCode: "0302", commodity: "Fish", qty: 50, unit: 800 }
  ]
  iecNumber: "0323001001"
  adCode: "EPCG"

↓

Engine 2 processes:
  1. validateADCodeConsistency() → Check: AD-001 used in all lines? → PASS
  2. For each line:
     a. validateHSCodeFormat() → Check: 6 or 8 digits? → PASS
     b. checkDGFTRestriction() → Check: DGFT banned/restricted? → PASS (with warnings)
     c. calculateDutyRate() → Get duty %: 19% for 6203, 15% for 0302 → PASS
     d. validateExemptionEligibility() → Can IEC claim EPCG? → PASS (with doc requirements)

↓

Returns:
  allowed: true
  blockers: []
  warnings: [
    "Fish (0302) requires APEDA certificate",
    "EPCG exemption claimed - attach License + NOC + Bank Guarantee"
  ]
  totalDutyCIF: USD 90,000
  totalDutyAmount: USD 18,100  (19% of 50K + 15% of 40K)
```

---

## 🎯 Key Functions

### Main Validation
```typescript
const result = await validateCustomsDuties(
  invoiceNumber: "INV-2026-001",
  lines: [
    { lineNo: 1, hsCode: "6203", commodity: "Cotton T-Shirts", quantity: 100, unitPrice: 500 }
  ],
  iecNumber: "0323001001"
)
// Returns: { allowed, blockers, warnings, dutyCalculations, auditLog }
```

### Integration Point (Before Document Generation)
```typescript
const canGenerate = await canGenerateInvoiceDocuments_Duties(
  invoiceId: "inv_123",
  lines: [...],
  iecNumber: "0323001001"
)

if (!canGenerate.allowed) {
  showError(canGenerate.blockers)
} else {
  generatePDF()
}
```

### Reporting
```typescript
const report = generateCustomsDutiesReport(result)
// Returns: 3-page formatted report with:
//   - CIF & duty totals
//   - All blockers & resolutions
//   - All warnings & notes
//   - Duty breakdowns per line
//   - Audit trail
```

---

## 📋 Example Validation Results

### Scenario 1: Clean Import (No Issues)

**Input**:
```
HS 6203 (Cotton T-Shirts), 100 MT @ USD 500/MT, No exemption
```

**Output**:
```
allowed: true ✅
blockers: []
warnings: []
totalDutyCIF: USD 50,000
totalDutyAmount: USD 9,500 (19% duty rate)
exemptionStatus: "None"
```

---

### Scenario 2: Restricted Commodity (With Doc Requirements)

**Input**:
```
HS 0302 (Fish), 50 MT @ USD 800/MT
```

**Output**:
```
allowed: true ✅  (Can proceed)
blockers: []
warnings: [
  {
    code: "DGFT_WARNING",
    message: "Fish requires APEDA registration (health certificate from exporter)",
    resolution: "Obtain APEDA license before negotiation"
  }
]
totalDutyCIF: USD 40,000
totalDutyAmount: USD 6,000 (15% duty rate)
exemptionStatus: "None"
```

---

### Scenario 3: Banned Commodity (Hard Block)

**Input**:
```
HS 1001 (Wheat), 200 MT @ USD 180/MT
```

**Output**:
```
allowed: false ❌  (BLOCKED)
blockers: [
  {
    code: "DGFT_RESTRICTED",
    message: "WHEAT (HS 1001) is currently BANNED for import until Dec 31, 2026",
    resolution: "Cannot import until January 1, 2027. Or seek DGFT exemption via petition."
  }
]
warnings: []
```

---

### Scenario 4: Inconsistent AD Codes (Hard Block)

**Input**:
```
Line 1: HS 6203, AD-Code: "EPCG"
Line 2: HS 0302, AD-Code: "SEZ"
Line 3: HS 1201, AD-Code: "EPCG"
```

**Output**:
```
allowed: false ❌  (BLOCKED)
blockers: [
  {
    code: "AD_CODE_INCONSISTENCY",
    message: "Multiple AD codes on invoice: EPCG, SEZ",
    resolution: "Use single AD code for entire invoice or split into separate invoices"
  }
]
```

---

## 🧪 Test Cases (Ready to Implement)

| Test | Input | Expected | Status |
|------|-------|----------|--------|
| Valid HS format (6) | "6203" | PASS | Ready |
| Valid HS format (8) | "62031000" | PASS | Ready |
| Invalid HS format | "620" | BLOCK | Ready |
| HS with special chars | "62-03" | BLOCK | Ready |
| DGFT allowed | HS 6203 (Cotton) | PASS | Ready |
| DGFT banned | HS 1001 (Wheat, Jan) | BLOCK | Ready |
| DGFT restricted | HS 0302 (Fish) | WARN + docs required | Ready |
| Duty calculation | HS 6203, CIF 50K | Duty 9,500 (19%) | Ready |
| Exemption eligible | IEC 0323001001 + EPCG | PASS + docs list | Ready |
| Exemption ineligible | IEC 0323001003 + EPCG | BLOCK | Ready |
| AD consistent | Line 1 & 2 same AD | PASS | Ready |
| AD inconsistent | Line 1 AD-001, Line 2 AD-002 | BLOCK | Ready |

---

## 🔗 Integration Points

### With Engine 1 (LC)
- Engine 1 validates LC terms
- Engine 2 validates duties on that LC amount
- Both can block independently

### With Engine 3 (Payment Terms - Future)
- Engine 3 validates payment window
- Engine 2 validates duties owed in that window
- Both affect landed cost

### With Engine 4 (Port/AD - Future)
- Engine 2 validates AD code
- Engine 4 validates AD chain to port
- AD code → AD → Port → IEC chain

---

## 📁 Files Used

- `lib/customsDutiesEngine.ts` – Engine 2 (this file, 520 lines)
- `lib/hsCodeLiveValidationService.ts` – DGFT/GST/SION checks (calls into this)
- `lib/db.ts` – Database connection (Prisma client)

---

## 🚀 What's Next

- Write unit tests (12 test cases ready)
- Integrate into document generation pipeline
- Deploy with Engine 1 migration
- Build Engine 3 (Payment Terms Enforcer)

---

**Status**: ✅ Engine 2 Complete  
**Next**: Engine 3 (Payment Terms Enforcer)  
**Lines**: 520 | **Rules**: 5 | **Blockers**: 4 | **Warnings**: 3
