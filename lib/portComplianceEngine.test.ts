/**
 * PORT COMPLIANCE ENGINE TEST SUITE
 * 
 * 12 Comprehensive Tests:
 * - Port consistency (3 tests)
 * - AD code requirement (2 tests)
 * - AD code registration (3 tests)
 * - Port code validity (2 tests)
 * - Integration scenarios (2 tests)
 * 
 * Ready to run with: npm run test lib/portComplianceEngine.test.ts
 */

import { describe, it, expect, beforeAll } from "vitest"
import {
  validatePortCompliance,
  canGenerateInvoiceDocuments_PortCompliance,
  generatePortComplianceReport,
  registerExporterADMapping,
  getExporterADMappings,
  type PortComplianceInput
} from "./portComplianceEngine"

describe("Engine 5: Port Compliance Engine", () => {
  
  const testExporterId = "exporter-test-001"
  
  beforeAll(async () => {
    // Setup: Register test AD mappings for known port
    await registerExporterADMapping(testExporterId, "EPCG", "INMAA", true)
    await registerExporterADMapping(testExporterId, "DTA", "INMAA", true)
    await registerExporterADMapping(testExporterId, "EPCG", "INMAB1", true)
  })
  
  // ============================================
  // RULE 1: PORT CONSISTENCY (3 tests)
  // ============================================
  
  describe("Rule 1: Port Consistency Check", () => {
    
    it("should pass when invoice and shipping bill ports match", async () => {
      const result = await validatePortCompliance({
        invoiceId: "INV-123",
        exporterId: testExporterId,
        invoicePortOfLoading: "INMAA",
        shippingBillPortOfLoading: "INMAA",
        adCode: "EPCG",
        modeOfTransport: "Sea"
      })
      
      expect(result.portConsistent).toBe(true)
      expect(result.isValid).toBe(true)
      console.log("✅ Test 1a: Ports match (INMAA)")
    })
    
    it("should fail when ports don't match", async () => {
      const result = await validatePortCompliance({
        invoiceId: "INV-124",
        exporterId: testExporterId,
        invoicePortOfLoading: "INMAA",
        shippingBillPortOfLoading: "INMAB1",  // Different
        adCode: "EPCG",
        modeOfTransport: "Sea"
      })
      
      expect(result.portConsistent).toBe(false)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === "PORT_MISMATCH")).toBe(true)
      console.log("✅ Test 1b: Port mismatch CAUGHT (INMAA vs INMAB1)")
    })
    
    it("should handle uppercase/lowercase normalization", async () => {
      const result1 = await validatePortCompliance({
        invoiceId: "INV-125",
        exporterId: testExporterId,
        invoicePortOfLoading: "inmaa",  // lowercase
        shippingBillPortOfLoading: "INMAA",  // uppercase
        adCode: "EPCG",
        modeOfTransport: "Sea"
      })
      
      const result2 = await validatePortCompliance({
        invoiceId: "INV-126",
        exporterId: testExporterId,
        invoicePortOfLoading: "InMaA",  // mixed case
        shippingBillPortOfLoading: "inmaa",
        adCode: "EPCG",
        modeOfTransport: "Sea"
      })
      
      expect(result1.portConsistent).toBe(true)
      expect(result2.portConsistent).toBe(true)
      console.log("✅ Test 1c: Case normalization works correctly")
    })
  })
  
  // ============================================
  // RULE 2: AD CODE REQUIREMENT (2 tests)
  // ============================================
  
  describe("Rule 2: AD Code Requirement Check", () => {
    
    it("should require AD code for major sea ports (INMAA)", async () => {
      const result = await validatePortCompliance({
        invoiceId: "INV-127",
        exporterId: testExporterId,
        invoicePortOfLoading: "INMAA",
        shippingBillPortOfLoading: "INMAA",
        // NO adCode provided
        modeOfTransport: "Sea"
      })
      
      expect(result.adCodeValid).toBe(false)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === "AD_CODE_REQUIRED")).toBe(true)
      console.log("✅ Test 2a: AD Code REQUIRED for INMAA (sea port)")
    })
    
    it("should NOT require AD code for air ports", async () => {
      const result = await validatePortCompliance({
        invoiceId: "INV-128",
        exporterId: testExporterId,
        invoicePortOfLoading: "INMUL",  // Delhi Airport
        shippingBillPortOfLoading: "INMUL",
        // NO adCode provided - should be OK
        modeOfTransport: "Air"
      })
      
      expect(result.adCodeValid).toBe(true)
      expect(result.errors.some(e => e.code === "AD_CODE_REQUIRED")).toBe(false)
      console.log("✅ Test 2b: AD Code NOT required for air ports")
    })
  })
  
  // ============================================
  // RULE 3: AD CODE REGISTRATION (3 tests)
  // ============================================
  
  describe("Rule 3: AD Code Registration Check", () => {
    
    it("should pass when AD code is registered for exporter at port", async () => {
      const result = await validatePortCompliance({
        invoiceId: "INV-129",
        exporterId: testExporterId,
        invoicePortOfLoading: "INMAA",
        shippingBillPortOfLoading: "INMAA",
        adCode: "EPCG",  // Registered in beforeAll
        modeOfTransport: "Sea"
      })
      
      expect(result.adCodeRegistered).toBe(true)
      expect(result.isValid).toBe(true)
      console.log("✅ Test 3a: AD Code EPCG verified for exporter at INMAA")
    })
    
    it("should fail when AD code is NOT registered for exporter", async () => {
      const result = await validatePortCompliance({
        invoiceId: "INV-130",
        exporterId: testExporterId,
        invoicePortOfLoading: "INMAA",
        shippingBillPortOfLoading: "INMAA",
        adCode: "SEZ",  // NOT registered for this exporter
        modeOfTransport: "Sea"
      })
      
      expect(result.adCodeRegistered).toBe(false)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === "AD_CODE_NOT_REGISTERED")).toBe(true)
      console.log("✅ Test 3b: Unregistered AD Code SEZ BLOCKED")
    })
    
    it("should allow exporter with multiple AD codes at same port", async () => {
      // EPCG and DTA are both registered for INMAA
      const resultEPCG = await validatePortCompliance({
        invoiceId: "INV-131",
        exporterId: testExporterId,
        invoicePortOfLoading: "INMAA",
        shippingBillPortOfLoading: "INMAA",
        adCode: "EPCG",
        modeOfTransport: "Sea"
      })
      
      const resultDTA = await validatePortCompliance({
        invoiceId: "INV-132",
        exporterId: testExporterId,
        invoicePortOfLoading: "INMAA",
        shippingBillPortOfLoading: "INMAA",
        adCode: "DTA",
        modeOfTransport: "Sea"
      })
      
      expect(resultEPCG.isValid).toBe(true)
      expect(resultDTA.isValid).toBe(true)
      console.log("✅ Test 3c: Multiple AD codes allowed (EPCG & DTA)")
    })
  })
  
  // ============================================
  // RULE 4: PORT CODE VALIDITY (2 tests)
  // ============================================
  
  describe("Rule 4: Port Code Validity Check", () => {
    
    it("should accept valid ICEGATE port codes", async () => {
      const validPorts = ["INMAA", "INMAB", "INMAE", "INMUL", "INBOM"]
      
      for (const port of validPorts) {
        const result = await validatePortCompliance({
          invoiceId: `INV-${port}`,
          exporterId: testExporterId,
          invoicePortOfLoading: port,
          shippingBillPortOfLoading: port,
          modeOfTransport: "Sea"
        })
        
        expect(result.portCodeValid).toBe(true)
      }
      
      console.log(`✅ Test 4a: All ${validPorts.length} valid ports accepted`)
    })
    
    it("should reject invalid ICEGATE port codes", async () => {
      const result = await validatePortCompliance({
        invoiceId: "INV-INVALID",
        exporterId: testExporterId,
        invoicePortOfLoading: "XXXXX",  // Invalid code
        shippingBillPortOfLoading: "XXXXX",
        modeOfTransport: "Sea"
      })
      
      expect(result.portCodeValid).toBe(false)
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.code === "INVALID_PORT_CODE")).toBe(true)
      console.log("✅ Test 4b: Invalid port code XXXXX BLOCKED")
    })
  })
  
  // ============================================
  // INTEGRATION TESTS
  // ============================================
  
  describe("Integration Tests", () => {
    
    it("should validate complete valid export scenario", async () => {
      const result = await validatePortCompliance({
        invoiceId: "INV-COMPLETE",
        exporterId: testExporterId,
        invoicePortOfLoading: "INMAA",
        shippingBillPortOfLoading: "INMAA",
        adCode: "EPCG",
        modeOfTransport: "Sea"
      })
      
      console.log("\n✅ Complete Valid Scenario:")
      console.log(`   Port: INMAA (valid)`)
      console.log(`   Ports match: ✅`)
      console.log(`   AD Code required: Yes`)
      console.log(`   AD Code provided: EPCG`)
      console.log(`   AD Code registered: ✅`)
      
      expect(result.isValid).toBe(true)
      expect(result.errors.length).toBe(0)
    })
    
    it("should catch multi-rule violations", async () => {
      const result = await validatePortCompliance({
        invoiceId: "INV-VIOLATIONS",
        exporterId: "unknown-exporter",
        invoicePortOfLoading: "INMAA",
        shippingBillPortOfLoading: "INMAB1",  // Mismatch
        adCode: "UNKNOWN",  // Not registered
        modeOfTransport: "Sea"
      })
      
      console.log("\n❌ Multi-Violation Scenario:")
      console.log(`   ❌ Ports don't match`)
      console.log(`   ❌ AD Code not registered`)
      
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)
    })
    
    it("should generate compliance report", async () => {
      const result = await validatePortCompliance({
        invoiceId: "INV-REPORT",
        exporterId: testExporterId,
        invoicePortOfLoading: "INMAA",
        shippingBillPortOfLoading: "INMAA",
        adCode: "EPCG",
        modeOfTransport: "Sea"
      })
      
      const report = generatePortComplianceReport(result)
      
      expect(report).toContain("PORT COMPLIANCE VALIDATION REPORT")
      expect(report).toContain("INMAA")
      expect(report).toContain("AUDIT LOG")
      console.log("✅ Compliance report generated successfully")
    })
  })
  
  // ============================================
  // REAL-WORLD SCENARIOS
  // ============================================
  
  describe("Real-World Port Compliance Scenarios", () => {
    
    it("Scenario: Mumbai Port Export with EPCG License", async () => {
      const result = await validatePortCompliance({
        invoiceId: "INV-2026-MUMBAI-EPCG",
        exporterId: testExporterId,
        invoicePortOfLoading: "INMAA",
        shippingBillPortOfLoading: "INMAA",
        adCode: "EPCG",
        modeOfTransport: "Sea"
      })
      
      console.log("\n🚢 Mumbai Port (EPCG) Scenario:")
      console.log("   Port: INMAA (Jawaharlal Nehru Port)")
      console.log("   AD Code: EPCG")
      console.log("   Status:", result.isValid ? "✅ Valid" : "❌ Invalid")
      
      expect(result.isValid).toBe(true)
      console.log("✅ Scenario: Mumbai EPCG export verified")
    })
    
    it("Scenario: Air Export from Delhi (no AD code needed)", async () => {
      const result = await validatePortCompliance({
        invoiceId: "INV-2026-DELHI-EXPORT",
        exporterId: testExporterId,
        invoicePortOfLoading: "INMUL",
        shippingBillPortOfLoading: "INMUL",
        // No AD code needed for air
        modeOfTransport: "Air"
      })
      
      console.log("\n✈️  Delhi Airport Scenario:")
      console.log("   Port: INMUL (IGI Airport)")
      console.log("   AD Code Required: No")
      console.log("   Status:", result.isValid ? "✅ Valid" : "❌ Invalid")
      
      expect(result.isValid).toBe(true)
      console.log("✅ Scenario: Delhi air export verified")
    })
    
    it("Scenario: Paradip Port Export with Different AD Code per port", async () => {
      const result1 = await validatePortCompliance({
        invoiceId: "INV-2026-PARADIP-1",
        exporterId: testExporterId,
        invoicePortOfLoading: "INMAB1",
        shippingBillPortOfLoading: "INMAB1",
        adCode: "EPCG",  // EPCG registered for INMAB1
        modeOfTransport: "Sea"
      })
      
      console.log("\n⛴️  Paradip Port Scenario:")
      console.log("   Port: INMAB1 (Paradip - Terminal 2)")
      console.log("   AD Code: EPCG")
      console.log("   Status:", result1.isValid ? "✅ Valid" : "❌ Invalid")
      
      expect(result1.isValid).toBe(true)
      console.log("✅ Scenario: Paradip export verified")
    })
  })
  
  // ============================================
  // HELPER FUNCTION TESTS
  // ============================================
  
  describe("Helper Functions", () => {
    
    it("should use canGenerateInvoiceDocuments helper", async () => {
      const result = await canGenerateInvoiceDocuments_PortCompliance(
        "INV-HELPER",
        testExporterId,
        "INMAA",
        "INMAA",
        "EPCG",
        "Sea"
      )
      
      expect(result.allowed).toBe(true)
      expect(result.blockers.length).toBe(0)
      console.log("✅ Helper: canGenerateInvoiceDocuments works correctly")
    })
    
    it("should manage AD code mappings", async () => {
      // Register a new mapping
      const registerResult = await registerExporterADMapping(
        "test-exporter-2",
        "DTA",
        "INMAE",
        true
      )
      
      expect(registerResult.success).toBe(true)
      
      // Retrieve mappings
      const mappings = await getExporterADMappings("test-exporter-2")
      
      expect(mappings.length).toBeGreaterThan(0)
      expect(mappings.some(m => m.adCode === "DTA" && m.portCode === "INMAE")).toBe(true)
      
      console.log("✅ Helper: AD mapping management works correctly")
    })
  })
  
  // ============================================
  // ERROR SCENARIOS
  // ============================================
  
  describe("Error Scenarios", () => {
    
    it("should handle missing port information", async () => {
      const result = await validatePortCompliance({
        invoiceId: "INV-EMPTY",
        exporterId: testExporterId,
        invoicePortOfLoading: "",
        shippingBillPortOfLoading: "",
        modeOfTransport: "Sea"
      })
      
      expect(result.isValid).toBe(false)
      expect(result.portConsistent).toBe(false)
      console.log("✅ Error scenario: Missing port info handled")
    })
    
    it("should handle invalid port with AD requirement", async () => {
      const result = await validatePortCompliance({
        invoiceId: "INV-BADPORT",
        exporterId: testExporterId,
        invoicePortOfLoading: "NOTAPORT",
        shippingBillPortOfLoading: "NOTAPORT",
        adCode: "EPCG",
        modeOfTransport: "Sea"
      })
      
      expect(result.isValid).toBe(false)
      expect(result.portCodeValid).toBe(false)
      console.log("✅ Error scenario: Invalid port code caught")
    })
  })
  
  // ============================================
  // PORT CATEGORIZATION TESTS
  // ============================================
  
  describe("Port Categorization", () => {
    
    it("should correctly identify sea ports requiring AD codes", async () => {
      const seaPorts = ["INMAA", "INMAB1", "INMAE", "INMAR1"]
      
      for (const port of seaPorts) {
        const result = await validatePortCompliance({
          invoiceId: `INV-SEA-${port}`,
          exporterId: testExporterId,
          invoicePortOfLoading: port,
          shippingBillPortOfLoading: port,
          // Try without AD code
          modeOfTransport: "Sea"
        })
        
        // Should fail because AD code required for sea ports
        expect(result.errors.some(e => e.code === "AD_CODE_REQUIRED")).toBe(true)
      }
      
      console.log(`✅ All ${seaPorts.length} sea ports correctly require AD codes`)
    })
    
    it("should correctly identify air ports NOT requiring AD codes", async () => {
      const airPorts = ["INMUL", "INBOM", "INMAA12"]
      
      for (const port of airPorts) {
        const result = await validatePortCompliance({
          invoiceId: `INV-AIR-${port}`,
          exporterId: testExporterId,
          invoicePortOfLoading: port,
          shippingBillPortOfLoading: port,
          // NO AD code provided
          modeOfTransport: "Air"
        })
        
        // Should pass because air ports don't require AD
        expect(result.errors.some(e => e.code === "AD_CODE_REQUIRED")).toBe(false)
      }
      
      console.log(`✅ All ${airPorts.length} air ports correctly don't require AD codes`)
    })
  })
})
