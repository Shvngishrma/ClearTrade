# Compliance Blocks Audit & Hardening Guide

## CRITICAL GAP ANALYSIS

Your stated bank rejection causes reveal **three integration failures**:

### 1. Invoice Math Not Validated ❌
**Current blocks**: Generic valuation text  
**Missing**: Actual reconciliation to items + detailed breakdown

**Rejection Example**: "Invoice total mismatch (even ₹0.01)"
- Our blocks say: "The billing amount has been computed as per approved commercial invoice format"
- **What banks check**: Does this invoice add up? Does item qty × price = line total? Do all line totals = invoice total?
- **What we do**: Calculate correctly (✅ hardened in calculations.ts) but DON'T declare the computation method
- **Fix needed**: Block must STATE how totals were computed, reference item list, confirm no discrepancies

---

### 2. LC Wording Not UCP 600 Strict ❌
**Current blocks**: Generic UCP 600 reference  
**Missing**: Actual LC terms encoding + discrepancy prevention

**Rejection Example**: "LC wording deviation" + "Description mismatch vs LC"
- Our base block: `"All documents submitted conform strictly to Letter of Credit terms, reference LC Number: {{lcNumber}}"`
- **What banks check**: Does invoice description EXACTLY match LC? Are quantities exact? Do dates align?
- **What's missing**: 
  - Invoice description must be EXACT copy from LC Item Description
  - Qty must match LC quantity exactly
  - Unit of measure must match
  - Price per unit must not exceed LC price per unit
  - Invoice date within LC validity
- **Fix needed**: Compliance block must INCLUDE actual LC terms data (not just reference number)

---

### 3. Exchange Rate Not Snapshot-Linked ❌
**Current blocks**: Generic "RBI guidelines" wording  
**Missing**: Actual rate used + proof of source

**Rejection Example**: "Missing exchange rate reference"
- Our block: `"INR conversion is calculated at the official exchange rate on the date of export as per RBI rates"`
- **What banks check**: What exact rate was used? Which source (FBIL, RBI official, AP rate)? Is it verifiable?
- **What's missing**: Block doesn't state WHICH rate, WHAT source, or provide proof
- **Fix needed**: Must reference exchange rate snapshot (✅ we created this!) and include in compliance block

---

### 4. HS Code Not Validated ❌
**Current blocks**: No HS code compliance at all  
**Missing**: Code validation, tariff line accuracy, restricted goods check

**Rejection Example**: "HS code inconsistency"
- **Current**: Blocks don't even mention HS codes
- **What banks check**: 
  - Is HS code valid per ITC HS classification?
  - Does description match HS code tariff line?
  - Is it within restricted goods list (Schedule 2 FTP)?
  - Are GST rate and HS code aligned?
- **Fix needed**: Add HS code validation block + cross-check with item description

---

### 5. Port & AD Code Not Aligned ❌
**Current blocks**: Generic "port of loading/discharge" text  
**Missing**: Actual port codes, AD Code validation per port

**Rejection Example**: "Port mismatch vs Shipping Bill"
- **Current**: Blocks accept any port name
- **What banks check**:
  - Is port code valid per ICEGATE Port Master?
  - Does Shipping Bill port match Invoice port?
  - Does AD Code align with port and trade type?
- **Fix needed**: Add port code validation + AD code cross-reference

---

### 6. Realization Clause Incomplete ❌
**Current blocks**: Generic "9-month" reference  
**Missing**: Specific RBI Master Direction wording

**Rejection Example**: "Missing realization clause"
- **Current**: `"I undertake to realize the full export proceeds within the time period specified under FEMA regulations"`
- **What RBI requires** (Master Direction 10.07.2016):
  - Proceeds must be realized within 9 months by default
  - Specific to payment terms (LC = different from Advance Payment)
  - Must mention "repatriation within [specific period]"
  - Must reference specific RBI notification
  - Must include undertaking consequences
- **Fix needed**: Add RBI-specific realization language per payment term

---

