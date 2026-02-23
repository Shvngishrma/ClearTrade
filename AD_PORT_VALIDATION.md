# AD CODE + PORT VALIDATION SERVICE

**Purpose**: Prevent Shipping Bill rejections by enforcing AD Code + Port consistency rules before customs filing.

**Problem This Solves**:
- ❌ Shipping Bill filed with missing AD Code (rejected at port customs)
- ❌ Port mismatch between invoice and Shipping Bill (port clearance delayed)
- ❌ Exporter using AD Code not authorized for that port (bank receives query)
- ❌ AD Code expired on shipping date (customs authority flags as suspicious)
- ❌ Port not accessible from exporter's location (documentation rejected)

---

## 1. Data Structures

### 1.1 Port Master (ICEGATE Registry)

Each port has compliance rules:

```typescript
PortMaster {
  portCode: "INMAA1"          // ICEGATE code (Marmugao)
  portName: "MARMUGAO"
  portType: "Sea"             // Sea | Air | Land | ICD | CFS
  state: "Goa"
  
  adCodeRequired: true        // ⚠️ MUST include AD Code in Shipping Bill
  adCodeOptional: false       // Optional but recommended
  
  operatingHours: "24x7"
  facilities: ["Bonded Warehouse", "Container Terminal"]
  majorCommodities: ["Iron Ore", "Minerals"]
  icegateActive: true
}
```

**Key Insight**: Some ports (e.g., major sea ports) REQUIRE AD Code in Shipping Bill field. Missing it = automatic rejection.

**Ports in Service** (Master Data):
- **Sea Ports**: MARMUGAO, MANGALORE, COCHIN, JAWAHARLAL NEHRU, KANDLA
- **Air Ports**: Delhi IGI, Mumbai BOM, Bangalore, Chennai
- **ICD**: Container Corporation (Delhi)

### 1.2 Exporter ↔ AD Mapping Table

Banks register each exporter with:

```typescript
ExporterADMapping {
  exporterId: "exp-001"
  exporterName: "TCS Tech Exports Ltd"
  exporterIEC: "0123456789"
  
  adCode: "0001"              // 4-digit bank-assigned AD Code
  adBankName: "CITIBANK NA"
  adCity: "New Delhi"
  
  primaryPort: "INDEF1"       // Delhi IGI (air)
  secondaryPorts: ["INMAA5"]  // Also allowed at JNPT (sea)
  
  adActivationDate: 2023-01-15
  adExpirationDate?: 2025-01-14
  status: "Active" | "Inactive" | "Suspended"
  
  verificationReference: "FEMA/RBI/AUTH/2023-001"
}
```

**Real-World Implication**: 
- TCS can export via Delhi IGI **OR** Mumbai JNPT (INMAA5) using AD 0001
- TCS **cannot** export via Port Cochin using AD 0001 (not in list)
- If AD code expires = all shipments blocked until bank renews

---

## 2. Validation Layers

### Layer 1: AD Code Status Check

```typescript
validateADCodeStatus(adCode: "0001", checkDate: now): ADCodeValidation
```

**Checks**:
✅ Format: Exactly 4 digits (0001-9999)
✅ Exists: Found in EXPORTER_AD_MAPPINGS
✅ Status: Must be "Active" (not Inactive/Suspended)
✅ Activation: Not before adActivationDate
✅ Expiration: Not after adExpirationDate

**Returns**:
```typescript
{
  adCode: "0001",
  isValid: true,
  bankName: "CITIBANK NA",
  bankCity: "New Delhi",
  activeState: "Active",
  expiryDate: 2025-01-14,
  issues: []
}
```

### Layer 2: Port Availability

```typescript
validatePortAvailability(portCode: "INMAA5"): PortValidation
```

**Checks**:
✅ Port code exists in PORT_MASTER
✅ Port is ICEGATE-active
✅ Reads: adCodeRequired flag for this port

**Returns**:
```typescript
{
  portCode: "INMAA5",
  isValid: true,
  portName: "JAWAHARLAL NEHRU",
  portType: "Sea",
  adCodeRequired: true,  // ← Shipper MUST provide AD Code
  issues: []
}
```

### Layer 3: Exporter-Port-AD Fit

```typescript
validateExporterPortADFit(
  exporterId: "exp-001",
  portCode: "INMAA5",
  adCode: "0001"
): ExporterPortADFit
```

