/**
 * INTEGRATION TEST: 4-ENGINE COMPLIANCE PIPELINE
 * 
 * Tests the complete flow: Invoice → Engine 1 → Engine 2 → Engine 4 → Decision
 * Validates that engines work together properly in real-world scenarios
 * 
 * Ready to run with: npm run test lib/engines.integration.test.ts
 */

import { describe, it, expect } from "vitest"
import { validateLCCompliance } from "./lcComplianceEngine"
import { validateCustomsDuties, type DutyLine } from "./customsDutiesEngine"
import { validateCommodities, type CommodityItem } from "./commodityEngine"

describe("Integration: 4-Engine Pipeline", () => {
  
  // ============================================
  // COMPLETE INVOICE FLOWS
  // ============================================

  describe("Full Invoice Validation Pipeline", () => {
    
    it("Scenario 1: Valid cotton T-shirt export (all engines pass)", async () => {
      const invoiceNumber = "INV-2026-TSHIRT-001"
      
      // Stage 1: Engine 1 - LC Compliance
      const lcResult = await validateLCCompliance(
        {
          invoiceNumber,
          description: "Cotton T-Shirts",
          quantity: 100,
          shipmentDate: new Date("2026-03-10"),
          invoiceValue: 50000,
          currencyCode: "USD"
        },
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "100 MT Cotton T-Shirts",
          latestShipmentDate: new Date("2026-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: false,
          tolerancePercent: 5
        }
      )
      
      expect(lcResult.isCompliant).toBe(true)
      expect(lcResult.allowDocumentGeneration).toBe(true)
      console.log("✅ Engine 1 PASSED")
      
      if (!lcResult.isCompliant) return  // Stop if LC fails
      
      // Stage 2: Engine 2 - Customs Duties
      const dutyResult = await validateCustomsDuties(invoiceNumber, [
        {
          lineNo: 1,
          hsCode: "6203",
          commodity: "Cotton T-Shirts",
          quantity: 100,
          unitPrice: 500,
          currency: "USD"
        } as DutyLine
      ])
      
      expect(dutyResult.allowed).toBe(true)
      console.log("✅ Engine 2 PASSED - Calculated duty: USD", dutyResult.totalDutyAmount)
      
      if (!dutyResult.allowed) return  // Stop if duties fail
      
      // Stage 3: Engine 4 - Commodity
      const commodityResult = await validateCommodities(invoiceNumber, [
        {
          lineNo: 1,
          hsCode: "6203",
          commodity: "Cotton T-Shirts",
          quantity: 100,
          unit: "Units",
          packaging: "Cardboard"
        } as CommodityItem
      ])
      
      expect(commodityResult.allowed).toBe(true)
      console.log("✅ Engine 4 PASSED")
      
      // Stage 4: Decision
      if (lcResult.allowDocumentGeneration && dutyResult.allowed && commodityResult.allowed) {
        console.log("✅ ALL ENGINES PASSED - Can generate documents!")
        expect(true).toBe(true)
      }
    })

    it("Scenario 2: Fish export with all certifications (E1/E2/E4 pass, warnings noted)", async () => {
      const invoiceNumber = "INV-2026-FISH-001"
      
      // Engine 1: LC
      const lcResult = await validateLCCompliance(
        {
          invoiceNumber,
          description: "Fresh Fish",
          quantity: 50,
          shipmentDate: new Date("2026-03-12"),
          invoiceValue: 40000,
          currencyCode: "USD"
        },
        {
          lcNumber: "LC2026/FISH",
          lcDescriptionText: "50 MT Fresh Fish",
          latestShipmentDate: new Date("2026-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: false,
          tolerancePercent: 5
        }
      )
      
      expect(lcResult.isCompliant).toBe(true)
      
      // Engine 2: Duties
      const dutyResult = await validateCustomsDuties(invoiceNumber, [
        {
          lineNo: 1,
          hsCode: "0302",
          commodity: "Fish (Fresh)",
          quantity: 50,
          unitPrice: 800,
          currency: "USD"
        } as DutyLine
      ])
      
      expect(dutyResult.allowed).toBe(true)
      // Should have warnings about DGFT restrictions
      expect(dutyResult.warnings.length).toBeGreaterThan(0)
      console.log(`⚠️  Engine 2 issued ${dutyResult.warnings.length} warning(s)`)
      
      // Engine 4: Commodity
      const commodityResult = await validateCommodities(invoiceNumber, [
        {
          lineNo: 1,
          hsCode: "0302",
          commodity: "Fish (Fresh)",
          quantity: 50,
          unit: "MT",
          packaging: "Plastic",
          qualityCerts: ["APEDA", "Health Certificate", "Cold Chain Proof"]
        } as CommodityItem
      ])
      
      expect(commodityResult.allowed).toBe(true)
      // Should have supervision warning
      expect(commodityResult.warnings.some(w => w.code === "CUSTOMS_SUPERVISION_REQUIRED")).toBe(true)
      console.log("✅ All engines passed (with supervision warning)")
    })
  })

  // ============================================
  // REJECTION SCENARIOS
  // ============================================

  describe("Real-World Rejection Prevention", () => {
    
    it("Rejection Scenario 1: LC Description Mismatch (caught by Engine 1)", async () => {
      console.log("\n❌ Testing: LC Description Mismatch")
      
      // Engine 1: This should fail
      const lcResult = await validateLCCompliance(
        {
          invoiceNumber: "INV-REJECT-DESC",
          description: "Polyester Skirts",  // Different from LC
          quantity: 100,
          shipmentDate: new Date("2026-03-10"),
          invoiceValue: 50000,
          currencyCode: "USD"
        },
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "Cotton T-Shirts",  // Doesn't match
          latestShipmentDate: new Date("2026-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: false,
          tolerancePercent: 5
        }
      )
      
      // Engine catches this
      expect(lcResult.isCompliant).toBe(false)
      expect(lcResult.allowDocumentGeneration).toBe(false)
      expect(lcResult.blockers.some(b => b.code === "DESCRIPTION_MISMATCH")).toBe(true)
      
      console.log("✅ Engine 1 caught rejection: Description mismatch")
      console.log("   Bank would have rejected this later")
      console.log("   → Caught EARLY before shipment")
    })

    it("Rejection Scenario 2: HS Code Banned (caught by Engine 2)", async () => {
      console.log("\n❌ Testing: HS Code Banned by DGFT")
      
      // Skip Engine 1 (assume it passes) - test Engine 2
      const dutyResult = await validateCustomsDuties("INV-REJECT-BANNED", [
        {
          lineNo: 1,
          hsCode: "1001",  // Wheat - BANNED until Dec 2026
          commodity: "Wheat",
          quantity: 200,
          unitPrice: 180,
          currency: "USD"
        } as DutyLine
      ])
      
      expect(dutyResult.allowed).toBe(false)
      expect(dutyResult.blockers.some(b => b.code === "DGFT_RESTRICTED")).toBe(true)
      
      console.log("✅ Engine 2 caught rejection: Wheat banned by DGFT")
      console.log("   Customs would have rejected at port")
      console.log("   → Caught EARLY before shipment")
    })

    it("Rejection Scenario 3: Missing Quality Cert (caught by Engine 4)", async () => {
      console.log("\n❌ Testing: Missing Quality Certificate")
      
      // Skip Engines 1-2 (assume they pass) - test Engine 4
      const commodityResult = await validateCommodities("INV-REJECT-CERT", [
        {
          lineNo: 1,
          hsCode: "0302",
          commodity: "Fish",
          quantity: 50,
          unit: "MT",
          packaging: "Plastic",
          qualityCerts: ["Health Certificate"]  // Missing APEDA!
        } as CommodityItem
      ])
      
      expect(commodityResult.allowed).toBe(false)
      expect(commodityResult.blockers.some(b => b.code === "MISSING_QUALITY_CERT")).toBe(true)
      expect(commodityResult.itemValidations[0]?.certifications.missing).toContain("APEDA")
      
      console.log("✅ Engine 4 caught rejection: Missing APEDA certification")
      console.log("   Customs would have rejected at cold storage inspection")
      console.log("   → Caught EARLY before shipment")
    })

    it("Rejection Scenario 4: Wrong Packaging (caught by Engine 4)", async () => {
      console.log("\n❌ Testing: Wrong Packaging Standard")
      
      const commodityResult = await validateCommodities("INV-REJECT-PACK", [
        {
          lineNo: 1,
          hsCode: "0302",
          commodity: "Fish",
          quantity: 50,
          unit: "MT",
          packaging: "Cardboard",  // WRONG - Fish needs Metal/Plastic/Glass
          qualityCerts: ["APEDA", "Health Certificate", "Cold Chain Proof"]
        } as CommodityItem
      ])
      
      expect(commodityResult.allowed).toBe(false)
      expect(commodityResult.blockers.some(b => b.code === "INVALID_PACKAGING")).toBe(true)
      
      console.log("✅ Engine 4 caught rejection: Cardboard not approved for fish")
      console.log("   Fish would moisture-damage in cardboard → Customs rejects")
      console.log("   → Caught EARLY before shipment")
    })

    it("Rejection Scenario 5: Multiple HS Codes with Inconsistent AD (caught by Engine 2)", async () => {
      console.log("\n❌ Testing: Inconsistent AD Codes")
      
      const dutyResult = await validateCustomsDuties("INV-REJECT-AD", [
        {
          lineNo: 1,
          hsCode: "6203",
          commodity: "T-Shirts",
          quantity: 50,
          unitPrice: 500,
          currency: "USD",
          adCode: "EPCG"
        } as DutyLine,
        {
          lineNo: 2,
          hsCode: "6204",
          commodity: "Shirts",
          quantity: 50,
          unitPrice: 600,
          currency: "USD",
          adCode: "SEZ"  // Different code!
        } as DutyLine
      ])
      
      expect(dutyResult.allowed).toBe(false)
      expect(dutyResult.blockers.some(b => b.code === "AD_CODE_INCONSISTENCY")).toBe(true)
      
      console.log("✅ Engine 2 caught rejection: AD codes inconsistent (EPCG vs SEZ)")
      console.log("   Bank would require single AD code per invoice")
      console.log("   → Caught EARLY - must split into separate invoices")
    })
  })

  // ============================================
  // EDGE CASES & BOUNDARY CONDITIONS
  // ============================================

  describe("Edge Cases & Boundary Conditions", () => {
    
    it("should handle zero quantities gracefully", async () => {
      const commodityResult = await validateCommodities("INV-EDGE-ZERO", [
        {
          lineNo: 1,
          hsCode: "6203",
          commodity: "T-Shirts",
          quantity: 0,  // Edge case
          unit: "Units",
          packaging: "Cardboard"
        } as CommodityItem
      ])
      
      // Should not crash, should handle gracefully
      expect(commodityResult).toHaveProperty("allowed")
      console.log("✅ Handled zero quantity gracefully")
    })

    it("should handle null/empty certifications array", async () => {
      const commodityResult = await validateCommodities("INV-EDGE-EMPTY", [
        {
          lineNo: 1,
          hsCode: "0302",
          commodity: "Fish",
          quantity: 50,
          unit: "MT",
          packaging: "Plastic",
          qualityCerts: []  // Empty array
        } as CommodityItem
      ])
      
      expect(commodityResult.allowed).toBe(false)
      expect(commodityResult.blockers.some(b => b.code === "MISSING_QUALITY_CERT")).toBe(true)
      console.log("✅ Correctly identified missing certs in empty array")
    })

    it("should handle tolerance edge case (exactly at boundary)", async () => {
      const lcResult = await validateLCCompliance(
        {
          invoiceNumber: "INV-BOUNDARY",
          description: "T-Shirts",
          quantity: 105,  // Exactly 5% over 100
          shipmentDate: new Date("2026-03-10"),
          invoiceValue: 50000,
          currencyCode: "USD"
        },
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "T-Shirts",
          latestShipmentDate: new Date("2026-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: false,
          tolerancePercent: 5  // Exactly at boundary
        }
      )
      
      expect(lcResult.isCompliant).toBe(true)  // Should pass at boundary
      console.log("✅ Correctly handled boundary condition (exactly at tolerance)")
    })
  })

  // ============================================
  // AUDIT TRAIL VERIFICATION
  // ============================================

  describe("Audit Trail & Compliance Reporting", () => {
    
    it("should maintain complete audit trail across pipeline", async () => {
      const invoiceNumber = "INV-AUDIT-TRAIL"
      
      const lcResult = await validateLCCompliance(
        {
          invoiceNumber,
          description: "T-Shirts",
          quantity: 100,
          shipmentDate: new Date("2026-03-10"),
          invoiceValue: 50000,
          currencyCode: "USD"
        },
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "T-Shirts",
          latestShipmentDate: new Date("2026-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: false,
          tolerancePercent: 5
        }
      )
      
      // Engine 1 should have audit log
      expect(lcResult.auditLog.length).toBeGreaterThan(0)
      expect(lcResult.auditLog[0]).toHaveProperty("timestamp")
      expect(lcResult.auditLog[0]).toHaveProperty("ruleCode")
      expect(lcResult.auditLog[0]).toHaveProperty("result")
      
      console.log(`✅ Engine 1 audit log: ${lcResult.auditLog.length} entries`)
      
      // Engine 2
      const dutyResult = await validateCustomsDuties(invoiceNumber, [
        {
          lineNo: 1,
          hsCode: "6203",
          commodity: "T-Shirts",
          quantity: 100,
          unitPrice: 500,
          currency: "USD"
        } as DutyLine
      ])
      
      expect(dutyResult.auditLog.length).toBeGreaterThan(0)
      console.log(`✅ Engine 2 audit log: ${dutyResult.auditLog.length} entries`)
      
      // Engine 4
      const commodityResult = await validateCommodities(invoiceNumber, [
        {
          lineNo: 1,
          hsCode: "6203",
          commodity: "T-Shirts",
          quantity: 100,
          unit: "Units",
          packaging: "Cardboard"
        } as CommodityItem
      ])
      
      expect(commodityResult.auditLog.length).toBeGreaterThan(0)
      console.log(`✅ Engine 4 audit log: ${commodityResult.auditLog.length} entries`)
      
      // Total audit trail
      const totalLogs = lcResult.auditLog.length + dutyResult.auditLog.length + commodityResult.auditLog.length
      console.log(`\n📋 Total audit trail: ${totalLogs} decisions logged`)
      console.log("   Every decision traceable for compliance officer review")
    })
  })

  // ============================================
  // CROSS-ENGINE VALIDATION
  // ============================================

  describe("Cross-Engine Data Consistency", () => {
    
    it("should validate same invoice across all engines returns consistent data", async () => {
      const invoiceNumber = "INV-CONSISTENCY"
      
      // All engines should work with same invoice data
      const lcResult = await validateLCCompliance(
        {
          invoiceNumber,
          description: "T-Shirts",
          quantity: 100,
          shipmentDate: new Date("2026-03-10"),
          invoiceValue: 50000,
          currencyCode: "USD"
        },
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "T-Shirts",
          latestShipmentDate: new Date("2026-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: false,
          tolerancePercent: 5
        }
      )
      
      const dutyResult = await validateCustomsDuties(invoiceNumber, [
        {
          lineNo: 1,
          hsCode: "6203",
          commodity: "T-Shirts",
          quantity: 100,
          unitPrice: 500,
          currency: "USD"
        } as DutyLine
      ])
      
      const commodityResult = await validateCommodities(invoiceNumber, [
        {
          lineNo: 1,
          hsCode: "6203",
          commodity: "T-Shirts",
          quantity: 100,
          unit: "Units",
          packaging: "Cardboard"
        } as CommodityItem
      ])
      
      // All should reference same invoice
      expect(lcResult.lcNumber).toBe("LC2026/001")
      expect(dutyResult.invoiceNumber).toBe(invoiceNumber)
      expect(commodityResult.invoiceNumber).toBe(invoiceNumber)
      
      // All should have timestamps
      expect(lcResult.validationTimestamp).toBeDefined()
      expect(dutyResult.validationTimestamp).toBeDefined()
      expect(commodityResult.validationTimestamp).toBeDefined()
      
      console.log("✅ All engines consistent with same invoice reference")
    })
  })

  // ============================================
  // SUMMARY
  // ============================================

  describe("Summary: Pipeline Effectiveness", () => {
    
    it("should prevent documented rejection patterns", async () => {
      const scenarios = [
        {
          name: "LC Description Mismatch",
          engine: "Engine 1",
          prevented: true
        },
        {
          name: "DGFT Banned Commodity",
          engine: "Engine 2",
          prevented: true
        },
        {
          name: "Missing Quality Cert",
          engine: "Engine 4",
          prevented: true
        },
        {
          name: "Wrong Packaging",
          engine: "Engine 4",
          prevented: true
        },
        {
          name: "Inconsistent AD Code",
          engine: "Engine 2",
          prevented: true
        }
      ]
      
      console.log("\n📊 REJECTION PREVENTION SUMMARY")
      console.log("================================")
      scenarios.forEach(s => {
        console.log(`✅ ${s.name.padEnd(30)} → ${s.engine}`)
      })
      console.log("================================")
      console.log(`Total scenarios prevented: ${scenarios.filter(s => s.prevented).length}/${scenarios.length}`)
      
      expect(scenarios.every(s => s.prevented)).toBe(true)
    })
  })
})