## COMPLIANCE REFERENCE MATRIX

### RBI FEMA Master Direction Clauses Required

| Reference | Clause | Current Status | Required Text |
|-----------|--------|-----------------|-----------------|
| **FEMA Act 1999, S5** | Export declaration | ✅ Generic | "Goods exported as per FTP Schedule 1—not restricted under Schedule 2" |
| **FEMA Rules 2000, S13** | Proceeds realization | ⚠️ Incomplete | "Export proceeds to be realized within 9 months from date of shipment / extended period as approved by RBI as per A.P. (DIR Series) Circular" |
| **AP Master Direction 10.07.2016** | Advance Payment LC Block timing | ❌ Missing | "Advance payment received through authorized dealer. Goods to be manufactured and exported within [90/180] days of receipt" |
| **Master Direction Fn Block 3** | GST Export undertaking | ⚠️ Generic | "GST exemption availed under [Rule 3/3A] — goods exported as per documentary evidence" |
| **Master Direction Fn Block 5** | Restricted goods check | ❌ Missing | "Goods confirmed NOT under DGFT restricted/prohibited list and not requiring any DGFT license/permission" |

---

### UCP 600 LC Compliance (Articles 2-7)

| Article | Requirement | Current Status | Must Check |
|---------|-------------|-----------------|-------------|
| **Art 2** | Strict compliance | ⚠️ Stated but not verified | Invoice description **EXACT** to LC text (typos = discrepancy) |
| **Art 3** | Credit terms | ❌ Missing encoding | Must capture/validate: LC number, amount, validity, ports, terms |
| **Art 5** | Documents required | ❌ Not in blocks | Invoice, Shipping Bill (date < LC expiry), COO (if required), Packing List |
| **Art 14** | Quantity tolerance | ⚠️ Not checked | If LC allows 5% variance, block must state: "Qty within LC tolerance" |
| **Art 20** | Partial shipments | ❌ Not encoded | If LC prohibits partial shipment, block must prevent multi-invoice |
| **Art 24** | Latest date | ❌ Not checked | Shipping date must be before LC expiry (often 21 days after LC date) |

---

### ICEGATE Shipping Bill Compliance

| Field | Requirement | Current Status | Must Include |
|-------|-------------|-----------------|---------------|
| **SB Date** | Aligned to Invoice | ⚠️ Not checked | Invoice date ≥ Shipping Bill date |
| **Port Code** | Valid ICEGATE port | ❌ Not validated | Must verify against ICEGATE port master (e.g., "INMAA1" not "Mumbai") |
| **AD Code** | Authorized Dealer code | ❌ Missing entirely | Bank AD code must appear in SB + Invoice |
| **HS Code** | Per ITC HS Classification | ❌ Not validated | Must match Customs HS table |
| **Exporter IEC** | Unique ID per exporter | ❌ Not validated | IEC from DGFT registration |
| **Consignee Code/Name** | Match LC buyer | ❌ Not checked | Same legal entity as LC applicant |

---

## REQUIRED COMPLIANCE BLOCK ADDITIONS

### NEW: LC Terms Encoding Block
```typescript
lcTermsEncoded: {
  require: "When paymentTerms === 'LC'",
  block: `This invoice is issued under Letter of Credit {{lcNumber}} dated {{lcDate}}. 
Invoice amount {{invoiceAmount}} {{currency}} does not exceed LC limit. 
Description of goods is exact per LC Item Description: "{{lcItemDescription}}". 
Quantity {{quantity}} {{uom}} is exact per LC. 
Shipping is within LC validity period ending {{lcLatestDate}}. 
All documents will be presented within {{presentationDays}} days of shipment.`
}
```

### NEW: Exchange Rate Snapshot Block
```typescript
exchangeRateSnapshotBlock: {
  require: "When currency !== 'INR'",
  block: `INR conversion applied at rate of ₹{{exchangeRate}}/{{currency}} 
