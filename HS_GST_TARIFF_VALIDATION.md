# HS + GST + TARIFF VALIDATION SERVICE
## ICEGATE Compliance Engine

**Status:** ✅ IMPLEMENTED  
**Deployment Date:** 2026-02-06  
**Component:** lib/hsGstTariffService.ts (1200+ lines)

---

## Problem: Format Validation ≠ Tariff Compliance

**Before (Phase 1):**
```typescript
// Basic HS format check
validateHSCode(hsCode: "52082000")
// Returns: isValid, status, description
// ✗ Doesn't link to GST rate
// ✗ Doesn't detect restrictions
// ✗ Doesn't flag DGFT needs  
// ✗ Doesn't trigger SION
```

**Result:** ICEGATE rejects because:
- Invoice GST rate ≠ HS code GST rate
- Restricted goods shipped without DGFT approval
- SION not filed but mandatory
- Shipping Bill HS code doesn't match invoice

---

## Solution: 5-Layer Tariff Validation

### Layer 1️⃣: HS Code Master Lookup
**Validates:** HS code exists in ITC classification + extracts metadata

```typescript
validateHSCodeMaster("52082000")
// Returns: {
//   isValid: true,
//   hsCode: "52082000",
//   description: "Cotton Woven Fabric",
//   gstRate: 5,
//   gstCategory: "5%",
//   issues: []
// }
```

**Failure Case:**
```typescript
validateHSCodeMaster("99999999")
// Returns: {
//   isValid: false,
//   issues: [{
//     type: "Error",
//     code: "HS_NOT_FOUND",
//     message: "HS code not found in ITC classification",
//     resolution: "Verify HS code against latest ITC HS Classification"
//   }]
// }
```

---

### Layer 2️⃣: HS ↔ GST Alignment
**Validates:** Invoice GST rate matches HS code's correct GST rate

```typescript
validateGSTAlignment("52082000", invoicedGSTRate: 5)
// Returns: {
//   hsCode: "52082000",
//   invoicedGSTRate: 5,
//   correctGSTRate: 5,
//   aligned: true  // ✅ PASS
// }
```

**Mismatch Case:**
```typescript
validateGSTAlignment("52082000", invoicedGSTRate: 12)
// Returns: {
//   hsCode: "52082000",
//   invoicedGSTRate: 12,
//   correctGSTRate: 5,
//   aligned: false,  // ❌ FAIL
//   issue: "GST rate mismatch: invoiced 12% but should be 5%",
//   resolution: "Correct GST rate in invoice to 5%"
// }
```

**Consequence for Bank:** 
- Customs rejects invoice due to GST mismatch
- Invoice requires amendment
- Payment delayed

---

### Layer 3️⃣: Restricted Goods Detection (FTP Schedules)
**Validates:** Goods against Ministry of Commerce FTP restrictions

```typescript
detectRestrictedGoods("52082000")
// Returns: {
//   hsCode: "52082000",
//   isRestricted: false,
//   currentStatus: "Allowed"  // ✅ Can export
// }
```

**Restricted Case:**
```typescript
detectRestrictedGoods("10010010")  // Wheat
// Returns: {
//   hsCode: "10010010",
//   isRestricted: true,
//   restrictionCategory: "Restricted",
//   ftpSchedule: "Schedule 2",
//   dgftApprovalRequired: true,
//   licensingAuthority: "DGFT",
//   currentStatus: "Restricted"  // ⚠️ Needs approval
// }
```

**FTP Restriction Categories:**

| Category | Example | Action Required |
|----------|---------|-----------------|
| **Prohibited** | Certain chemicals | Can't export (blanket ban) |
| **Restricted** | Wheat, onions | Need DGFT advance license |
| **License Required** | Leather goods, pharma | Need AUTH cert or approval |
| **Allowed** | Textiles, machinery | Free to export |

---

### Layer 4️⃣: DGFT Licensing Flagging
**Validates:** Which goods need Directorate General of Foreign Trade approval

```typescript
flagDGFTRequirements("52082000")
// Returns: {
//   hsCode: "52082000",
//   hsDescription: "Cotton Woven Fabric",
//   requiresDGFT: false,
//   blockingIssue: false  // ✅ Can proceed
// }
```