**Checks**:
✅ Does exporter have ANY active AD mappings?
✅ Is port in exporter's primaryPort or secondaryPorts?
✅ If AD provided: Does it match for this exporter + port combination?

**Scenarios**:

| Scenario | Result | Action |
|----------|--------|--------|
| Exporter authorized for INMAA5 with AD 0001 | ✅ Fit | Proceed |
| Exporter has no AD codes | ❌ No Fit | Error: "Update bank mapping" |
| Exporter at Delhi IGI, tries Mumbai | ❌ No Fit | Suggest alternate ports |
| AD 0010 not in exporter's list | ❌ No Fit | Suggest correct ADs |

**Returns**:
```typescript
{
  exporterId: "exp-001",
  portCode: "INMAA5",
  adCode: "0001",
  isFit: true,
  suggestedADCodes: ["0001", "0005"],  // Other valid options
  issues: []
}
```

### Layer 4: Port Consistency

```typescript
validatePortConsistency(
  invoicePortCode: "INMAA5",
  shippingBillPortCode: "INMAA5"
): PortConsistencyCheck
```

**Checks**:
✅ Both invoice and Shipping Bill declare same port
✅ Port code is not empty

**Rejection Scenario**:
```
Invoice says: Port = INMAA5 (Mumbai JNPT)
Shipping Bill says: Port = INMAA2 (Mangalore)
Result: ❌ REJECTED "Port mismatch"
```

**Why This Matters**: Customs validates that physical shipment is from declared port. Mismatch triggers investigation.

### Layer 5: Master Validation (All Layers)

```typescript
validateCompleteADPort({
  exporterId: "exp-001",
  invoicePortCode: "INMAA5",
  shippingBillPortCode: "INMAA5",
  adCode: "0001",
  shippingDate: now
}): CompleteADPortValidation
```

**Runs All 4 Layers**:
1. validateADCodeStatus() ✓
2. validatePortAvailability() ✓
3. validateExporterPortADFit() ✓
4. validatePortConsistency() ✓

**Returns**:
```typescript
{
  exporterId: "exp-001",
  invoicePortCode: "INMAA5",
  shippingBillPortCode: "INMAA5",
  adCode: "0001",

  // Layer results
  adCodeExists: true,
  adCodeActive: true,
  portExists: true,
  portADRequired: true,
  exporterPortADFit: true,
  portConsistency: true,

  // Gate
  canProceed: true,  // ← Can file Shipping Bill?

  issues: [],
  
  recommendedADCode: "0001",
  alternativeADCodes: ["0005"],
  
  validatedAt: 2026-02-06T...
}
```

---

## 3. Shipping Bill Filing Readiness

## Helper Function: Check If Ready to File

```typescript
checkShippingBillReadiness(
  invoiceId: "INV-001",
  exporterId: "exp-001",
  invoicePortCode: "INMAA5",
  shippingBillPortCode: "INMAA5",
  adCode: "0001"
): ShippingBillReadiness
```

**Returns**:
```typescript
{
  invoiceId: "INV-001",
  canFileShippingBill: true,
  status: "Ready",         // or "Blocked" or "Warning"
  blockers: [],
  warnings: [],
}
```

**Status Codes**:
- `"Ready"`: File Shipping Bill immediately
- `"Blocked"`: Fix critical issues before filing
- `"Warning"`: File but document the warning

---

## 4. Real-World Scenarios

### Scenario 1: Exporter New to Sea Port

**Situation**:
- TCS Tech Exports (exp-001) has export experience via Delhi IGI (air)
- Now wants to ship leather goods via Mumbai JNPT
- Uses existing AD Code "0001"

**Invoice Values**:
```
exporterId: "exp-001"
invoicePort: "INMAA5"  (Mumbai JNPT)
adCode: "0001"
```

**Validation Result**:
```
Layer 1 (AD Code): ✅ Valid, active until 2025-01-14
Layer 2 (Port): ✅ Exists, adCodeRequired = true
Layer 3 (Fit): 
  - Exporter exp-001 has AD 0001
  - primaryPort = INDEF1 (Delhi IGI) ✗
  - secondaryPorts = ["INMAA5"] ✓
  - Result: ✅ FIT
Layer 4 (Consistency): ✅ Same port in invoice + SB

GATE: ✅ canProceed = true
ACTION: File Shipping Bill
```

### Scenario 2: AD Code Expired