as per {{rateSource}} rate on {{rateDate}}. 
Rate snapshot hash: {{rateHash}} (verifiable against RBI auditable records). 
This rate used consistently across all invoice valuations.`
}
```

### NEW: HS Code Compliance Block
```typescript
hsCodeValidation: {
  require: "For all line items",
  validation: [
    "HS code {{hsCode}} per ITC HS Classification valid",
    "Description matches HS code tariff line",
    "HS code not in restricted goods list (Schedule 2 FTP)",
    "GST rate {{gstRate}}% aligned to HS code",
    "SION/DFIA requirements checked if applicable"
  ],
  block: `All items classified under correct HS codes per ITC HS Classification. 
Item description aligns with HS code line. 
No restricted goods per DGFT Schedule 2. 
GST rate correctly applied per HS code tariff classification.`
}
```

### NEW: Port & AD Code Block
```typescript
portAdCodeBlock: {
  require: "For all exports",
  validation: [
    "Port code {{portCode}} valid per ICEGATE",
    "Port matches Shipping Bill port",
    "AD Code {{adCode}} is authorized dealer code",
    "Port + AD Code combination valid"
  ],
  block: `Export arranged through {{portName}} (ICEGATE code: {{portCode}}). 
All documents routed through authorized dealer {{adName}} (AD Code: {{adCode}}). 
Shipping Bill port alignment confirmed.`
}
```

### ENHANCED: Realization Clause (RBI Master Direction specific)
```typescript
realization: {
  // Varies by payment term
  Advance: `Export goods to be manufactured and exported within {{timeLimit}} days 
of advance payment receipt as per RBI A.P. (DIR Series) Circular 2015. 
Undertake proceeds realization within 9 months from date of shipment 
or extended period as approved by Reserve Bank.`,

  LC: `Undertake to realize export proceeds through LC negotiation 
within {{presentationDays}} days of shipment. 
Full realization of proceeds by {{settlementDate}} 
or within 9 months of shipment date, whichever is earlier, 
as per RBI guidelines on LC-based transactions.`,

  DA: `Documentary Acceptance payment to be realized within {{collectionDays}} days 
of document presentation through authorized dealer bank. 
Full proceeds realization within 9 months or as per RBI norms.`,
}
```

### ENHANCED: FEMA Declaration (Full RBI Master Direction text)
```typescript
femaDeclaration: `I/We hereby declare and solemnly undertake:

1. That the goods described herein are exported in compliance with Foreign Trade Policy 
and Foreign Exchange Management (Overseas Investment) Rules, 2018.

2. That goods are NOT prohibited under Schedule 2 of FTP and conform to Export 
Promotion Capital Goods (EPCG) guidelines if applicable.

3. That export proceeds will be realized and repatriated to India within 
{{realizationPeriod}} from date of shipment in freely convertible foreign currency 
through authorized dealer bank {{adName}}.

4. That this declaration is made in compliance with RBI FEMA Master Direction 
Ref. D&B.G.Sec.03/09.07.01/2015-16 and subsequent amendments.

5. That in case of non-compliance, I/we shall be liable to action 
under FEMA (Contravention) Rules 2000 for violation of:
   a. Foreign Exchange Management Act, 1999
   b. Foreign Trade Policy
   c. RBI Master Directions on export regulations

6. That false declaration or concealment shall constitute criminal offense 
under FEMA with penalties up to ₹{{maxPenalty}} and/or imprisonment.`
```

---

## IMPLEMENTATION PRIORITY

### Phase 1: Critical Path (Prevents Bank Rejections)
- [ ] **Add exchange rate snapshot validation block** (links to calculations.ts hardening ✅)
- [ ] **Add HS code validation block** (prevent "HS code inconsistency")
- [ ] **Add LC terms encoding** (prevent "LC wording deviation" + "Description mismatch")
- [ ] **Add Port + AD code validation** (prevent "Port mismatch vs Shipping Bill")
- [ ] **Enhance realization clause** with RBI-specific wording per payment term

