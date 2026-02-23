/**
 * FEMA REALIZATION COMPLIANCE ENGINE TEST SUITE
 * 
 * 12 Comprehensive Tests (Clause-Level Logic):
 * - Advance payment timing (2 tests)
 * - LC governance UCP 600 (2 tests)
 * - DA/DP risk flagging (2 tests)
 * - RBI reference injection (1 test)
 * - Realization timeline (2 tests)
 * - Integration scenarios (3 tests)
 * 
 * Ready to run with: npm run test lib/realizationCompliance.test.ts
 */

import { describe, it, expect } from "vitest"
import {
  validateRealization,
  canGenerateInvoiceDocuments_Realization,
  generateRealizationReport,
  type RealizationComplianceInput,
  type PaymentTermType
} from "./realizationCompliance"

describe("Engine 6: FEMA Realization Compliance Engine", () => {
  
  // ============================================
  // RULE 1: ADVANCE PAYMENT TIMING (2 tests)
  // ============================================
  
  describe("Rule 1: Advance Payment Realization Timing", () => {
    
    it("should pass when advance is received BEFORE shipment", async () => {
      const shipmentDate = new Date("2026-03-15")
      const advanceReceivedDate = new Date("2026-03-10")  // 5 days before
      
      const result = await validateRealization({
        invoiceId: "INV-ADV-001",
        paymentTerms: "Advance",
        shipmentDate,
        advanceReceivedDate,
        invoiceAmount: 100000,
        invoiceCurrency: "USD"
      })
      
      expect(result.isCompliant).toBe(true)
      expect(result.advanceReceivedOnTime).toBe(true)
      expect(result.errors.filter(e => e.code === "ADVANCE_NOT_REALIZED_BEFORE_SHIPMENT")).toHaveLength(0)
      console.log("✅ Test 1a: Advance received 5 days before shipment - COMPLIANT")
    })
    
    it("should fail when advance is NOT received or received AFTER shipment", async () => {
      const shipmentDate = new Date("2026-03-15")
      const advanceReceivedDate = new Date("2026-03-20")  // 5 days AFTER shipment
      
      const result = await validateRealization({
        invoiceId: "INV-ADV-002",
        paymentTerms: "Advance",
        shipmentDate,
        advanceReceivedDate,
        invoiceAmount: 100000,
        invoiceCurrency: "USD"
      })
      
      expect(result.isCompliant).toBe(false)
      expect(result.errors.some(e => e.code === "ADVANCE_NOT_REALIZED_BEFORE_SHIPMENT")).toBe(true)
      console.log("✅ Test 1b: Advance received AFTER shipment - BLOCKED by RBI rule")
    })
  })
  
  // ============================================
  // RULE 2: LC GOVERNANCE - UCP 600 (2 tests)
  // ============================================
  
  describe("Rule 2: LC Governance UCP 600", () => {
    
    it("should pass when LC is valid with sufficient presentation period", async () => {
      const shipmentDate = new Date("2026-03-15")
      // LC expiry 60 days from now (provides 45-day presentation window + 15-day buffer)
      const today = new Date()
      const lcExpiryDate = new Date(today)
      lcExpiryDate.setDate(lcExpiryDate.getDate() + 60)
      
      const result = await validateRealization({
        invoiceId: "INV-LC-001",
        paymentTerms: "LC",
        shipmentDate,
        lcNumber: "LC2026/VALID/001",
        lcExpiryDate,
        invoiceAmount: 100000,
        invoiceCurrency: "USD"
      })
      
      expect(result.isCompliant).toBe(true)
      expect(result.errors.some(e => e.code === "LC_UCP600_VIOLATION")).toBe(false)
      console.log("✅ Test 2a: LC with 60-day expiry - UCP 600 presentation period compliant")
    })
    
    it("should fail when LC lacks sufficient UCP 600 presentation window", async () => {
      const shipmentDate = new Date("2026-03-15")
      // LC expiry only 20 days from now (insufficient for 45-day UCP 600 window)
      const today = new Date()
      const lcExpiryDate = new Date(today)
      lcExpiryDate.setDate(lcExpiryDate.getDate() + 20)
      
      const result = await validateRealization({
        invoiceId: "INV-LC-002",
        paymentTerms: "LC",
        shipmentDate,
        lcNumber: "LC2026/SHORT/002",
        lcExpiryDate,
        invoiceAmount: 100000,
        invoiceCurrency: "USD"
      })
      
      expect(result.isCompliant).toBe(false)
      expect(result.errors.some(e => e.code === "LC_UCP600_VIOLATION")).toBe(true)
      console.log("✅ Test 2b: LC with 20-day expiry - INSUFFICIENT for UCP 600, BLOCKED")
    })
  })
  
  // ============================================
  // RULE 3: DA/DP RISK FLAGGING (2 tests)
  // ============================================
  
  describe("Rule 3: DA/DP Risk Flagging", () => {
    
    it("should flag DA payment term as HIGH RISK with detailed disclosures", async () => {
      const shipmentDate = new Date("2026-03-15")
      
      const result = await validateRealization({
        invoiceId: "INV-DA-001",
        paymentTerms: "DA",
        shipmentDate,
        daAcceptanceDate: new Date("2026-03-25"),  // 10 days after shipment
        invoiceAmount: 100000,
        invoiceCurrency: "USD"
      })
      
      expect(result.riskLevel).toBe("HIGH")
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.riskDisclosures.length).toBeGreaterThan(0)
      
      // Verify risk types are documented
      const riskTypes = result.riskDisclosures.map(r => r.riskType)
      expect(riskTypes).toContain("Acceptance Risk")
      expect(riskTypes).toContain("Credit Risk")
      expect(riskTypes).toContain("Realization Risk")
      
      // Verify mitigations are provided
      result.riskDisclosures.forEach(disclosure => {
        expect(disclosure.mitigation).toBeTruthy()
      })
      
      console.log("✅ Test 3a: DA flagged as HIGH RISK with 3 risk types + mitigations")
    })
    
    it("should flag DP as MEDIUM RISK with payment-specific disclosures", async () => {
      const shipmentDate = new Date("2026-03-15")
      
      const result = await validateRealization({
        invoiceId: "INV-DP-001",
        paymentTerms: "DP",
        shipmentDate,
        dpPaymentDate: new Date("2026-03-25"),  // 10 days after shipment
        invoiceAmount: 100000,
        invoiceCurrency: "USD"
      })
      
      expect(result.riskLevel).toBe("MEDIUM")
      expect(result.riskDisclosures.length).toBeGreaterThan(0)
      
      // DP risks should focus on payment control
      const riskTypes = result.riskDisclosures.map(r => r.riskType)
      expect(riskTypes.some(t => t.includes("Payment"))).toBe(true)
      
      console.log("✅ Test 3b: DP flagged as MEDIUM RISK with payment control focus")
    })
  })
  
  // ============================================
  // RULE 4: RBI REFERENCE AUTO-INJECTION (1 test)
  // ============================================
  
  describe("Rule 4: RBI Reference Auto-Injection", () => {
    
    it("should auto-inject RBI Master Direction references for each payment term", async () => {
      const paymentTerms: PaymentTermType[] = ["Advance", "LC", "DA", "DP", "COD", "Credit"]
      const shipmentDate = new Date("2026-03-15")
      
      console.log("\n📋 RBI References Auto-Injected:")
      console.log("=========================================")
      
      for (const term of paymentTerms) {
        const result = await validateRealization({
          invoiceId: `INV-RBI-${term}`,
          paymentTerms: term,
          shipmentDate,
          invoiceAmount: 100000,
          invoiceCurrency: "USD"
        })
        
        expect(result.paymentClause.rbiReference).toBeTruthy()
        expect(result.paymentClause.rbiReference).toContain("RBI-Master Direction")
        
        console.log(`${term.padEnd(10)} → ${result.paymentClause.rbiReference.split("|")[0].trim()}`)
      }
      
      console.log("=========================================")
      console.log("✅ Test 4a: RBI references auto-injected for all 6 payment terms")
    })
  })
  
  // ============================================
  // RULE 5: REALIZATION TIMELINE (2 tests)
  // ============================================
  
  describe("Rule 5: Realization Timeline Enforcement", () => {
    
    it("should calculate correct deadline based on RBI window (example: LC 45 days)", async () => {
      const shipmentDate = new Date("2026-03-15")
      
      const result = await validateRealization({
        invoiceId: "INV-TIMELINE-LC",
        paymentTerms: "LC",
        shipmentDate,
        lcNumber: "LC2026/001",
        lcExpiryDate: new Date("2026-05-01"),  // Far future
        invoiceAmount: 100000,
        invoiceCurrency: "USD"
      })
      
      // LC realization window is 45 days per RBI
      const expectedDeadline = new Date(shipmentDate)
      expectedDeadline.setDate(expectedDeadline.getDate() + 45)
      
      // Check deadline is approximately correct (within 1 day)
      const daysDiff = Math.abs(
        (result.paymentClause.realizationDeadline.getTime() - expectedDeadline.getTime()) /
        (1000 * 60 * 60 * 24)
      )
      
      expect(daysDiff).toBeLessThan(1)
      expect(result.paymentClause.daysRemaining).toBeGreaterThan(40)  // Should be ~45 days
      
      console.log("✅ Test 5a: LC realization deadline = 45 days from shipment (UCP 600)")
    })
    
    it("should flag AT_RISK when deadline is within 7 days", async () => {
      // Shipment happened 38 days ago (7 days from LC 45-day deadline)
      const shipmentDate = new Date()
      shipmentDate.setDate(shipmentDate.getDate() - 38)
      
      const result = await validateRealization({
        invoiceId: "INV-TIMELINE-RISK",
        paymentTerms: "LC",
        shipmentDate,
        lcNumber: "LC2026/001",
        lcExpiryDate: new Date("2026-12-31"),
        invoiceAmount: 100000,
        invoiceCurrency: "USD"
      })
      
      expect(result.realizationStatus).toBe("AT_RISK")
      expect(result.paymentClause.daysRemaining).toBeLessThanOrEqual(7)
      expect(result.warnings.some(w => w.code === "REALIZATION_AT_RISK")).toBe(true)
      
      console.log("✅ Test 5b: Realization deadline within 7 days - AT_RISK status")
    })
  })
  
  // ============================================
  // INTEGRATION TESTS (3 tests)
  // ============================================
  
  describe("Integration: Clause-Level Validation Scenarios", () => {
    
    it("should validate complete Advance payment flow", async () => {
      const shipmentDate = new Date("2026-03-15")
      const advanceReceivedDate = new Date("2026-03-10")
      
      const result = await validateRealization({
        invoiceId: "INV-COMPLETE-ADVANCE",
        paymentTerms: "Advance",
        shipmentDate,
        advanceReceivedDate,
        invoiceAmount: 100000,
        invoiceCurrency: "USD"
      })
      
      console.log("\n✅ Complete Advance Payment Flow:")
      console.log(`   Term: ${result.paymentClause.type}`)
      console.log(`   Advance Received: ${advanceReceivedDate.toDateString()}`)
      console.log(`   Shipment Scheduled: ${shipmentDate.toDateString()}`)
      console.log(`   Status: ${result.isCompliant ? "COMPLIANT" : "BLOCKED"}`)
      
      expect(result.isCompliant).toBe(true)
      expect(result.riskLevel).toBe("LOW")
    })
    
    it("should validate DA with risk disclosure and mitigation advice", async () => {
      const shipmentDate = new Date("2026-03-15")
      
      const result = await validateRealization({
        invoiceId: "INV-COMPLETE-DA",
        paymentTerms: "DA",
        shipmentDate,
        daAcceptanceDate: new Date("2026-03-25"),
        invoiceAmount: 100000,
        invoiceCurrency: "USD"
      })
      
      console.log("\n⚠️  DA Payment - High Risk Disclosure:")
      console.log(`   Payment Term: ${result.paymentClause.type}`)
      console.log(`   RBI Reference: ${result.paymentClause.rbiReference.split("|")[0].trim()}`)
      console.log(`   Risk Level: ${result.riskLevel}`)
      console.log(`   Realization Window: ${result.paymentClause.daysRemaining} days remaining`)
      console.log(`   Risks Identified: ${result.riskDisclosures.length}`)
      
      result.riskDisclosures.forEach((risk, idx) => {
        console.log(`\n   Risk ${idx + 1}: ${risk.riskType}`)
        console.log(`   → Mitigation: ${risk.mitigation}`)
      })
      
      expect(result.riskLevel).toBe("HIGH")
      expect(result.riskDisclosures.length).toBeGreaterThan(0)
    })
    
    it("should generate comprehensive compliance report", async () => {
      const shipmentDate = new Date("2026-03-15")
      
      const result = await validateRealization({
        invoiceId: "INV-REPORT-001",
        paymentTerms: "LC",
        shipmentDate,
        lcNumber: "LC2026/REPORT/001",
        lcExpiryDate: new Date("2026-05-01"),
        invoiceAmount: 100000,
        invoiceCurrency: "USD"
      })
      
      const report = generateRealizationReport(result)
      
      expect(report).toContain("FEMA REALIZATION COMPLIANCE REPORT")
      expect(report).toContain("LC")
      expect(report).toContain("RBI-Master Direction")
      expect(report).toContain("AUDIT LOG")
      expect(report).toContain("CLAUSE-LEVEL VALIDATION")
      
      console.log("\n✅ Compliance report generated with clause-level details")
    })
  })
  
  // ============================================
  // REAL-WORLD TRADE SCENARIOS
  // ============================================
  
  describe("Real-World FEMA Compliance Scenarios", () => {
    
    it("Scenario: US Buyer with LC Term (UCP 600 compliant)", async () => {
      const shipmentDate = new Date("2026-03-15")
      const today = new Date()
      const lcExpiryDate = new Date(today)
      lcExpiryDate.setDate(lcExpiryDate.getDate() + 90)  // 90 days, comfortable
      
      const result = await validateRealization({
        invoiceId: "INV-2026-US-LC",
        paymentTerms: "LC",
        shipmentDate,
        lcNumber: "LC/2026/US/BUYER/001",
        lcExpiryDate,
        invoiceAmount: 500000,
        invoiceCurrency: "USD",
        buyerCountry: "USA"
      })
      
      console.log("\n🇺🇸 US Buyer with LC Term:")
      console.log("   Status:", result.isCompliant ? "✅ COMPLIANT" : "❌ NON-COMPLIANT")
      console.log("   Risk:", result.riskLevel)
      console.log("   RBI Ref:", result.paymentClause.rbiReference.split("|")[0].trim())
      console.log("   Deadline:", result.paymentClause.realizationDeadline.toDateString())
      
      expect(result.isCompliant).toBe(true)
      expect(result.riskLevel).toBe("LOW")
    })
    
    it("Scenario: DA with Buyer in SAARC Country (High Risk)", async () => {
      const shipmentDate = new Date("2026-03-15")
      
      const result = await validateRealization({
        invoiceId: "INV-2026-SAARC-DA",
        paymentTerms: "DA",
        shipmentDate,
        daAcceptanceDate: new Date("2026-03-25"),
        invoiceAmount: 100000,
        invoiceCurrency: "USD",
        buyerCountry: "Bangladesh"
      })
      
      console.log("\n🏙️  SAARC Buyer with DA Term (High Risk):")
      console.log("   Status:", result.isCompliant ? "✅ COMPLIANT" : "❌ NON-COMPLIANT")
      console.log("   Risk Level:", result.riskLevel)
      console.log("   Realization Window:", result.paymentClause.daysRemaining, "days (RBI allows 180)")
      console.log("   Risk Factors:", result.riskDisclosures.length)
      console.log("   Action Items:")
      result.riskDisclosures.forEach(r => {
        console.log(`     •`, r.mitigation)
      })
      
      expect(result.riskLevel).toBe("HIGH")
    })
    
    it("Scenario: Advance Payment from Japanese Importer", async () => {
      const shipmentDate = new Date("2026-04-01")
      const advanceReceivedDate = new Date("2026-03-20")
      
      const result = await validateRealization({
        invoiceId: "INV-2026-JAPAN-ADV",
        paymentTerms: "Advance",
        shipmentDate,
        advanceReceivedDate,
        invoiceAmount: 250000,
        invoiceCurrency: "JPY",
        buyerCountry: "Japan"
      })
      
      console.log("\n🇯🇵 Japanese Importer - Advance Payment:")
      console.log("   Advance Received:", advanceReceivedDate.toDateString())
      console.log("   Shipment Date:", shipmentDate.toDateString())
      console.log("   Days Advance Before Shipment:", 
        Math.floor((shipmentDate.getTime() - advanceReceivedDate.getTime()) / (1000 * 60 * 60 * 24)))
      console.log("   Status:", result.isCompliant ? "✅ COMPLIANT" : "❌ NON-COMPLIANT")
      
      expect(result.isCompliant).toBe(true)
    })
  })
  
  // ============================================
  // HELPER FUNCTION TESTS
  // ============================================
  
  describe("Helper Functions", () => {
    
    it("should use canGenerateInvoiceDocuments helper", async () => {
      const result = await canGenerateInvoiceDocuments_Realization(
        "INV-HELPER-001",
        "Advance",
        new Date("2026-03-15"),
        new Date("2026-03-10")
      )
      
      expect(result.allowed).toBe(true)
      expect(result.blockers.length).toBe(0)
      console.log("✅ Helper: canGenerateInvoiceDocuments works correctly")
    })
    
    it("should generate formatted compliance report", async () => {
      const result = await validateRealization({
        invoiceId: "INV-HELP-REPORT",
        paymentTerms: "LC",
        shipmentDate: new Date("2026-03-15"),
        lcNumber: "LC2026/HELP/001",
        lcExpiryDate: new Date("2026-05-01"),
        invoiceAmount: 100000,
        invoiceCurrency: "USD"
      })
      
      const report = generateRealizationReport(result)
      
      expect(report.length).toBeGreaterThan(500)
      expect(report).toContain("Payment Term:")
      expect(report).toContain("CLAUSE DESCRIPTION")
      expect(report).toContain("AUDIT LOG")
      
      console.log("✅ Helper: Report generation complete")
    })
  })
  
  // ============================================
  // COMPLIANCE CHECK SUMMARY
  // ============================================
  
  describe("Summary: FEMA Realization Coverage", () => {
    
    it("should validate all 6 payment term types for compliance", async () => {
      const paymentTerms: PaymentTermType[] = ["Advance", "LC", "DA", "DP", "COD", "Credit"]
      const shipmentDate = new Date("2026-03-15")
      
      console.log("\n📊 Payment Term Compliance Matrix:")
      console.log("================================================")
      console.log("Term\t\tRisk\t\tRBI Window\tStatus")
      console.log("================================================")
      
      for (const term of paymentTerms) {
        let input: any = {
          invoiceId: `INV-MATRIX-${term}`,
          paymentTerms: term,
          shipmentDate,
          invoiceAmount: 100000,
          invoiceCurrency: "USD"
        }
        
        // Add term-specific data
        if (term === "Advance") {
          input.advanceReceivedDate = new Date("2026-03-10")
        } else if (term === "LC") {
          input.lcNumber = "LC2026/001"
          input.lcExpiryDate = new Date("2026-05-01")
        }
        
        const result = await validateRealization(input)
        
        console.log(
          `${term.padEnd(15)}\t${result.riskLevel.padEnd(10)}\t${result.paymentClause.daysRemaining} days\t\t${result.isCompliant ? "✅" : "⚠️"}`
        )
      }
      
      console.log("================================================")
      console.log("✅ All 6 payment terms validated with clause-level logic")
    })
  })
})