**Situation**:
- Spice World Exports (exp-004) wants to ship via Cochin
- Bank mapping shows AD "0015" expired on 2025-12-31 (TODAY = 2026-02-06)

**Invoice Values**:
```
exporterId: "exp-004"
invoicePort: "INMAA3"  (Cochin)
adCode: "0015"
shippingDate: 2026-02-06
```

**Validation Result**:
```
Layer 1 (AD Code):
  - checkDate (2026-02-06) > expirationDate (2025-12-31)
  - Result: ❌ EXPIRED
  - Issue: "AD Code expired on 2025-12-31"
  - Resolution: "Contact bank to renew"

GATE: ❌ canProceed = false
BLOCKER: "AD Code 0015 expired"
ACTION: Contact bank for renewal
```

### Scenario 3: Port Mismatch

**Situation**:
- Invoice prepared for export via Delhi IGI (air cargo)
- During Shipping Bill filing, customs staff realizes shipment is from Mumbai
- Shipper updates SB port to Mumbai but forgets to update invoice

**Invoice Values**:
```
invoicePort: "INDEF1"  (Delhi IGI)
shippingBillPort: "INMAA5"  (Mumbai JNPT)
```

**Validation Result**:
```
Layer 4 (Consistency):
  - invoicePort ≠ shippingBillPort
  - Result: ❌ INCONSISTENT
  - Issue: "Port mismatch: Invoice=INDEF1, SB=INMAA5"

GATE: ❌ canProceed = false
BLOCKER: "Port must match between invoice and Shipping Bill"
ACTION: Update invoice port to INMAA5
```

### Scenario 4: AD Not Authorized for Port

**Situation**:
- Cotton Textiles (exp-002) has AD "0010"
- Mapping shows: primaryPort = INDEF3 (Bangalore air), secondaryPorts = ["INMAA2"] (Mangalore sea)
- Tries to export via INMAA3 (Cochin)

**Invoice Values**:
```
exporterId: "exp-002"
invoicePort: "INMAA3"  (Cochin)
adCode: "0010"
```

**Validation Result**:
```
Layer 3 (Fit):
  - Exporter exp-002 has AD 0010
  - primaryPort = INDEF3 (Bangalore)
  - secondaryPorts = ["INMAA2"] (Mangalore)
  - Requested port INMAA3 NOT in list
  - Result: ❌ NOT FIT
  - Issues: "Exporter not authorized for INMAA3"
  - Suggestion: "Use INMAA2 (Mangalore) or INDEF3 (Bangalore)"

GATE: ❌ canProceed = false
ACTION: Either:
  1. Switch to authorized port (INMAA2 or INDEF3), OR
  2. Contact bank to add INMAA3 to secondary ports
```

---

## 5. Integration with Invoice Generation API

### Hook Point: After Invoice Created, Before Shipping Bill Filed

```typescript
// app/api/documents/generate-shipping-bill/route.ts

import { validateCompleteADPort, checkShippingBillReadiness } from "@/lib/adPortValidationService"

export async function POST(req: Request) {
  const { invoiceId, exporterId, invoicePort, shippingBillPort, adCode } = await req.json()

  // Validate before generating Shipping Bill
  const readiness = checkShippingBillReadiness(
    invoiceId,
    exporterId,
    invoicePort,
    shippingBillPort,
    adCode
  )

  if (!readiness.canFileShippingBill) {
    return Response.json(
      {
        error: "Cannot generate Shipping Bill",
        status: readiness.status,
        blockers: readiness.blockers,
        warnings: readiness.warnings,
      },
      { status: 400 }
    )
  }

  // Safe to proceed with Shipping Bill generation
  return Response.json({ success: true, shippingBillId: "SB-001" })
}
```

### Hook Point 2: Invoice Submission Validation

```typescript
// In invoice submission endpoint

const validation = validateCompleteADPort({
  exporterId,
  invoicePortCode,
  shippingBillPortCode,
  adCode,
  shippingDate: invoiceDate
})

if (!validation.canProceed) {
  return {
    error: "Invoice cannot proceed to Shipping Bill filing",
    issues: validation.issues,
    recommendation: validation.recommendedADCode
  }
}
```

### UI Helper: Port + AD Selector

