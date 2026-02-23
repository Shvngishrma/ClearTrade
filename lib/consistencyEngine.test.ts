/**
 * CROSS-DOCUMENT CONSISTENCY ENGINE TEST SUITE
 * 
 * THE MOAT: 12 Tests catching document mismatches before PDF generation
 * 
 * 12 Tests:
 * - Value match (2 tests)
 * - Currency match (1 test)
 * - Incoterm logic (2 tests)
 * - Freight logic (1 test)
 * - Port alignment (2 tests)
 * - Quantity match (1 test)
 * - Weight alignment (1 test)
 * - Integration scenarios (2 tests)
 * 
 * Ready to run with: npm run test lib/consistencyEngine.test.ts
 */

import { describe, it, expect } from "vitest"
import {
  validateDocumentConsistency,
  canGeneratePDF,
  generateConsistencyReport,
  type DocumentSet
} from "./consistencyEngine"

describe("Engine 7: Cross-Document Consistency Engine (THE MOAT)", () => {
  
  // Helper: Create valid document set
  const createValidDocumentSet = (): DocumentSet => ({
    invoice: {
      id: "INV-001",
      invoiceNumber: "INV-2026-001",
      totalValue: 100000,
      currency: "USD",
      incoterm: "FOB",
      freight: 0,
      insurance: 2000,
      portOfLoading: "INMAA",
      portOfDischarge: "JNPT",
      items: [
        { hsCode: "6203", quantity: 100, unitPrice: 500 },
        { hsCode: "6204", quantity: 100, unitPrice: 500 }
      ]
    },
    packingList: {
      id: "PL-001",
      totalBoxes: 20,
      netWeight: 1000,
      grossWeight: 1150,
      items: [
        { hsCode: "6203", quantity: 100, packageType: "Carton" },
        { hsCode: "6204", quantity: 100, packageType: "Carton" }
      ]
    },
    shippingBill: {
      id: "SB-001",
      portOfLoading: "INMAA",
      portOfDischarge: "JNPT",
      cargoType: "General"
    },
    insurance: {
      id: "INS-001",
      insuredValue: 107000, // 100000 + 5000 freight + 2000 insurance
      policyNumber: "POL-2026-001"
    }
  })
  
  // ============================================
  // RULE 1: VALUE MATCH (2 tests)
  // ============================================
  
  describe("Rule 1: Value Match", () => {
    
    it("should pass when invoice and insurance values are consistent", async () => {
      const docs = createValidDocumentSet()
      
      const result = await validateDocumentConsistency(docs)
      
      expect(result.valueConsistent).toBe(true)
      expect(result.errors.filter(e => e.code === "VALUE_MISMATCH")).toHaveLength(0)
      console.log("✅ Test 1a: Values match (Invoice 100k, Insurance 107k - within 5-15% buffer)")
    })
    
    it("should fail when insurance value is outside acceptable range", async () => {
      const docs = createValidDocumentSet()
      docs.insurance!.insuredValue = 50000 // Way too low
      
      const result = await validateDocumentConsistency(docs)
      
      expect(result.valueConsistent).toBe(false)
      expect(result.errors.some(e => e.code === "VALUE_MISMATCH")).toBe(true)
      expect(result.errors[0]?.severity).toBe("FATAL")
      console.log("✅ Test 1b: Insurance value mismatch CAUGHT (50k vs 100k invoice) - BLOCKS PDF")
    })
  })
  
  // ============================================
  // RULE 2: CURRENCY MATCH (1 test)
  // ============================================
  
  describe("Rule 2: Currency Match", () => {
    
    it("should validate single currency across documents", async () => {
      const docs = createValidDocumentSet()
      
      const result = await validateDocumentConsistency(docs)
      
      expect(result.currencyConsistent).toBe(true)
      expect(result.consistency.currencyMatch).toBe("USD")
      console.log("✅ Test 2a: Currency consistent (USD across all documents)")
    })
  })
  
  // ============================================
  // RULE 3: INCOTERM LOGIC (2 tests)
  // ============================================
  
  describe("Rule 3: Incoterm Logic", () => {
    
    it("should validate FOB incoterm with correct port requirements", async () => {
      const docs = createValidDocumentSet()
      docs.invoice.incoterm = "FOB"
      docs.invoice.portOfLoading = "INMAA"
      docs.invoice.portOfDischarge = "" // FOB doesn't require discharge port
      
      const result = await validateDocumentConsistency(docs)
      
      expect(result.incotermConsistent).toBe(true)
      console.log("✅ Test 3a: FOB incoterm with loading port only - VALID")
    })
    
    it("should fail when incoterm port requirements not met", async () => {
      const docs = createValidDocumentSet()
      docs.invoice.incoterm = "CIF"
      docs.invoice.portOfLoading = "INMAA"
      docs.invoice.portOfDischarge = "" // CIF requires both ports
      
      const result = await validateDocumentConsistency(docs)
      
      expect(result.incotermConsistent).toBe(false)
      expect(result.errors.some(e => e.code === "INCOTERM_LOGIC_FAIL")).toBe(true)
      console.log("✅ Test 3b: CIF without discharge port - INVALID, BLOCKS PDF")
    })
  })
  
  // ============================================
  // RULE 4: FREIGHT LOGIC (1 test)
  // ============================================
  
  describe("Rule 4: Freight Logic", () => {
    
    it("should validate freight allocation within reasonable bounds", async () => {
      const docs = createValidDocumentSet()
      docs.invoice.incoterm = "CIF"
      docs.invoice.freight = 5000 // 5% of 100k value
      
      const result = await validateDocumentConsistency(docs)
      
      expect(result.freightLogicConsistent).toBe(true)
      console.log("✅ Test 4a: Freight 5% of invoice value - VALID")
    })
  })
  
  // ============================================
  // RULE 5: PORT ALIGNMENT (2 tests)
  // ============================================
  
  describe("Rule 5: Port Alignment", () => {
    
    it("should pass when invoice and shipping bill ports match", async () => {
      const docs = createValidDocumentSet()
      docs.invoice.portOfLoading = "INMAA"
      docs.shippingBill!.portOfLoading = "INMAA"
      
      const result = await validateDocumentConsistency(docs)
      
      expect(result.portConsistent).toBe(true)
      console.log("✅ Test 5a: Ports aligned across documents")
    })
    
    it("should fail when invoice and shipping bill ports don't match", async () => {
      const docs = createValidDocumentSet()
      docs.invoice.portOfLoading = "INMAA"
      docs.shippingBill!.portOfLoading = "INMAB1" // Different port!
      
      const result = await validateDocumentConsistency(docs)
      
      expect(result.portConsistent).toBe(false)
      expect(result.errors.some(e => e.code === "PORT_MISMATCH")).toBe(true)
      expect(result.errors[0]?.severity).toBe("FATAL")
      console.log("✅ Test 5b: Port mismatch CAUGHT (INMAA vs INMAB1) - BLOCKS PDF")
    })
  })
  
  // ============================================
  // RULE 6: QUANTITY MATCH (1 test)
  // ============================================
  
  describe("Rule 6: Quantity Match", () => {
    
    it("should detect quantity mismatch between invoice and packing list", async () => {
      const docs = createValidDocumentSet()
      docs.invoice.items[0].quantity = 100
      docs.packingList!.items[0].quantity = 95 // Mismatch!
      
      const result = await validateDocumentConsistency(docs)
      
      expect(result.quantityConsistent).toBe(false)
      expect(result.errors.some(e => e.code === "QUANTITY_MISMATCH")).toBe(true)
      console.log("✅ Test 6a: Quantity mismatch CAUGHT (Invoice 100, Packing List 95) - BLOCKS PDF")
    })
  })
  
  // ============================================
  // RULE 7: WEIGHT ALIGNMENT (1 test)
  // ============================================
  
  describe("Rule 7: Weight Alignment", () => {
    
    it("should validate net/gross weight relationship", async () => {
      const docs = createValidDocumentSet()
      docs.packingList!.netWeight = 1000
      docs.packingList!.grossWeight = 1150 // 15% overhead (within 5-30%)
      
      const result = await validateDocumentConsistency(docs)
      
      expect(result.weightConsistent).toBe(true)
      expect(result.consistency.weightMatch.differencePercent).toBe(15)
      console.log("✅ Test 7a: Weight relationship valid (15% packaging overhead)")
    })
  })
  
  // ============================================
  // INTEGRATION TESTS (2 tests)
  // ============================================
  
  describe("Integration: Complete Document Validation", () => {
    
    it("should validate completely consistent document set with high score", async () => {
      const docs = createValidDocumentSet()
      
      const result = await validateDocumentConsistency(docs)
      
      console.log("\n✅ Valid Document Set:")
      console.log(`   Consistency Score: ${result.consistencyScore}/100`)
      console.log(`   All Fields Consistent: ${result.allConsistent ? "YES" : "NO"}`)
      console.log(`   Errors: ${result.errors.length}`)
      console.log(`   Warnings: ${result.warnings.length}`)
      
      expect(result.allConsistent).toBe(true)
      expect(result.consistencyScore).toBe(100)
      expect(result.errors.length).toBe(0)
    })
    
    it("should block PDF generation on multiple inconsistencies", async () => {
      const docs = createValidDocumentSet()
      
      // Introduce multiple mismatches
      docs.invoice.totalValue = 100000
      docs.insurance!.insuredValue = 40000 // Too low - VALUE MISMATCH
      
      docs.invoice.portOfLoading = "INMAA"
      docs.shippingBill!.portOfLoading = "INMAB1" // PORT MISMATCH
      
      docs.invoice.items[0].quantity = 100
      docs.packingList!.items[0].quantity = 80 // QUANTITY MISMATCH
      
      const result = await validateDocumentConsistency(docs)
      
      console.log("\n❌ Invalid Document Set (Multiple Mismatches):")
      console.log(`   Consistency Score: ${result.consistencyScore}/100`)
      console.log(`   Errors Found: ${result.errors.length}`)
      result.errors.forEach((err, idx) => {
        console.log(`     ${idx + 1}. [${err.code}] - ${err.severity}`)
      })
      
      expect(result.allConsistent).toBe(false)
      expect(result.consistencyScore).toBeLessThan(50)
      expect(result.errors.length).toBeGreaterThan(0)
      
      const pdfResult = await canGeneratePDF(docs)
      expect(pdfResult.allowed).toBe(false)
      console.log(`   PDF Generation: BLOCKED`)
    })
  })
  
  // ============================================
  // REAL-WORLD SCENARIOS
  // ============================================
  
  describe("Real-World Document Validation Scenarios", () => {
    
    it("Scenario: Valid T-Shirt Export (all documents consistent)", async () => {
      const docs: DocumentSet = {
        invoice: {
          id: "INV-TSHIRT",
          invoiceNumber: "INV-2026-TSHIRT-001",
          totalValue: 50000,
          currency: "USD",
          incoterm: "FOB",
          freight: 0,
          insurance: 1500,
          portOfLoading: "INMAA",
          portOfDischarge: "",
          items: [{ hsCode: "6203", quantity: 5000, unitPrice: 10 }]
        },
        packingList: {
          id: "PL-TSHIRT",
          totalBoxes: 100,
          netWeight: 5000,
          grossWeight: 5500,
          items: [{ hsCode: "6203", quantity: 5000, packageType: "Carton" }]
        },
        shippingBill: {
          id: "SB-TSHIRT",
          portOfLoading: "INMAA",
          portOfDischarge: "",
          cargoType: "Textile"
        },
        insurance: {
          id: "INS-TSHIRT",
          insuredValue: 53500,
          policyNumber: "POL-TSHIRT-001"
        }
      }
      
      const result = await validateDocumentConsistency(docs)
      
      console.log("\n👕 T-Shirt Export Scenario:")
      console.log("   Documents: Invoice → Packing List → Shipping Bill → Insurance")
      console.log("   Status:", result.allConsistent ? "✅ ALL CONSISTENT" : "❌ INCONSISTENT")
      console.log("   Score:", result.consistencyScore)
      
      expect(result.allConsistent).toBe(true)
    })
    
    it("Scenario: Fish Export with Custom Certification Issues", async () => {
      const docs: DocumentSet = {
        invoice: {
          id: "INV-FISH",
          invoiceNumber: "INV-2026-FISH-001",
          totalValue: 80000,
          currency: "USD",
          incoterm: "CIF",
          freight: 8000,
          insurance: 3000,
          portOfLoading: "INMAE", // Cochin - for fish
          portOfDischarge: "SG", // Singapore discharge
          items: [{ hsCode: "0302", quantity: 500, unitPrice: 160 }]
        },
        packingList: {
          id: "PL-FISH",
          totalBoxes: 50,
          netWeight: 500,
          grossWeight: 550,
          items: [{ hsCode: "0302", quantity: 500, packageType: "Plastic" }]
        },
        shippingBill: {
          id: "SB-FISH",
          portOfLoading: "INMAE",
          portOfDischarge: "SG",
          cargoType: "Perishable"
        },
        insurance: {
          id: "INS-FISH",
          insuredValue: 91000, // 80k + 8k + 3k
          policyNumber: "POL-FISH-001"
        }
      }
      
      const result = await validateDocumentConsistency(docs)
      
      console.log("\n🐟 Fish Export Scenario:")
      console.log("   Port:", result.consistency.portMatch.loading, "→", result.consistency.portMatch.discharge)
      console.log("   Incoterm:", result.consistency.incotermMatch)
      console.log("   Status:", result.allConsistent ? "✅ CONSISTENT" : "❌ INCONSISTENT")
      
      expect(result.allConsistent).toBe(true)
      expect(result.consistency.portMatch.loading).toBe("INMAE")
    })
  })
  
  // ============================================
  // HELPER FUNCTION TESTS
  // ============================================
  
  describe("Helper Functions", () => {
    
    it("should use canGeneratePDF helper to block invalid documents", async () => {
      const docs = createValidDocumentSet()
      docs.invoice.totalValue = 100000
      docs.insurance!.insuredValue = 30000 // Invalid
      
      const result = await canGeneratePDF(docs)
      
      expect(result.allowed).toBe(false)
      expect(result.blockers.length).toBeGreaterThan(0)
      expect(result.score).toBeLessThan(100)
      console.log("✅ Helper: canGeneratePDF correctly blocks invalid document set")
    })
    
    it("should generate detailed consistency report", async () => {
      const docs = createValidDocumentSet()
      
      const result = await validateDocumentConsistency(docs)
      const report = generateConsistencyReport(result)
      
      expect(report).toContain("CROSS-DOCUMENT CONSISTENCY REPORT")
      expect(report).toContain("THE MOAT")
      expect(report).toContain("Consistency Score")
      expect(report).toContain("FIELD-LEVEL CONSISTENCY")
      
      console.log("✅ Helper: Report generation successful")
      console.log("\nSample Report Output:")
      console.log(report.split("\n").slice(0, 20).join("\n"))
    })
  })
  
  // ============================================
  // COMPREHENSIVE QUALITY CHECK
  // ============================================
  
  describe("Comprehensive Quality Assurance", () => {
    
    it("should enforce document consistency as the moat (competitive advantage)", async () => {
      console.log("\n🛡️  THE MOAT: Cross-Document Consistency Engine")
      console.log("================================================:")
      console.log("")
      
      const scenarios = [
        {
          name: "Valid Export",
          setup: (docs: DocumentSet) => docs,
          expectPass: true
        },
        {
          name: "Value Mismatch",
          setup: (docs: DocumentSet) => {
            docs.insurance!.insuredValue = 30000
            return docs
          },
          expectPass: false
        },
        {
          name: "Port Mismatch",
          setup: (docs: DocumentSet) => {
            docs.shippingBill!.portOfLoading = "INMAB1"
            return docs
          },
          expectPass: false
        },
        {
          name: "Quantity Mismatch",
          setup: (docs: DocumentSet) => {
            docs.packingList!.items[0].quantity = 50
            return docs
          },
          expectPass: false
        },
        {
          name: "Port Missing in Shipping Bill",
          setup: (docs: DocumentSet) => {
            docs.shippingBill = undefined
            return docs
          },
          expectPass: true // Optional doc
        }
      ]
      
      for (const scenario of scenarios) {
        const docs = createValidDocumentSet()
        const testDocs = scenario.setup(docs)
        const result = await validateDocumentConsistency(testDocs)
        
        const status = result.allConsistent ? "✅ PASS" : "❌ FAIL"
        console.log(`${scenario.name.padEnd(30)} ${status} (Score: ${result.consistencyScore})`)
        
        if (scenario.expectPass) {
          expect(result.allConsistent).toBe(true)
        } else {
          expect(result.allConsistent).toBe(false)
        }
      }
      
      console.log("")
      console.log("✅ Cross-Document Consistency Engine = THE MOAT")
      console.log("   Prevents bank/customs rejections BEFORE generation")
    })
  })
})
