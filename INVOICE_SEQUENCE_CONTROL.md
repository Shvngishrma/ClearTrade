# Invoice Number Sequencing Control - Audit-Proof Implementation

## The Problem: Uniqueness ≠ Sequential Integrity

**Current State (VULNERABLE):**
```
Exporter creates invoices:
  #001 (Jan 5) ✅
  #005 (Jan 10) ← Gap! Where are #002, #003, #004?
  #004 (Feb 1) ← Out of sequence!
  #002 (Feb 10) ← Reusing old number

Auditor sees: "Invoice sequence broken. Red flag for manipulation."
Bank queries: "Why are numbers missing/out of order?"
RBI compliance: FAIL - Export law requires consecutive invoicing
```

**What banks actually verify:**
1. ✅ Unique (no duplicates) — YOU HAVE THIS
2. ❌ **Sequential** (001, 002, 003... no gaps) — YOU DON'T HAVE THIS
3. ❌ **Monotonic dates** (can't backdate) — YOU DON'T HAVE THIS
4. ❌ **Cancelled tracking** (reused numbers forbidden) — YOU DON'T HAVE THIS
5. ❌ **Audit trail** (what happened to each number) — YOU DON'T HAVE THIS

---

## RBI/CUSTOMS Sequencing Requirements

### RBI FEMA Master Direction
> "Invoices must be issued serially, without gaps or breaks, to constitute valid export documentation."

### DGFT Foreign Trade Policy
> "Invoice numbering must be consecutive, as per company's invoicing policy, auditable by customs."

### ICEGATE Shipping Bill Rules
> "Shipping Bill must reference valid, consecutive invoice number. Gaps indicate potential fraud."

### Auditor Standard (ISA 500)
> "Examine invoice sequences to identify unauthorized/missing documents."

---

## Sequential Enforcement Architecture

### Schema Additions Required

#### 1. InvoiceSequence Table (Per-Exporter Tracking)
```prisma
model InvoiceSequence {
  id              String   @id @default(cuid())
  exporterId      String   @unique
  
  // Next number to assign
  nextNumber      Int      @default(1)
  lastIssuedNumber Int     @default(0)
  
  // Most recent issuance
  lastIssuedDate  DateTime?
  lastIssuedId    String?  // Reference to Invoice.id for audit
  
  // Sequencing rules
  prefix          String?  // Optional: "INV-" or "EXP-"
  suffix          String?  // Optional: "/2026"
  padLength       Int      @default(6) // 000001, 000002, etc.
  
  // Audit trail
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  exporter        Exporter @relation(fields: [exporterId], references: [id], onDelete: Cascade)
}

// Link to exporter
model Exporter {
  // ... existing fields ...
  invoiceSequence InvoiceSequence?
}
```

#### 2. CancelledInvoiceNumber Table (Never-Reuse Registry)
```prisma
model CancelledInvoiceNumber {
  id                String   @id @default(cuid())
  exporterId        String
  invoiceNumber     String
  sequenceNumber    Int      // The numeric part (e.g., 50 from "INV-000050")
  
  // Why was it cancelled?
  reason            String   // "USER_DELETED" | "DUPLICATE" | "FRAUD_PREVENTED" | "CORRECTION"
  linkedInvoiceId   String?  // If it was a replacement, link to new invoice
  
  // Audit trail
  cancelledBy       String   // User ID who cancelled
  cancelledAt       DateTime @default(now())
  notes             String?  // Free-form audit notes
  
  exporter          Exporter @relation(fields: [exporterId], references: [id], onDelete: Cascade)
  
  @@unique([exporterId, sequenceNumber])
  @@index([exporterId, cancelledAt])
}

// Link to exporter
model Exporter {
  // ... existing fields ...
  invoiceSequence   InvoiceSequence?
  cancelledNumbers  CancelledInvoiceNumber[]
}
```

#### 3. InvoiceSequenceAudit Table (Complete Audit Trail)
```prisma
model InvoiceSequenceAudit {
  id              String   @id @default(cuid())
  exporterId      String
  invoiceId       String?
  
  // What action?
  action          String   // "ISSUED" | "SKIPPED" | "CANCELLED" | "REISSUED" | "SEQUENCE_CORRECTED"
  
  // The number involved
  invoiceNumber   String
  sequenceNumber  Int
  expectedNext    Int      // What should the next number have been?
  
  // Timing information
  invoiceDate     DateTime // The date on invoice (not system date)
  systemTime      DateTime @default(now())
  
  // User info
  userId          String?
  ipAddress       String?
  
  // Status
  status          String   // "SUCCESS" | "VIOLATION_ALLOWED" | "VIOLATION_BLOCKED"
  reason          String?
  
  exporter        Exporter @relation(fields: [exporterId], references: [id], onDelete: Cascade)
  
  @@index([exporterId, action])
  @@index([exporterId, invoiceDate])
}

// Link to exporter
model Exporter {
  // ... existing fields ...
  sequenceAudits  InvoiceSequenceAudit[]
}
```

---

## Sequencing Validation Rules

### Rule 1: Next Number Must Be Sequential
```typescript
if (invoiceNumber !== expected_next_number) {
  if (invoiceNumber > expected_next_number) {
    // GAP DETECTED
    error: "Invoice number skips sequence. Expected #NNN, got #MMM"
    action: BLOCK
  }
  if (invoiceNumber < expected_next_number) {
    // OUT OF SEQUENCE
    error: "Invoice number is out of sequence (already issued higher)"
    action: BLOCK
  }
}
```

### Rule 2: Cannot Backdate Before Last Invoice
```typescript
if (invoiceDate < lastIssuedDate) {
  error: "Cannot backdate before last invoice ({{lastIssuedDate}})"
  action: BLOCK
  reason: "Export law requires chronological invoicing"
}
```

### Rule 3: Cannot Reuse Cancelled Numbers
```typescript
cancelled = await prisma.cancelledInvoiceNumber.findUnique({
  where: { 
    exporterId_sequenceNumber: {
      exporterId: exporter.id,
      sequenceNumber: parsed_number
    }
  }
})

if (cancelled) {
  error: "Invoice number was previously cancelled on {{date}} - cannot reuse"
  action: BLOCK
  reason: "Audit trail integrity violation"
}
```

### Rule 4: Gap Analysis (Optional Strictness Setting)
```typescript
// Strict mode: No gaps allowed
if (mode === "STRICT" && invoiceNumber !== (lastNumber + 1)) {
  error: "Gaps in invoice sequence not allowed in strict mode"
  action: BLOCK or WARN
}

// Permissive mode: Allow gaps, but log them
if (mode === "PERMISSIVE" && invoiceNumber > (lastNumber + 1)) {
  action: LOG & WARN
  audit: "Gap from #{lastNumber} to #{invoiceNumber}"
}
```

---

## Implementation: generateNextInvoiceNumber()

```typescript
/**
 * Generate next sequential invoice number for exporter
 * ENFORCES sequencing rules:
 * - No gaps (sequential only)
 * - No backdating
 * - No reusing cancelled numbers
 */
async function generateNextInvoiceNumber(
  exporterId: string,
  invoiceDate: Date = new Date(),
  prefix?: string,
  suffix?: string,
  strictMode: boolean = true
): Promise<{
  invoiceNumber: string
  sequenceNumber: number
  issuedAt: Date
  audit: {
    nextExpected: number
    validation: string
    allowed: boolean
  }
}> {
  // 1. Get exporter's sequence record
  let sequence = await prisma.invoiceSequence.findUnique({
    where: { exporterId }
  })

  if (!sequence) {
    // First invoice for this exporter - initialize sequence
    sequence = await prisma.invoiceSequence.create({
      data: {
        exporterId,
        nextNumber: 1,
        lastIssuedNumber: 0,
        prefix: prefix || "INV-",
        suffix: suffix || `/${new Date().getFullYear()}`,
        padLength: 6
      }
    })
  }

  // 2. Check backdating rule
  if (sequence.lastIssuedDate && invoiceDate < sequence.lastIssuedDate) {
    throw new Error(
      `Cannot backdate invoice before last issued date (${sequence.lastIssuedDate.toISOString()}). ` +
      `RBI regulations require chronological invoicing.`
    )
  }

  // 3. Generate next number
  const nextNumber = sequence.nextNumber
  const paddedNumber = String(nextNumber).padStart(sequence.padLength, "0")
  const invoiceNumber = `${sequence.prefix}${paddedNumber}${sequence.suffix}`

  // 4. Check if this number was previously cancelled (REUSE VIOLATION)
  const cancelled = await prisma.cancelledInvoiceNumber.findUnique({
    where: {
      exporterId_sequenceNumber: {
        exporterId,
        sequenceNumber: nextNumber
      }
    }
  })

  if (cancelled) {
    throw new Error(
      `Invoice number ${invoiceNumber} was previously cancelled on ${cancelled.cancelledAt.toISOString()} ` +
      `(Reason: ${cancelled.reason}). Cannot reuse. ` +
      `Please contact support if this is a correction.`
    )
  }

  // 5. Update sequence tracker
  const updated = await prisma.invoiceSequence.update({
    where: { exporterId },
    data: {
      nextNumber: nextNumber + 1,
      lastIssuedNumber: nextNumber,
      lastIssuedDate: invoiceDate
    }
  })

  // 6. Log to audit trail
  await prisma.invoiceSequenceAudit.create({
    data: {
      exporterId,
      action: "ISSUED",
      invoiceNumber,
      sequenceNumber: nextNumber,
      expectedNext: nextNumber + 1,
      invoiceDate,
      status: "SUCCESS"
    }
  })

  return {
    invoiceNumber,
    sequenceNumber: nextNumber,
    issuedAt: new Date(),
    audit: {
      nextExpected: nextNumber + 1,
      validation: "Sequential, not backdated, not cancelled",
      allowed: true
    }
  }
}
```

---

## Handling Cancellations (Audit-Proof)

### When User Deletes/Cancels an Invoice

```typescript
async function cancelInvoice(
  invoiceId: string,
  reason: "USER_DELETED" | "FRAUD" | "DUPLICATE" | "CORRECTION",
  userId: string
) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { exporter: true }
  })

  if (!invoice) throw new Error("Invoice not found")

  // Parse the invoice number to get sequence number
  const sequenceNumber = parseInvoiceNumber(invoice.invoiceNumber)

  // Register as cancelled (PERMANENT BLOCK on reuse)
  await prisma.cancelledInvoiceNumber.create({
    data: {
      exporterId: invoice.exporterId,
      invoiceNumber: invoice.invoiceNumber!,
      sequenceNumber,
      reason,
      cancelledBy: userId,
      notes: `Cancelled invoice ${invoice.invoiceNumber} dated ${invoice.invoiceDate}`
    }
  })

  // For corrections: Create audit link to new invoice (if applicable)
  if (reason === "CORRECTION") {
    // User will create new invoice - we'll link them in audit
    console.log(`Invoice ${invoice.invoiceNumber} cancelled for correction. ` +
                `Next invoice will be recorded as correction replacement.`)
  }

  // Log audit
  await prisma.invoiceSequenceAudit.create({
    data: {
      exporterId: invoice.exporterId,
      invoiceId,
      action: "CANCELLED",
      invoiceNumber: invoice.invoiceNumber!,
      sequenceNumber,
      expectedNext: (await getCurrentSequence(invoice.exporterId)).nextNumber,
      invoiceDate: invoice.invoiceDate,
      userId,
      status: "SUCCESS",
      reason
    }
  })

  // Delete the invoice
  await prisma.invoice.delete({ where: { id: invoiceId } })

  return {
    success: true,
    message: `Invoice ${invoice.invoiceNumber} cancelled and registered in audit trail. Number cannot be reused.`,
    auditNote: `Cancelled numbers are permanent and visible in compliance audit reports.`
  }
}
```

---

## Schema Migration

```sql
-- Create InvoiceSequence
CREATE TABLE "InvoiceSequence" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "exporterId" TEXT NOT NULL UNIQUE,
  "nextNumber" INTEGER NOT NULL DEFAULT 1,
  "lastIssuedNumber" INTEGER NOT NULL DEFAULT 0,
  "lastIssuedDate" TIMESTAMP,
  "lastIssuedId" TEXT,
  "prefix" TEXT,
  "suffix" TEXT,
  "padLength" INTEGER NOT NULL DEFAULT 6,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("exporterId") REFERENCES "Exporter"("id") ON DELETE CASCADE
);

-- Create CancelledInvoiceNumber
CREATE TABLE "CancelledInvoiceNumber" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "exporterId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "sequenceNumber" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "linkedInvoiceId" TEXT,
  "cancelledBy" TEXT NOT NULL,
  "cancelledAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  FOREIGN KEY ("exporterId") REFERENCES "Exporter"("id") ON DELETE CASCADE,
  UNIQUE ("exporterId", "sequenceNumber")
);
CREATE INDEX "idx_cancelled_exporter_date" ON "CancelledInvoiceNumber"("exporterId", "cancelledAt");

-- Create InvoiceSequenceAudit
CREATE TABLE "InvoiceSequenceAudit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "exporterId" TEXT NOT NULL,
  "invoiceId" TEXT,
  "action" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "sequenceNumber" INTEGER NOT NULL,
  "expectedNext" INTEGER NOT NULL,
  "invoiceDate" TIMESTAMP NOT NULL,
  "systemTime" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT,
  "ipAddress" TEXT,
  "status" TEXT NOT NULL,
  "reason" TEXT,
  FOREIGN KEY ("exporterId") REFERENCES "Exporter"("id") ON DELETE CASCADE
);
CREATE INDEX "idx_audit_exporter_action" ON "InvoiceSequenceAudit"("exporterId", "action");
CREATE INDEX "idx_audit_exporter_date" ON "InvoiceSequenceAudit"("exporterId", "invoiceDate");
```

---

## Audit Report: Gap Detection

```typescript
async function generateSequenceAuditReport(exporterId: string) {
  const sequence = await prisma.invoiceSequence.findUnique({
    where: { exporterId }
  })

  const audits = await prisma.invoiceSequenceAudit.findMany({
    where: { exporterId },
    orderBy: { invoiceDate: 'asc' }
  })

  const cancelled = await prisma.cancelledInvoiceNumber.findMany({
    where: { exporterId }
  })

  // Detect gaps
  const gaps: { from: number, to: number, count: number }[] = []
  let lastNumber = 0
  
  audits.forEach(audit => {
    if (audit.sequenceNumber > lastNumber + 1) {
      gaps.push({
        from: lastNumber + 1,
        to: audit.sequenceNumber - 1,
        count: audit.sequenceNumber - (lastNumber + 1)
      })
    }
    lastNumber = Math.max(lastNumber, audit.sequenceNumber)
  })

  return {
    exporterId,
    totalIssued: audits.filter(a => a.action === 'ISSUED').length,
    totalCancelled: cancelled.length,
    gaps: gaps.length > 0 ? gaps : "No gaps detected ✅",
    recentActivity: audits.slice(-10),
    cancelledNumbers: cancelled,
    verdict: gaps.length === 0 ? "AUDIT PASS ✅" : "GAPS DETECTED ⚠️"
  }
}
```

---

## Integration: When Creating Invoice

```typescript
// In API route: POST /api/invoices
async function createInvoice(data: InvoiceData) {
  // ... validation ...

  // FORCE auto-generated invoice number
  const { invoiceNumber, audit } = await generateNextInvoiceNumber(
    data.exporterId,
    new Date(data.invoiceDate),
    data.invoicePrefix,
    data.invoiceSuffix
  )

  // Create invoice with forced number
  const invoice = await prisma.invoice.create({
    data: {
      ...data,
      invoiceNumber, // ← ALWAYS from sequence generator, never from user input
      invoiceDate: new Date(data.invoiceDate)
    }
  })

  return {
    invoice,
    sequenceAudit: audit,
    message: `Invoice ${invoiceNumber} created sequentially. Next: ${audit.nextExpected}`
  }
}
```

---

## Audit-Ready Reporting

### Bank/RBI Compliance Report
```
Invoice Sequence Audit - Exporter: ABC Exports Ltd
Generated: 2026-02-06 14:32 IST
Status: PASS ✅

Invoice Statistics:
  Total Issued: 247
  Total Cancelled: 3
  Last Issued: INV-000247/2026
  Last Date: 2026-02-05

Cancelled Numbers (Never Reusable):
  #125 - Cancelled 2025-12-15 (USER_DELETED)
  #189 - Cancelled 2026-01-22 (DUPLICATE)
  #203 - Cancelled 2026-02-02 (FRAUD_PREVENTED)

Gap Analysis:
  Status: No gaps detected ✅
  
Backdating Check:
  Status: No backdated invoices detected ✅
  
Reuse Attempts:
  Status: 0 blocked reuse attempts ✅

Audit Trail Integrity:
  All 247 invoices traceable in sequential order
  Audit entries: 250 (issued + actions)
  
Verdict: AUDITOR PASS ✅
  - Sequential numbering maintained
  - No gaps or inconsistencies
  - Cancelled numbers permanently blocked
  - Complete audit trail available
```

---

## Compliance Checklist

- [ ] **Sequencing**: Only consecutive numbers allowed
- [ ] **Chronological**: Cannot backdate before last invoice
- [ ] **No Reuse**: Cancelled numbers permanently blocked
- [ ] **Audit Trail**: Every action logged with timestamp, user, reason
- [ ] **Gap Detection**: Reports available for auditors
- [ ] **RBI Compliant**: Meets FEMA Master Direction requirements
- [ ] **Customs Ready**: Shipping Bill references valid sequences
- [ ] **Fraud Prevention**: No way to manipulate sequence

---

**Status: Currently = 🟢 Unique | Needed = 🔴 Sequential + Audit + Anti-Reuse**