### Phase 2: Secondary Compliance
- [ ] Add DGFT restricted goods check block
- [ ] Add GST LUT/Bond documentation block
- [ ] Add COO format validation block
- [ ] Add Shipping Bill date alignment check

### Phase 3: Audit Trail
- [ ] Store which blocks were used in declaration
- [ ] Store validation results (HS code valid? ✅, Port valid? ✅, etc.)
- [ ] Create audit report showing what was verified

---

## BLOCK VALIDATION CHECKLIST

Before rendering any compliance block, verify:

### LC Payment Blocks
- [ ] LC number exists and is 13-15 chars (standard format)
- [ ] LC date is before invoice date
- [ ] Invoice amount ≤ LC amount
- [ ] Invoice description is EXACT substring of LC Item Description
- [ ] Invoice qty ≤ LC qty (or within tolerance if "5% More" clause)
- [ ] Shipping date is before LC expiry date (usually 21 days after LC date)
- [ ] All LC-required documents are being generated

### Advance Payment Blocks
- [ ] Advance received date documented
- [ ] Export deadline calculated (usually 90/180 days from advance)
- [ ] Goods marked for manufacture/export
- [ ] Proceeds realization deadline set

### HS Code Blocks
- [ ] All 8-digit HS codes valid per ITC table
- [ ] Description matches HS code
- [ ] GST rate matches HS code classification
- [ ] Not in restricted list (DGFT Schedule 2)

### Port & AD Blocks
- [ ] Port code valid per ICEGATE
- [ ] Port matches Shipping Bill
- [ ] AD code format valid (usually 4-digit bank code)
- [ ] AD code is active authorized dealer

### Exchange Rate Blocks
- [ ] Rate date ≤ invoice date (can't use future rate!)
- [ ] Rate within ±5% of RBI official rate (sanity check)
- [ ] Same rate used consistently across all conversions
- [ ] Rate snapshot hash matches stored hash

---

## TESTING CASES

### Test Case 1: LC Discrepancy Prevention
```
Input:
  - LC Description: "Cotton fabric 100% pure"
  - Invoice Description: "Cotton fabric"  ← Missing "100% pure"
Expected: ❌ BLOCK WITH ERROR
Message: "Description mismatch. LC requires: 'Cotton fabric 100% pure'. Invoice has: 'Cotton fabric'"
```

### Test Case 2: Invoice Math Validation
```
Input:
  - Item 1: 100 qty × $10 = $1,000
  - Item 2: 50 qty × $20 = $1,000
  - Invoice Total: $1,999.99  ← Off by $0.01
Expected: ❌ BLOCK WITH ERROR
Message: "Invoice total mismatch. Items sum to $2,000.00 but invoice shows $1,999.99"
```

### Test Case 3: Exchange Rate Drift
```
Input:
  - Rate used: ₹82.50/USD
  - RBI official rate (on date): ₹83.45/USD
  - Variance: 1.14%
Expected: ⚠️ WARNING (still within 5%)
Message: "Rate is 1.14% below RBI official. Verify rate source documentation."
```

### Test Case 4: HS Code GST Mismatch
```
Input:
  - HS Code: 6204.62 (cotton trouser)
  - GST Rate Applied: 18%
  - Correct GST for HS 6204.62: 5%
Expected: ❌ BLOCK WITH ERROR
Message: "GST rate mismatch for HS code 6204.62. Applied: 18%, Correct: 5%"
```

---

## NEXT STEPS

1. **Read RBI FEMA Master Direction** (you have this) and extract exact wording required
2. **Read UCP 600 LC articles** (you have this) and map to specific LC validation rules
3. **Compare current blocks** against extracted requirements
4. **Update complianceBlocks.ts** with RBI Master Direction exact wording
5. **Add validation functions** for HS code, port, AD code, LC terms
6. **Integrate with calculations.ts** (exchange rate snapshot linkage ✅)
7. **Add database fields** to store validation results for audit trail

---

**This is not optional decoration—banks will reject if wording doesn't match RBI gazette language.**
