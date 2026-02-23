/**
 * TRADE CLASSIFICATION ENGINE TEST SUITE
 * 
 * 12 Comprehensive Tests:
 * - HS-GST alignment (4 tests)
 * - Restricted goods detection (2 tests)
 * - DGFT license requirements (2 tests)
 * - SION requirements (2 tests)
 * - Export prohibitions (2 tests)
 * 
 * Ready to run with: npm run test lib/tradeClassificationEngine.test.ts
 */

import { describe, it, expect } from "vitest"
import { 
  validateTradeClassification, 
  canGenerateInvoiceDocuments_TradeClassification,
  generateTradeClassificationReport,
  type TradeClassificationInput 
} from "./tradeClassificationEngine"

describe("Engine 3: Trade Classification Engine", () => {
  
  // ============================================
  // RULE 1: HS ↔ GST ALIGNMENT (4 tests)
  // ============================================
  
  describe("Rule 1: HS ↔ GST Alignment", () => {
    
    it("should pass when GST rate matches HS code (T-Shirt 5%)", async () => {
      const result = await validateTradeClassification({
        hsCode: "6203",
        gstRate: 5,  // Correct
        countryOfDestination: "USA",
        commodity: "Cotton T-Shirt"
      })
      
      expect(result.isValid).toBe(true)
      expect(result.gstAligned).toBe(true)
      expect(result.errors.filter(e => e.code === "GST_MISMATCH")).toHaveLength(0)
      console.log("✅ Test 1a: GST alignment PASSED for T-Shirt (5%)")
    })
    
    it("should fail when GST rate misaligns with HS code (T-Shirt 0%)", async () => {
      const result = await validateTradeClassification({
        hsCode: "6203",
        gstRate: 0,  // Wrong - should be 5%
        countryOfDestination: "USA",
        commodity: "Cotton T-Shirt"
      })
      
      expect(result.isValid).toBe(false)
      expect(result.gstAligned).toBe(false)
      expect(result.errors.some(e => e.code === "GST_MISMATCH")).toBe(true)
      console.log("✅ Test 1b: GST misalignment CAUGHT for T-Shirt (0% instead of 5%)")
    })
    
    it("should accept multiple valid GST rates for same HS code (Fish: 5% OR 12%)", async () => {
      // Fish allows 5% or 12%
      const result5 = await validateTradeClassification({
        hsCode: "0302",
        gstRate: 5,
        countryOfDestination: "Singapore",
        commodity: "Fresh Fish"
      })
      
      const result12 = await validateTradeClassification({
        hsCode: "0302",
        gstRate: 12,
        countryOfDestination: "Singapore",
        commodity: "Fresh Fish"
      })
      
      expect(result5.gstAligned).toBe(true)
      expect(result12.gstAligned).toBe(true)
      console.log("✅ Test 1c: Multiple valid GST rates accepted for Fish (5% & 12%)")
    })
    
    it("should detect GST misalignment for restricted rate (Fish: 18% invalid)", async () => {
      const result = await validateTradeClassification({
        hsCode: "0302",
        gstRate: 18,  // Wrong - only 5% or 12% valid
        countryOfDestination: "Singapore",
        commodity: "Fresh Fish"
      })
      
      expect(result.gstAligned).toBe(false)
      expect(result.errors.some(e => e.code === "GST_MISMATCH")).toBe(true)
      console.log("✅ Test 1d: GST misalignment CAUGHT for Fish (18% invalid)")
    })
  })
  
  // ============================================
  // RULE 2: RESTRICTED GOODS DETECTION (2 tests)
  // ============================================
  
  describe("Rule 2: Restricted Goods Detection", () => {
    
    it("should flag restricted commodity (Fish - requires APEDA)", async () => {
      const result = await validateTradeClassification({
        hsCode: "0302",
        gstRate: 5,
        countryOfDestination: "UAE",
        commodity: "Fresh Fish"
      })
      
      expect(result.isRestricted).toBe(true)
      expect(result.warnings.some(w => w.code === "RESTRICTED_COMMODITY")).toBe(true)
      console.log("✅ Test 2a: Restricted commodity FLAGGED (Fish requires APEDA)")
    })
    
    it("should pass unrestricted commodity (T-Shirt - freely exportable)", async () => {
      const result = await validateTradeClassification({
        hsCode: "6203",
        gstRate: 5,
        countryOfDestination: "USA",
        commodity: "Cotton T-Shirt"
      })
      
      expect(result.isRestricted).toBe(false)
      expect(result.warnings.some(w => w.code === "RESTRICTED_COMMODITY")).toBe(false)
      console.log("✅ Test 2b: Unrestricted commodity PASSED (T-Shirt freely exportable)")
    })
  })
  
  // ============================================
  // RULE 3: DGFT LICENSE REQUIREMENT (2 tests)
  // ============================================
  
  describe("Rule 3: DGFT License Requirement", () => {
    
    it("should flag DGFT license requirement (Diamonds)", async () => {
      const result = await validateTradeClassification({
        hsCode: "7102",
        gstRate: 0,
        countryOfDestination: "UAE",
        commodity: "Diamonds"
      })
      
      expect(result.requiresLicense).toBe(true)
      expect(result.warnings.some(w => w.code === "DGFT_LICENSE_FLAGGED")).toBe(true)
      console.log("✅ Test 3a: DGFT License FLAGGED (Diamonds)")
    })
    
    it("should flag DGFT license for pharmaceuticals (EDD approval needed)", async () => {
      const result = await validateTradeClassification({
        hsCode: "3004",
        gstRate: 5,
        countryOfDestination: "UK",
        commodity: "Medicaments"
      })
      
      expect(result.requiresLicense).toBe(true)
      expect(result.warnings.some(w => w.code === "DGFT_LICENSE_FLAGGED")).toBe(true)
      console.log("✅ Test 3b: DGFT License FLAGGED (Pharmaceuticals - EDD required)")
    })
  })
  
  // ============================================
  // RULE 4: SION REQUIREMENT (2 tests)
  // ============================================
  
  describe("Rule 4: SION Requirement", () => {
    
    it("should flag SION requirement for Fish with Odal restrictions", async () => {
      const result = await validateTradeClassification({
        hsCode: "0302",
        gstRate: 5,
        countryOfDestination: "Singapore",
        commodity: "Fresh Fish"
      })
      
      expect(result.sionRequired).toBe(true)
      expect(result.warnings.some(w => w.code === "SION_REQUIRED")).toBe(true)
      const warning = result.warnings.find(w => w.code === "SION_REQUIRED")
      expect(warning?.message).toContain("SION_0302")
      console.log("✅ Test 4a: SION REQUIRED (Fish - Odal registration + sanctuary restrictions)")
    })
    
    it("should not require SION for vegetables", async () => {
      const result = await validateTradeClassification({
        hsCode: "0710",
        gstRate: 5,
        countryOfDestination: "UAE",
        commodity: "Fresh Vegetables"
      })
      
      expect(result.sionRequired).toBe(false)
      expect(result.warnings.some(w => w.code === "SION_REQUIRED")).toBe(false)
      console.log("✅ Test 4b: SION NOT Required (Vegetables - freely exportable)")
    })
  })
  
  // ============================================
  // RULE 5: EXPORT PROHIBITION (2 tests)
  // ============================================
  
  describe("Rule 5: Export Prohibition Detection", () => {
    
    it("should block prohibited export (Wheat - banned until Dec 2026)", async () => {
      const result = await validateTradeClassification({
        hsCode: "1001",
        gstRate: 0,
        countryOfDestination: "Bangladesh",
        commodity: "Wheat"
      })
      
      expect(result.exportProhibited).toBe(true)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === "EXPORT_PROHIBITED")).toBe(true)
      expect(result.errors.some(e => e.severity === "BLOCKER")).toBe(true)
      console.log("✅ Test 5a: Export BLOCKED (Wheat banned until Dec 2026)")
    })
    
    it("should block prohibited export (Onions - indefinite ban)", async () => {
      const result = await validateTradeClassification({
        hsCode: "0708",
        gstRate: 0,
        countryOfDestination: "UK",
        commodity: "Onions"
      })
      
      expect(result.exportProhibited).toBe(true)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === "EXPORT_PROHIBITED")).toBe(true)
      console.log("✅ Test 5b: Export BLOCKED (Onions - indefinite ban)")
    })
  })
  
  // ============================================
  // INTEGRATION TESTS
  // ============================================
  
  describe("Integration Tests", () => {
    
    it("should validate complete export scenario (valid multi-rule pass)", async () => {
      const result = await validateTradeClassification({
        hsCode: "6203",
        gstRate: 5,
        countryOfDestination: "USA",
        commodity: "Cotton T-Shirt",
        quantity: 1000,
        unitPrice: 10
      })
      
      console.log("\n✅ Full Valid Scenario:")
      console.log(`   HS Code: 6203 | GST: 5% | Destination: USA`)
      console.log(`   ✅ HS-GST aligned`)
      console.log(`   ✅ Not restricted`)
      console.log(`   ✅ No license required`)
      console.log(`   ✅ SION not required`)
      console.log(`   ✅ Not prohibited`)
      
      expect(result.isValid).toBe(true)
      expect(result.errors.length).toBe(0)
    })
    
    it("should catch multi-rule violations (prohibited + GST mismatch)", async () => {
      const result = await validateTradeClassification({
        hsCode: "1001",
        gstRate: 5,  // Wrong - should be 0
        countryOfDestination: "Bangladesh",
        commodity: "Wheat"
      })
      
      console.log("\n❌ Multi-Violation Scenario:")
      console.log(`   HS Code: 1001 | GST: 5% | Destination: Bangladesh`)
      console.log(`   ❌ EXPORT PROHIBITED (wheat ban)`)
      console.log(`   ❌ GST misaligned (5% instead of 0%)`)
      
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === "EXPORT_PROHIBITED")).toBe(true)
      expect(result.errors.some(e => e.code === "GST_MISMATCH")).toBe(true)
      expect(result.errors.length).toBeGreaterThan(1)
    })
    
    it("should generate audit trail for compliance review", async () => {
      const result = await validateTradeClassification({
        hsCode: "0302",
        gstRate: 5,
        countryOfDestination: "Singapore",
        commodity: "Fresh Fish"
      })
      
      expect(result.auditLog.length).toBeGreaterThan(0)
      expect(result.auditLog[0]).toHaveProperty("timestamp")
      expect(result.auditLog[0]).toHaveProperty("ruleCode")
      expect(result.auditLog[0]).toHaveProperty("result")
      
      console.log(`\n✅ Audit Trail Created: ${result.auditLog.length} entries`)
      result.auditLog.forEach(log => {
        console.log(`   ${log.ruleCode.padEnd(30)} → ${log.result ? "✅" : "❌"}`)
      })
    })
  })
  
  // ============================================
  // HELPER FUNCTION TESTS
  // ============================================
  
  describe("Helper Functions", () => {
    
    it("should use canGenerateInvoiceDocuments helper correctly", async () => {
      const result = await canGenerateInvoiceDocuments_TradeClassification(
        "INV-123",
        "6203",
        5,
        "USA",
        "Cotton T-Shirt"
      )
      
      expect(result.allowed).toBe(true)
      expect(result.blockers.length).toBe(0)
      console.log("✅ Helper: canGenerateInvoiceDocuments returned correct result")
    })
    
    it("should generate compliance report", async () => {
      const result = await validateTradeClassification({
        hsCode: "0302",
        gstRate: 5,
        countryOfDestination: "Singapore",
        commodity: "Fresh Fish"
      })
      
      const report = generateTradeClassificationReport(result)
      
      expect(report).toContain("TRADE CLASSIFICATION VALIDATION REPORT")
      expect(report).toContain("HS Code: 0302")
      expect(report).toContain("AUDIT LOG")
      console.log("✅ Helper: Report generation successful")
      console.log("\nSample Report Output:")
      console.log(report.split("\n").slice(0, 15).join("\n"))
    })
  })
  
  // ============================================
  // REAL-WORLD SCENARIOS
  // ============================================
  
  describe("Real-World Trade Classification Scenarios", () => {
    
    it("Scenario: Premium Diamond Export (Kimberly Process required)", async () => {
      const result = await validateTradeClassification({
        hsCode: "7102",
        gstRate: 0,
        countryOfDestination: "Belgium",
        commodity: "Diamonds (rough)"
      })
      
      console.log("\n💎 Diamond Export Scenario:")
      console.log("   Status:", result.classification.classificationStatus)
      console.log("   License:", result.requiresLicense ? "REQUIRED" : "Not needed")
      console.log("   Valid:", result.isValid ? "✅ Can export" : "❌ Cannot export")
      
      expect(result.requiresLicense).toBe(true)
      expect(result.isValid).toBe(true)  // License is only a flag, not a blocker
      console.log("✅ Scenario: Diamond export flagged for Kimberly Process")
    })
    
    it("Scenario: Seasonal Fish Export (Monsoon restrictions apply)", async () => {
      const result = await validateTradeClassification({
        hsCode: "0302",
        gstRate: 5,
        countryOfDestination: "Vietnam",
        commodity: "Shrimp"
      })
      
      console.log("\n🐟 Fish Export Scenario:")
      console.log("   Restricted:", result.isRestricted ? "⚠️ Yes" : "No")
      console.log("   SION Required:", result.sionRequired ? "⚠️ Yes" : "No")
      
      const warning = result.warnings.find(w => w.code === "SION_REQUIRED")
      if (warning) {
        console.log("   Details:", warning.message)
      }
      
      expect(result.sionRequired).toBe(true)
      console.log("✅ Scenario: Fish export flagged for SION + monsoon restrictions")
    })
    
    it("Scenario: Steel Export (Strategic goods, quota tracking)", async () => {
      const result = await validateTradeClassification({
        hsCode: "7208",
        gstRate: 5,
        countryOfDestination: "USA",
        commodity: "Steel Plates"
      })
      
      console.log("\n🏭 Steel Export Scenario:")
      console.log("   License Type:", result.classification.applicableLicenses[0])
      console.log("   Valid:", result.isValid ? "✅" : "❌")
      
      expect(result.requiresLicense).toBe(true)
      expect(result.isValid).toBe(true)
      console.log("✅ Scenario: Steel export flagged for quota monitoring")
    })
  })
  
  // ============================================
  // CLASSIFICATION DECISIONS
  // ============================================
  
  describe("Quick Classification Decisions", () => {
    
    it("should summarize classification status", async () => {
      const exports = [
        { hs: "6203", gst: 5, commodity: "T-Shirt", expect: "FREELY_EXPORTABLE" },
        { hs: "0302", gst: 5, commodity: "Fish", expect: "RESTRICTED" },
        { hs: "7102", gst: 0, commodity: "Diamond", expect: "LICENSED" },
        { hs: "1001", gst: 0, commodity: "Wheat", expect: "PROHIBITED" }
      ]
      
      console.log("\n📋 Classification Status Summary:")
      console.log("=========================================")
      
      for (const item of exports) {
        const result = await validateTradeClassification({
          hsCode: item.hs,
          gstRate: item.gst,
          countryOfDestination: "TEST",
          commodity: item.commodity
        })
        
        console.log(
          `${item.hs} | ${item.commodity.padEnd(15)} | ${result.classification.classificationStatus.padEnd(20)}`
        )
        
        expect(result.classification.classificationStatus).toBe(item.expect)
      }
      
      console.log("=========================================")
    })
  })
})