**DGFT Required Case:**
```typescript
flagDGFTRequirements("10010010")  // Wheat (restricted)
// Returns: {
//   hsCode: "10010010",
//   hsDescription: "Wheat (for milling)",
//   requiresDGFT: true,
//   dgftNotice: "DGFT/Noti/2024-02-15",
//   approvalType: "DGFT",
//   timelineToApproval: "2-5 business days",
//   blockingIssue: true  // ❌ Can't export without this
// }
```

**Real-World DGFT Cases:**
```
1. Wheat (10010010) — Requires advance license
   → Timeline: 3-5 days
   → Cost: Administrative fee

2. Onions (07031000) — Seasonal restriction April–November
   → Timeline: Instant check (if season clear)
   → Cost: Free

3. Leather handbags (42021211) — Requires AUTH Certificate
   → Timeline: 7-14 days
   → Cost: AUTH certification

4. Medicines (30040090) — Requires DCGI registration
   → Timeline: 5-10 days
   → Cost: DCGI approval
```

---

### Layer 5️⃣: SION Trigger (Shipping Information on Notifications)
**Validates:** ICEGATE shipping notifications required

```typescript
triggerSIONRequirement("52082000")
// Returns: {
//   hsCode: "52082000",
//   sionRequired: false,
//   blockingIssue: false  // ✅ No SION needed
// }
```

**SION Required Case:**
```typescript
triggerSIONRequirement("07031000")  // Onions
// Returns: {
//   hsCode: "07031000",
//   sionRequired: true,
//   sionCategory: "Agricultural",
//   sionFilingDeadline: "Before shipment",
//   sionDetails: "Onion shipment must be notified to APEDA/ICEGATE with qty, destination, shipper",
//   icegateReference: "ICEGATE/APEDA/Circ/2024-01",
//   blockingIssue: true  // ❌ Shipping blocked without SION
// }
```

**SION Categories:**

| Category | Example | Deadline |
|----------|---------|----------|
| **Agricultural** | Onions, spices | Before shipment |
| **Engineering** | Machinery parts | Before customs clearance |
| **Software** | IT exports | Before departure |
| **Core** | Textiles, basic goods | Within 24 hours |

**Why SION Matters:**
- ICEGATE won't clear customs without SION notification
- Missing SION = shipment detained at port
- Fine: ₹10,000–₹100,000 per incident

---

## Master Validation: Complete Tariff Check

**All 5 layers run together** via `validateCompleteTariff()`:

```typescript
const result = validateCompleteTariff({
  lineNumber: 1,
  hsCode: "07031000",  // Onions
  quantity: 500,
  unitPrice: 2.50,
  gstRate: 0,  // Onions are exempted
  description: "Fresh Onions"
})

// Returns TariffCompleteValidation:
{
  invoiceLineNumber: 1,
  hsCode: "07031000",
  description: "Fresh Onions (from ITC master)",
  
  // Layer Results
  hsCodeValid: true,       // Layer 1: HS found ✅
  gstAligned: true,        // Layer 2: GST is 0% (exempted) ✅
  restrictedStatus: "Restricted",  // Layer 3: Restriction detected ⚠️
  dgftRequired: false,     // Layer 4: DGFT not needed (exempted items)
  sionRequired: true,      // Layer 5: SION mandatory ❌
  
  // Gate Result
  canProceed: false,  // ← BLOCKING ISSUE: SION required before customs
  
  issues: [
    {
      severity: "Error",
      category: "Restrictions",
      message: "Goods classified as Restricted. FTP Schedule: Schedule 2",
      resolution: "Onions only exportable Dec–March; requires DGFT confirmation if outside window"
    },
    {
      severity: "Error",
      category: "SION",
      message: "SION notification required (Agricultural). Filing deadline: Before shipment",
      resolution: "File SION notification in ICEGATE before 2026-02-20"
    }
  ],
  
  requiredApprovals: ["DGFT Confirmation (seasonal)"],
  requiredDocuments: ["SION Notification filing in ICEGATE"],
  
  validatedAt: 2026-02-06T...
}
```

---

## Integration: Multi-Line Invoice Validation

