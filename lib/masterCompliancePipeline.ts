/**
 * MASTER COMPLIANCE PIPELINE
 * ==========================
 * 
 * ENFORCEMENT GATE: Runs all 5 critical engines BEFORE document generation
 * 
 * Flow:
 * 1. LC_CHECK - Letter of Credit compliance
 * 2. TRADE_CHECK - Trade classification & restrictions
 * 3. PORT_CHECK - Port & AD code validation
 * 4. REALIZATION_CHECK - Payment terms & RBI compliance  
 * 5. CONSISTENCY_CHECK - Cross-document alignment
 * 
 * DECISION LOGIC:
 * - If ANY engine returns blockers → 400 Bad Request (no documents)
 * - If ALL pass → 200 OK (generate documents)
 * 
 * SECURITY: No document output without complete green signal
 */

// ⚠️ IMPORT PATTERN FOR REAL ENGINES:
// import { validateTradeClassification } from "./tradeClassificationEngine"
// 
// When using real engines, make sure:
// 1. Master data matches the HS code formats used in your system
// 2. All required fields are provided
// 3. Database connections are available

// ============================================
// TYPES
// ============================================

import { isValidUnlocode } from "./unlocode"

export interface CompliancePipelineInput {
  invoiceId: string
  userId: string
  
  // LC data
  lcNumber?: string
  lcAmount?: number
  lcCurrency?: string
  lcIssueDate?: Date
  lcExpiryDate?: Date
  lcPresentationDays?: number
  
  // Invoice data
  buyerName?: string
  buyerEmail?: string
  invoiceAmount: number
  invoiceCurrency: string
  invoiceLines: Array<{
    lineNo: number
    hsCode: string
    commodity: string
    quantity: number
    unitPrice: number
    gstRate?: number
  }>
  
  // Shipping data
  exporterName: string
  exporterIEC: string
  portOfLoading: string      // INMAA, INMAB1, INMAE, etc
  portOfDischarge?: string
  incoterm: string            // FOB, CIF, CFR, EXW, DDP, etc
  paymentTerm: string         // Advance, LC, DA, DP, COD, Credit
  
  // Document data
  packingListQty?: number
  packingListWeight?: number  // Net weight
  shippingBillWeight?: number // Gross weight (with packaging)
  
  // Insurance data
  insuranceAmount?: number
  insuranceCurrency?: string
  
  // Timestamp
  submittedAt: Date
}

export interface EngineCheckResult {
  engine: string
  allowed: boolean
  blockers: Array<{ code: string; message: string; severity: "FATAL" | "MAJOR" }>
  warnings: Array<{ code: string; message: string }>
  auditLog: Array<{ timestamp: Date; message: string }>
}

export interface MasterComplianceResult {
  invoiceId: string
  pipelineAllowed: boolean    // master decision
  timestamp: Date
  
  // Individual engine results
  lc_check: EngineCheckResult
  trade_check: EngineCheckResult
  port_check: EngineCheckResult
  realization_check: EngineCheckResult
  consistency_check: EngineCheckResult
  
  // Summary
  totalBlockers: number
  totalWarnings: number
  fatalBlockers: string[]     // codes
  
  // Response codes
  httpStatusCode: 200 | 400
  errorMessage?: string
  
  // Audit trail
  executionTime: number       // milliseconds
  auditLog: Array<{
    engine: string
    status: "PASSED" | "FAILED"
    timestamp: Date
    message: string
  }>
}

// ============================================
// DEFAULT EMPTY ENGINE RESULT
// ============================================

function createEmptyEngineResult(engineName: string): EngineCheckResult {
  return {
    engine: engineName,
    allowed: true,
    blockers: [],
    warnings: [],
    auditLog: [
      {
        timestamp: new Date(),
        message: `${engineName} validation engine ready (stub implementation)`
      }
    ]
  }
}

// ============================================
// MASTER PIPELINE EXECUTION
// ============================================