```typescript
// Get available options for dropdown

// Get all ports where this exporter can export
const ports = getExporterAvailablePorts(exporterId)
// Returns: [
//   { portCode: "INDEF1", portName: "Delhi IGI", portType: "Air" },
//   { portCode: "INMAA5", portName: "JNPT Mumbai", portType: "Sea" }
// ]

// Get all AD codes for a specific port
const ads = getExporterADOptions(exporterId, "INMAA5")
// Returns: [
//   { adCode: "0001", adBankName: "CITIBANK NA" },
//   { adCode: "0005", adBankName: "HSBC BANK" }
// ]
```

---

## 6. Compliance Checklist for Shipping Bill Filing

Before filing Shipping Bill, verify:

- ✅ **AD Code Provided**: If port.adCodeRequired = true
- ✅ **AD Code Valid**: Status = "Active" and not expired
- ✅ **AD Code Authorized**: In exporter's mapping list
- ✅ **Port Exists**: In ICEGATE master (PORT_MASTER)
- ✅ **Exporter Fit**: Exporter authorized for chosen port
- ✅ **Port Consistency**: Invoice port = Shipping Bill port
- ✅ **Date Check**: Shipping date ≥ AD activation date

---

## 7. Error Messages (Bank Rejection Prevention)

### Common Shipping Bill Rejection Reasons (Now Prevented):

| Rejection Message | Root Cause | Fixed By This Service |
|---|---|---|
| "AD Code missing for this port" | adCodeRequired=true but not provided | Layer 2 + Layer 5 check |
| "AD Code 0001 not found" | Invalid AD code format/number | Layer 1 check |
| "AD Code expired" | adExpirationDate < shippingDate | Layer 1 check |
| "Port mismatch in SB" | Invoice port ≠ SB port | Layer 4 check |
| "Exporter not authorized for this port" | Port not in exporter's mapping | Layer 3 check |
| "Port not in ICEGATE" | Invalid port code | Layer 2 check |

---

## 8. Test Scenarios

### Test 1: Happy Path (Sea Port with Required AD)
```
Input: TCS exports via INMAA5 with AD 0001
Expected: canProceed = true
Assertion: No blockers
```

### Test 2: AD Code Expired
```
Input: Ship with expired AD 0002
Expected: canProceed = false
Assertion: Blocker contains "expired"
```

### Test 3: Port Mismatch
```
Input: invoicePort = INDEF1, shippingBillPort = INMAA5
Expected: canProceed = false
Assertion: Blocker contains "mismatch"
```

### Test 4: Unauthorized Port for Exporter
```
Input: Exporter exp-002 tries port INMAA3 (not in mapping)
Expected: canProceed = false, suggestedADCodes provided
Assertion: Alternative ports suggested
```

### Test 5: Air Port Validation
```
Input: TCS exports software via Delhi IGI (INDEF1)
Expected: canProceed = true, AD required
Assertion: Port recognized as air, AD mandatory
```

---

## 9. Master Data Reference

### Ports Requiring AD Code (adCodeRequired = true)
- All 9 ports in SERVICE require AD Code

### Ports with Optional AD Code (adCodeOptional = true)
- Currently none (all are mandatory)

### Port-AD Mapping Example
```
TCS Tech Exports:
  AD 0001:
    - Primary: INDEF1 (Delhi IGI)
    - Secondary: [INMAA5 (Mumbai JNPT)]
  
  AD 0005:
    - Primary: INMAA5 (Mumbai JNPT)
    - Secondary: [INMAA2 (Mangalore), INMAA3 (Cochin)]
```

---

## 10. Deployment Checklist

- [ ] Copy `adPortValidationService.ts` to `/lib/`
- [ ] Import service functions in invoice generation API
- [ ] Add validation call before Shipping Bill filing
- [ ] Update API response to include blockers/warnings
- [ ] Create UI dropdowns using getExporterADOptions() + getExporterAvailablePorts()
- [ ] Add validation to invoice submission form
- [ ] Document API error codes in frontend
- [ ] Test with all 4 error scenarios
- [ ] Enable for production

---

## 11. Future Enhancements

1. **Dynamic Port Master**: Replace hardcoded PORT_MASTER with database reads (ICEGATE import)
2. **Dynamic AD Mappings**: Fetch EXPORTER_AD_MAPPINGS from Prisma (integrate with bank data)
3. **Real-time AD Validation**: Call bank API to confirm AD code status
4. **Port Capacity Alerts**: Warn if port is congested (delay expected)
5. **SION Integration**: Automatically flag SION requirements per port
6. **Historical Audit**: Track all port + AD choices per invoice for compliance