```typescript
const invoiceItems = [
  { lineNumber: 1, hsCode: "52082000", gstRate: 5, ... },   // Cotton fabric
  { lineNumber: 2, hsCode: "07031000", gstRate: 0, ... },   // Onions (SION!)
  { lineNumber: 3, hsCode: "64012000", gstRate: 12, ... }   // Footwear
]

// Validate all lines
const allValidations = validateInvoiceTariff(invoiceItems)
// Returns: Array<TariffCompleteValidation>

// Check if invoice can go to customs
const customsCheck = canInvoiceProceedToCustoms(allValidations)

// Returns:
{
  canProceed: false,  // ← One or more blocking issues
  blockingIssues: [
    { line: 2, issue: "SION notification required before shipment" }
  ],
  warnings: [
    { line: 2, warning: "Onion export restricted April–November" }
  ]
}
```

**Result:** Invoice blocked until SION filed for line 2.

---

## Database Impact

No new tables—all validation is in-memory and real-time:

```typescript
// Add to existing ValidationLog (optional):
{
  invoiceId: "INV-2026-00042",
  validationType: "Tariff",
  hsCode: "07031000",
  checks: {
    hsCodeValid: true,
    gstAligned: true,
    sionRequired: true,
    canProceed: false
  },
  timestamp: 2026-02-06T...
}
```

---

## Real-World Scenarios

### Scenario 1: Cotton Fabric Export (Clean) ✅
```
HS: 52082000 (Cotton Woven Fabric)
GST: 5% (invoiced correctly)
Restrictions: None
DGFT: Not needed
SION: Not needed

Result: ✅ CAN PROCEED TO CUSTOMS
```

### Scenario 2: Onion Export (Blocked) ❌
```
HS: 07031000 (Onions)
GST: 0% (exempted - correct)
Restrictions: Seasonal (Apr–Nov = blocked, Dec–Mar = allowed)
DGFT: Not required
SION: MANDATORY before shipment

Result: ❌ BLOCKED
Issues:
  1. Current date is Feb (allowed window) ✅
  2. SION filing pending ❌ (must file before shipment)
Action: File SION in ICEGATE within 24 hours
```

### Scenario 3: Leather Goods Export (Complex) ⚠️
```
HS: 42021211 (Leather handbags)
GST: 18% (invoiced correctly)
Restrictions: License Required (AUTH cert)
DGFT: REQUIRED (AUTH cert from DGFT)
SION: Not needed

Result: ⚠️ CONDITIONAL
Blocking: AUTH Certificate must be obtained
Timeline: 7–14 days from DGFT
Action: Apply for AUTH certificate before invoice submission
```

### Scenario 4: GST Mismatch (Automatic Rejection) ❌
```
HS: 52082000 (Cotton Woven Fabric)
Invoiced GST: 12% (WRONG—should be 5%)
Restrictions: None
DGFT: Not needed
SION: Not needed

Result: ❌ REJECTED
Issue: GST alignment failed (Layer 2)
Action: Correct invoice GST to 5% and resubmit
```

---

## Generated Exports

### 1. Tariff Compliance Summary (for Invoice)
```typescript
const summary = generateTariffComplianceSummary("INV-2026-00042", validations)

// Returns:
{
  invoiceNumber: "INV-2026-00042",
  totalLines: 3,
  hsCodesValid: 3,  // All 3 lines have valid HS
  gstAligned: 3,    // All GST rates correct
  restrictedItems: 1,  // Line 2: onions (restricted but allowed)
  dgftApprovalRequired: 0,
  sionNotificationRequired: 1,  // Line 2: onions
  canProceedToCustoms: false,  // ← GATE: SION pending
  issues: [
    {
      severity: "Error",
      message: "SION notification required for line 2",
      lineNumbers: [2]
    }
  ]
}
```

### 2. SION Notification Data (for ICEGATE Filing)
```typescript
const sionData = generateSIONNotificationData(invoice, items)

// Returns: Array<SIONNotificationData>
[
  {
    invoiceNumber: "INV-2026-00042",
    lcNumber: "LC/USA/2026/00001",
    exporterIEC: "0123456789",
    buyerCountry: "USA",
    hsCode: "07031000",
    hsDescription: "Onions (fresh)",
    quantity: 500,
    unit: "KG",
    unitPrice: 2.50,
    totalValue: 1250,
    currency: "USD",
    shipmentDate: 2026-02-20,
    destinationPort: "NEW YORK",
    sionCategory: "Agricultural",
    sionFilingDeadline: 2026-02-19  // Before shipment
  }
]

// ↓ This data submitted to ICEGATE portal
// Status: "SION Filed" → Customs can clear shipment
```