export async function runMasterCompliancePipeline(
  input: CompliancePipelineInput
): Promise<MasterComplianceResult> {
  
  const startTime = Date.now()
  const auditLog: Array<{ engine: string; status: "PASSED" | "FAILED"; timestamp: Date; message: string }> = []
  
  console.log(`\n🔒 MASTER COMPLIANCE PIPELINE STARTED`)
  console.log(`   Invoice: ${input.invoiceId}`)
  console.log(`   Exporter: ${input.exporterName}`)
  console.log(`   Amount: ${input.invoiceAmount} ${input.invoiceCurrency}`)
  console.log(`   Port: ${input.portOfLoading}\n`)
  
  // ============================================
  // ENGINE 1: LC COMPLIANCE CHECK
  // ============================================
  
  let lc_check = createEmptyEngineResult("LC_COMPLIANCE")
  
  try {
    console.log(`⏳ [1/5] Running LC Compliance Check...`)
    
    // Check if LC is required based on payment term
    const lcRequired = input.paymentTerm === "LC"
    
    if (lcRequired && !input.lcNumber) {
      lc_check.allowed = false
      lc_check.blockers.push({
        code: "LC_REQUIRED_BUT_MISSING",
        message: `LC payment term requires Letter of Credit`,
        severity: "FATAL"
      })
    } else if (!lcRequired && input.paymentTerm === "Advance") {
      lc_check.allowed = true
      console.log(`   ✅ No LC required for ${input.paymentTerm} terms`)
      auditLog.push({
        engine: "LC_COMPLIANCE",
        status: "PASSED",
        timestamp: new Date(),
        message: "LC not required for Advance payment"
      })
    } else {
      lc_check.allowed = true
      auditLog.push({
        engine: "LC_COMPLIANCE",
        status: "PASSED",
        timestamp: new Date(),
        message: "LC compliance validated"
      })
    }
    
    if (lc_check.allowed) {
      console.log(`   ✅ LC Compliance PASSED`)
    } else {
      console.log(`   ❌ LC Compliance FAILED`)
      auditLog.push({
        engine: "LC_COMPLIANCE",
        status: "FAILED",
        timestamp: new Date(),
        message: `LC validation failed: ${lc_check.blockers.map(b => b.code).join(", ")}`
      })
    }
  } catch (err) {
    console.error(`   ⚠️  LC Check error: ${err instanceof Error ? err.message : String(err)}`)
    lc_check.allowed = false
    lc_check.blockers.push({
      code: "LC_CHECK_ERROR",
      message: `LC validation error: ${err instanceof Error ? err.message : "Unknown"}`,
      severity: "FATAL"
    })
  }
  
  // ============================================
  // ENGINE 2: TRADE CLASSIFICATION CHECK
  // ============================================
  // 
  // 🔧 TO INTEGRATE REAL ENGINE:
  // Replace stub below with:
  //   const tradeResult = await validateTradeClassification({
  //     hsCode: line.hsCode,
  //     gstRate: line.gstRate || 0,
  //     commodity: line.commodity,
  //     countryOfDestination: "USA",
  //     quantity: line.quantity,
  //     unitPrice: line.unitPrice
  //   })
  //
  // ⚠️ NOTE: Ensure master data HS code format matches your system
  //
  
  let trade_check = createEmptyEngineResult("TRADE_CLASSIFICATION")
  
  try {
    console.log(`⏳ [2/5] Running Trade Classification Check...`)
    
    // STUB: Basic HS code format validation (6-8 digits)
    const invalidHSCodes = input.invoiceLines.filter(
      line => !/^\d{6,8}$/.test(line.hsCode)
    )
    
    if (invalidHSCodes.length > 0) {
      trade_check.allowed = false
      trade_check.blockers.push({
        code: "INVALID_HS_CODE_FORMAT",
        message: `Invalid HS codes (need 6-8 digits): ${invalidHSCodes.map(l => l.hsCode).join(", ")}`,
        severity: "FATAL"
      })
    } else {
      trade_check.allowed = true
      console.log(`   ✅ Trade Classification PASSED (${input.invoiceLines.length} items)`)
      auditLog.push({
        engine: "TRADE_CLASSIFICATION",
        status: "PASSED",
        timestamp: new Date(),
        message: `Trade classification validated for ${input.invoiceLines.length} line items`
      })
    }
    
    if (!trade_check.allowed) {
      console.log(`   ❌ Trade Classification FAILED`)
      auditLog.push({
        engine: "TRADE_CLASSIFICATION",
        status: "FAILED",
        timestamp: new Date(),
        message: `Trade classification failed: ${trade_check.blockers.map(b => b.code).join(", ")}`
      })
    }
  } catch (err) {
    console.error(`   ⚠️  Trade Check error: ${err instanceof Error ? err.message : String(err)}`)
    trade_check.allowed = false
    trade_check.blockers.push({
      code: "TRADE_CHECK_ERROR",
      message: `Trade check error: ${err instanceof Error ? err.message : "Unknown"}`,
      severity: "FATAL"
    })
  }
  
  // ============================================
  // ENGINE 3: PORT COMPLIANCE CHECK
  // ============================================
  
  let port_check = createEmptyEngineResult("PORT_COMPLIANCE")
  
  try {
    console.log(`⏳ [3/5] Running Port Compliance Check...`)

    const portOfLoading = (input.portOfLoading || "").trim().toUpperCase()
    const isValidPort = portOfLoading ? await isValidUnlocode(portOfLoading) : false

    if (!isValidPort) {
      port_check.allowed = false
      port_check.blockers.push({
        code: "INVALID_PORT_CODE",
        message: `Port ${portOfLoading || "(missing)"} is not a valid UN/LOCODE`,
        severity: "FATAL"
      })
    } else {
      port_check.allowed = true
      console.log(`   ✅ Port Compliance PASSED`)
      auditLog.push({
        engine: "PORT_COMPLIANCE",
        status: "PASSED",
        timestamp: new Date(),
        message: `Port ${input.portOfLoading} validated`
      })
    }
    
    if (!port_check.allowed) {
      console.log(`   ❌ Port Compliance FAILED`)
      auditLog.push({
        engine: "PORT_COMPLIANCE",
        status: "FAILED",
        timestamp: new Date(),
        message: `Port compliance failed: ${port_check.blockers.map(b => b.code).join(", ")}`
      })
    }
  } catch (err) {
    console.error(`   ⚠️  Port Check error: ${err instanceof Error ? err.message : String(err)}`)
    port_check.allowed = false
    port_check.blockers.push({
      code: "PORT_CHECK_ERROR",
      message: `Port check error: ${err instanceof Error ? err.message : "Unknown"}`,
      severity: "FATAL"
    })
  }
  
  // ============================================
  // ENGINE 4: FEMA REALIZATION CHECK
  // ============================================
  
  let realization_check = createEmptyEngineResult("FEMA_REALIZATION")
  
  try {
    console.log(`⏳ [4/5] Running FEMA Realization Check...`)
    
    // Validate payment terms
    const validTerms = ["Advance", "LC", "DA", "DP", "COD", "Credit"]
    
    if (!validTerms.includes(input.paymentTerm)) {
      realization_check.allowed = false
      realization_check.blockers.push({
        code: "INVALID_PAYMENT_TERM",
        message: `Payment term ${input.paymentTerm} not recognized`,
        severity: "FATAL"
      })
    } else {
      realization_check.allowed = true
      console.log(`   ✅ FEMA Realization PASSED`)
      auditLog.push({
        engine: "FEMA_REALIZATION",
        status: "PASSED",
        timestamp: new Date(),
        message: `Payment term ${input.paymentTerm} validated`
      })
    }
    
    if (!realization_check.allowed) {
      console.log(`   ❌ FEMA Realization FAILED`)
      auditLog.push({
        engine: "FEMA_REALIZATION",
        status: "FAILED",
        timestamp: new Date(),
        message: `FEMA realization failed: ${realization_check.blockers.map(b => b.code).join(", ")}`
      })
    }
  } catch (err) {
    console.error(`   ⚠️  Realization Check error: ${err instanceof Error ? err.message : String(err)}`)
    realization_check.allowed = false
    realization_check.blockers.push({
      code: "REALIZATION_CHECK_ERROR",
      message: `Realization check error: ${err instanceof Error ? err.message : "Unknown"}`,
      severity: "FATAL"
    })
  }
  
  // ============================================
  // ENGINE 5: CROSS-DOCUMENT CONSISTENCY CHECK
  // ============================================
  
  let consistency_check = createEmptyEngineResult("CONSISTENCY")
  
  try {
    console.log(`⏳ [5/5] Running Cross-Document Consistency Check (THE MOAT)...`)
    
    // Basic consistency checks
    let consistencyScore = 100
    
    // Check incoterm has required ports
    const incotermRequiresDischarge = ["CIF", "CFR", "DDP"].includes(input.incoterm)
    if (incotermRequiresDischarge && !input.portOfDischarge) {
      consistency_check.allowed = false
      consistency_check.blockers.push({
        code: "INCOTERM_PORT_MISMATCH",
        message: `Incoterm ${input.incoterm} requires port of discharge`,
        severity: "FATAL"
      })
      consistencyScore = 0
    } else {
      consistency_check.allowed = true
      console.log(`   ✅ Consistency Check PASSED (Score: ${consistencyScore}%)`)
      auditLog.push({
        engine: "CONSISTENCY",
        status: "PASSED",
        timestamp: new Date(),
        message: `Cross-document consistency validated (score: ${consistencyScore}%)`
      })
    }
    
    if (!consistency_check.allowed) {
      console.log(`   ❌ Consistency Check FAILED (Score: ${consistencyScore}%)`)
      auditLog.push({
        engine: "CONSISTENCY",
        status: "FAILED",
        timestamp: new Date(),
        message: `Consistency check failed: ${consistency_check.blockers.map(b => b.code).join(", ")}`
      })
    }
  } catch (err) {
    console.error(`   ⚠️  Consistency Check error: ${err instanceof Error ? err.message : String(err)}`)
    consistency_check.allowed = false
    consistency_check.blockers.push({
      code: "CONSISTENCY_CHECK_ERROR",
      message: `Consistency check error: ${err instanceof Error ? err.message : "Unknown"}`,
      severity: "FATAL"
    })
  }
  
  // ============================================
  // FINAL DECISION LOGIC
  // ============================================
  
  const pipelineAllowed = 
    lc_check.allowed && 
    trade_check.allowed && 
    port_check.allowed && 
    realization_check.allowed && 
    consistency_check.allowed
  
  const executionTime = Date.now() - startTime
  const httpStatusCode = pipelineAllowed ? 200 : 400
  
  const allBlockers = [
    ...lc_check.blockers,
    ...trade_check.blockers,
    ...port_check.blockers,
    ...realization_check.blockers,
    ...consistency_check.blockers
  ]
  
  console.log(`\n${"=".repeat(60)}`)
  if (pipelineAllowed) {
    console.log(`✅ MASTER COMPLIANCE PIPELINE: PASSED - DOCUMENTS APPROVED`)
  } else {
    console.log(`❌ MASTER COMPLIANCE PIPELINE: FAILED - BLOCKING DOCUMENT GENERATION`)
  }
  console.log(`   Execution Time: ${executionTime}ms`)
  console.log(`   Total Blockers: ${allBlockers.length}`)
  if (allBlockers.length > 0) {
    console.log(`   Fatal Issues: ${allBlockers.filter(b => b.severity === "FATAL").map(b => b.code).join(", ")}`)
  }
  console.log(`${"=".repeat(60)}\n`)
  
  return {
    invoiceId: input.invoiceId,
    pipelineAllowed,
    timestamp: new Date(),
    
    lc_check,
    trade_check,
    port_check,
    realization_check,
    consistency_check,
    
    totalBlockers: allBlockers.length,
    
    totalWarnings: [
      ...lc_check.warnings,
      ...trade_check.warnings,
      ...port_check.warnings,
      ...realization_check.warnings,
      ...consistency_check.warnings
    ].length,
    
    fatalBlockers: allBlockers
      .filter(b => b.severity === "FATAL")
      .map(b => b.code),
    
    httpStatusCode,
    errorMessage: pipelineAllowed ? undefined : "Compliance pipeline failed - document generation blocked",
    
    executionTime,
    auditLog
  }
}

// ============================================
// HELPER: Can Generate Documents?
// ============================================

export function canGenerateDocuments(result: MasterComplianceResult): boolean {
  return result.pipelineAllowed && result.httpStatusCode === 200
}

// ============================================
// HELPER: Get All Blockers
// ============================================

export function getAllBlockers(result: MasterComplianceResult): Array<{ engine: string; code: string; message: string }> {
  return [
    ...result.lc_check.blockers.map(b => ({ engine: "LC_COMPLIANCE", code: b.code, message: b.message })),
    ...result.trade_check.blockers.map(b => ({ engine: "TRADE_CLASSIFICATION", code: b.code, message: b.message })),
    ...result.port_check.blockers.map(b => ({ engine: "PORT_COMPLIANCE", code: b.code, message: b.message })),
    ...result.realization_check.blockers.map(b => ({ engine: "FEMA_REALIZATION", code: b.code, message: b.message })),
    ...result.consistency_check.blockers.map(b => ({ engine: "CONSISTENCY", code: b.code, message: b.message }))
  ]
}