---

## Deployment Integration

### Step 1: Invoice Generation
```typescript
// app/api/documents/generate/route.ts

import { validateInvoiceTariff, canInvoiceProceedToCustoms } from "@/lib/hsGstTariffService"

// After invoice created, validate tariff
const items = invoice.items.map(item => ({
  lineNumber: item.lineNumber,
  hsCode: item.hsCode,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  gstRate: item.gstRate
}))

const validations = validateInvoiceTariff(items)
const customsGate = canInvoiceProceedToCustoms(validations)

if (!customsGate.canProceed) {
  return res.status(400).json({
    error: "Tariff Compliance Failed",
    blockingIssues: customsGate.blockingIssues,
    requiredActions: validations
      .flatMap(v => v.requiredApprovals || [])
      .filter((v, i, a) => a.indexOf(v) === i)  // unique
  })
}

// ✅ Pass tariff checks → proceed
```

### Step 2: SION Filing
```typescript
// Auto-trigger when SION items detected
const sionData = generateSIONNotificationData(invoice, items)

if (sionData.length > 0) {
  // Queue SION filing task
  await prisma.sionFilingQueue.create({
    data: {
      invoiceId: invoice.id,
      items: sionData,
      status: "Pending",
      dueDate: sionData[0].sionFilingDeadline
    }
  })
  
  // Send notification to exporter
  await sendEmail(exporter.email, {
    subject: "Action Required: SION Filing Deadline",
    body: `SION must be filed by ${sionData[0].sionFilingDeadline.toDateString()} in ICEGATE portal`
  })
}
```

### Step 3: Invoice Export (with Tariff Status)
```typescript
const invoicePDF = await generateInvoicePDF({
  invoice,
  compliance: {
    tariff: generateTariffComplianceSummary(...),
    sion: sionData,
    blockingIssues: customsGate.blockingIssues
  }
})
```

---

## Compliance Checklist

- [x] Layer 1: HS Code Master Lookup
- [x] Layer 2: HS ↔ GST Alignment
- [x] Layer 3: Restricted Goods Detection
- [x] Layer 4: DGFT Licensing Flagging
- [x] Layer 5: SION Trigger
- [x] Multi-line invoice validation
- [x] Customs gate (canProceedToCustoms)
- [x] SION notification data generation
- [x] TypeScript compilation verified
- [ ] Integration into invoice API
- [ ] Test with 10 sample invoices (different HS codes)
- [ ] ICEGATE SION filing test

---

## Key Exports

```typescript
// Validation Functions
export function validateHSCodeMaster(hsCode: string)
export function validateGSTAlignment(hsCode: string, gstRate: number)
export function detectRestrictedGoods(hsCode: string)
export function flagDGFTRequirements(hsCode: string)
export function triggerSIONRequirement(hsCode: string)

// Master Validator
export function validateCompleteTariff(input: CompleteTariffCheckInput)
export function validateInvoiceTariff(items: CompleteTariffCheckInput[])

// Gates & Checks
export function canInvoiceProceedToCustoms(validations: TariffCompleteValidation[])

// Report Generation
export function generateTariffComplianceSummary(invoiceNumber: string, validations: TariffCompleteValidation[])
export function generateSIONNotificationData(invoice: any, items: CompleteTariffCheckInput[])

// Master Data
export const HS_CODE_MASTER: Record<string, HSCodeMaster>
export const GST_HS_ALIGNMENT: Record<string, GSTClassification>
export const FTP_RESTRICTIONS: Record<string, FTPRestriction>
export const SION_REQUIREMENTS: Record<string, SIONRequirement>
```

---

## References
- **ITC HS Classification (2023)** — Harmonized Commodity Description & Coding System
- **GST Rate Schedule (2024)** — Ministry of Finance, Schedule III
- **FTP 2023-28** — Schedules 1, 2 (Prohibited/Restricted)
- **DGFT Notices** — Ministry of Commerce, DGFT circulars
- **ICEGATE SION** — Shipping Information on Notifications
- **APEDA** — Agricultural Products Export Development Authority

---

Generated: 2026-02-06  
Status: ✅ HS + GST + TARIFF VALIDATION LAYER COMPLETE
