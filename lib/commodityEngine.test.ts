/**
 * ENGINE 4: COMMODITY - TEST SUITE
 * 
 * 12 test cases covering all 5 rules + edge cases + customs rejection scenarios
 * Ready to run with: npm run test lib/commodityEngine.test.ts
 */

import { describe, it, expect } from "vitest"
import { 
  validateCommodities,
  canGenerateInvoiceDocuments_Commodity,
  type CommodityItem
} from "./commodityEngine"

describe("Engine 4: Commodity Enforcement", () => {
  
  // ============================================
  // RULE 1: DGFT BAN CHECK
  // ============================================
  
  describe("Rule 1: DGFT Ban Status", () => {
    it("should PASS for allowed commodity (HS 6203 T-Shirts)", async () => {
      const result = await validateCommodities("INV-CM-001", [
        {
          lineNo: 1,
          hsCode: "6203",
          commodity: "Cotton T-Shirts",
          quantity: 100,
          unit: "Units",
          packaging: "Cardboard"
        }
      ])

      expect(result.allowed).toBe(true)
      expect(result.blockers.filter(b => b.code === "DGFT_BAN")).toHaveLength(0)
    })

    it("should BLOCK for banned commodity during active ban period (HS 1001 Wheat)", async () => {
      const result = await validateCommodities("INV-CM-002", [
        {
          lineNo: 1,
          hsCode: "1001",
          commodity: "Wheat",
          quantity: 100,
          unit: "MT",
          packaging: "Cardboard"
        }
      ])

      expect(result.allowed).toBe(false)
      expect(result.blockers.some(b => b.code === "DGFT_BAN")).toBe(true)
    })

    it("should WARN for restricted commodity requiring license (HS 0302 Fish)", async () => {
      const result = await validateCommodities("INV-CM-003", [
        {
          lineNo: 1,
          hsCode: "0302",
          commodity: "Fish (Fresh/Chilled)",
          quantity: 50,
          unit: "MT",
          packaging: "Metal"
        }
      ])

      // Status should be WARNING, not BLOCKED (yet - cert check will block)
      expect(result.itemValidations[0]?.status).toBe("WARNING")
    })

    it("should allow soya beans (normal commodity)", async () => {
      const result = await validateCommodities("INV-CM-004", [
        {
          lineNo: 1,
          hsCode: "1201",
          commodity: "Soya Beans",
          quantity: 100,
          unit: "MT",
          packaging: "Cardboard"
        }
      ])

      expect(result.allowed).toBe(true)
      expect(result.itemValidations[0]?.dgftStatus).toBe("Allowed")
    })
  })

  // ============================================
  // RULE 2: QUALITY CERTIFICATIONS
  // ============================================
  
  describe("Rule 2: Quality Certifications", () => {
    it("should PASS fish with all required certs (APEDA, Health, Cold Chain)", async () => {
      const result = await validateCommodities("INV-CM-005", [
        {
          lineNo: 1,
          hsCode: "0302",
          commodity: "Fish (Fresh/Chilled)",
          quantity: 50,
          unit: "MT",
          packaging: "Plastic",
          qualityCerts: ["APEDA", "Health Certificate", "Cold Chain Proof"]
        }
      ])

      expect(result.allowed).toBe(true)
      expect(result.itemValidations[0]?.certifications.missing).toHaveLength(0)
      expect(result.blockers.filter(b => b.code === "MISSING_QUALITY_CERT")).toHaveLength(0)
    })

    it("should BLOCK fish missing APEDA cert", async () => {
      const result = await validateCommodities("INV-CM-006", [
        {
          lineNo: 1,
          hsCode: "0302",
          commodity: "Fish",
          quantity: 50,
          unit: "MT",
          packaging: "Plastic",
          qualityCerts: ["Health Certificate", "Cold Chain Proof"]
          // Missing APEDA
        }
      ])

      expect(result.allowed).toBe(false)
      expect(result.blockers.some(b => b.code === "MISSING_QUALITY_CERT")).toBe(true)
      expect(result.itemValidations[0]?.certifications.missing).toContain("APEDA")
    })

    it("should BLOCK dairy (cheese) without FSSAI cert", async () => {
      const result = await validateCommodities("INV-CM-007", [
        {
          lineNo: 1,
          hsCode: "0403",
          commodity: "Buttermilk & Dairy",
          quantity: 10,
          unit: "MT",
          packaging: "Plastic"
          // Missing FSSAI
        }
      ])

      expect(result.allowed).toBe(false)
      expect(result.blockers.some(b => b.code === "MISSING_QUALITY_CERT")).toBe(true)
    })

    it("should PASS commodity with no cert requirements (T-Shirts)", async () => {
      const result = await validateCommodities("INV-CM-008", [
        {
          lineNo: 1,
          hsCode: "6203",
          commodity: "Cotton T-Shirts",
          quantity: 100,
          unit: "Units",
          packaging: "Cardboard"
          // No certs required
        }
      ])

      expect(result.allowed).toBe(true)
      expect(result.itemValidations[0]?.certifications.required).toHaveLength(0)
    })
  })

  // ============================================
  // RULE 3: PACKAGING VALIDATION
  // ============================================
  
  describe("Rule 3: Packaging Standards", () => {
    it("should PASS fish in approved packaging (Metal)", async () => {
      const result = await validateCommodities("INV-CM-009", [
        {
          lineNo: 1,
          hsCode: "0302",
          commodity: "Fish",
          quantity: 50,
          unit: "MT",
          packaging: "Metal",  // Allowed for fish
          qualityCerts: ["APEDA", "Health Certificate", "Cold Chain Proof"]
        }
      ])

      expect(result.itemValidations[0]?.packagingStatus).toBe("Compliant")
      expect(result.blockers.filter(b => b.code === "INVALID_PACKAGING")).toHaveLength(0)
    })

    it("should BLOCK fish in non-approved packaging (Cardboard)", async () => {
      const result = await validateCommodities("INV-CM-010", [
        {
          lineNo: 1,
          hsCode: "0302",
          commodity: "Fish",
          quantity: 50,
          unit: "MT",
          packaging: "Cardboard",  // NOT allowed for fish
          qualityCerts: ["APEDA", "Health Certificate", "Cold Chain Proof"]
        }
      ])

      expect(result.allowed).toBe(false)
      expect(result.blockers.some(b => b.code === "INVALID_PACKAGING")).toBe(true)
      expect(result.itemValidations[0]?.packagingStatus).toBe("Non-Compliant")
    })

    it("should PASS T-Shirts in Cardboard (allowed)", async () => {
      const result = await validateCommodities("INV-CM-011", [
        {
          lineNo: 1,
          hsCode: "6203",
          commodity: "Cotton T-Shirts",
          quantity: 100,
          unit: "Units",
          packaging: "Cardboard"  // Allowed for textiles
        }
      ])

      expect(result.itemValidations[0]?.packagingStatus).toBe("Compliant")
    })

    it("should PASS commodity without packaging requirement", async () => {
      const result = await validateCommodities("INV-CM-012", [
        {
          lineNo: 1,
          hsCode: "1201",
          commodity: "Soya Beans",
          quantity: 100,
          unit: "MT"
          // No packaging specified
        }
      ])

      expect(result.itemValidations[0]?.packagingStatus).toBe("N/A")
      expect(result.allowed).toBe(true)
    })
  })

  // ============================================
  // RULE 4: CUSTOMS SUPERVISION
  // ============================================
  
  describe("Rule 4: Customs Supervision Requirements", () => {
    it("should WARN for fish requiring customs supervision at port", async () => {
      const result = await validateCommodities("INV-CM-013", [
        {
          lineNo: 1,
          hsCode: "0302",
          commodity: "Fish",
          quantity: 50,
          unit: "MT",
          packaging: "Plastic",
          qualityCerts: ["APEDA", "Health Certificate", "Cold Chain Proof"]
        }
      ])

      // Should have warning about supervision
      expect(result.warnings.some(w => w.code === "CUSTOMS_SUPERVISION_REQUIRED")).toBe(true)
      expect(result.warnings[0]?.message).toContain("Port")
      expect(result.warnings[0]?.message).toContain("inspection")
    })

    it("should include required supervision documents in warning", async () => {
      const result = await validateCommodities("INV-CM-014", [
        {
          lineNo: 1,
          hsCode: "0302",
          commodity: "Fish",
          quantity: 50,
          unit: "MT",
          packaging: "Plastic",
          qualityCerts: ["APEDA", "Health Certificate", "Cold Chain Proof"]
        }
      ])

      const supWarn = result.warnings.find(w => w.code === "CUSTOMS_SUPERVISION_REQUIRED")
      expect(supWarn?.message).toContain("Cold Chain Records")
      expect(supWarn?.message).toContain("Temperature Logs")
    })
  })

  // ============================================
  // RULE 5: ALLOCATION QUOTA
  // ============================================
  
  describe("Rule 5: Allocation Quota", () => {
    it("should PASS when quantity within allocation quota", async () => {
      // Soya beans have no quota, so always pass
      const result = await validateCommodities("INV-CM-015", [
        {
          lineNo: 1,
          hsCode: "1201",
          commodity: "Soya Beans",
          quantity: 5000,
          unit: "MT",
          packaging: "Cardboard"
        }
      ])

      expect(result.allowed).toBe(true)
      expect(result.blockers.filter(b => b.code === "QUOTA_EXCEEDED")).toHaveLength(0)
    })

    // Note: Current master doesn't define quotas. This would be added when
    // RBI/DGFT real data integrated. Test shows structure.
  })

  // ============================================
  // CUSTOMS REJECTION SCENARIOS
  // ============================================
  
  describe("Real-World: Customs Rejection Scenarios", () => {
    it("Scenario 1: Prevent 'banned commodity' rejection", async () => {
      // Real case: Exporter tries wheat during ban period
      const result = await validateCommodities("INV-WHEAT-REJECT", [
        {
          lineNo: 1,
          hsCode: "1001",
          commodity: "Wheat",
          quantity: 200,
          unit: "MT",
          packaging: "Cardboard"
        }
      ])

      expect(result.allowed).toBe(false)
      expect(result.itemValidations[0]?.status).toBe("BLOCKED")
      // Customs WOULD have rejected at port → Engine 4 catches it early
    })

    it("Scenario 2: Prevent 'missing certification' rejection", async () => {
      // Real case: Fish export without APEDA
      const result = await validateCommodities("INV-FISH-NOCERTI", [
        {
          lineNo: 1,
          hsCode: "0302",
          commodity: "Fish",
          quantity: 50,
          unit: "MT",
          packaging: "Plastic",
          qualityCerts: ["Health Certificate"]  // Missing APEDA
        }
      ])

      expect(result.allowed).toBe(false)
      expect(result.blockers.some(b => b.code === "MISSING_QUALITY_CERT")).toBe(true)
      // Customs WOULD have rejected cold storage
    })

    it("Scenario 3: Prevent 'wrong packaging' rejection", async () => {
      // Real case: Fish in cardboard (moisture damage risk)
      const result = await validateCommodities("INV-FISH-WRONGPACK", [
        {
          lineNo: 1,
          hsCode: "0302",
          commodity: "Fish",
          quantity: 50,
          unit: "MT",
          packaging: "Cardboard",  // WRONG for fish
          qualityCerts: ["APEDA", "Health Certificate", "Cold Chain Proof"]
        }
      ])

      expect(result.allowed).toBe(false)
      expect(result.blockers.some(b => b.code === "INVALID_PACKAGING")).toBe(true)
      // Customs would've rejected at inspection
    })

    it("Scenario 4: Multiple compliance issues detected", async () => {
      // Real case: Fish export with multiple violations
      const result = await validateCommodities("INV-FISH-MULTI", [
        {
          lineNo: 1,
          hsCode: "0302",
          commodity: "Fish",
          quantity: 50,
          unit: "MT",
          packaging: "Cardboard",  // WRONG packaging
          qualityCerts: ["Health Certificate"]  // Missing APEDA & Cold Chain
        }
      ])

      // Should have multiple blockers
      expect(result.blockers.length).toBeGreaterThan(1)
      expect(result.blockers.some(b => b.code === "MISSING_QUALITY_CERT")).toBe(true)
      expect(result.blockers.some(b => b.code === "INVALID_PACKAGING")).toBe(true)
    })
  })

  // ============================================
  // MULTI-LINE VALIDATION
  // ============================================
  
  describe("Multi-Line Invoices", () => {
    it("should validate mixed commodity invoice", async () => {
      const result = await validateCommodities("INV-MIXED", [
        {
          lineNo: 1,
          hsCode: "6203",
          commodity: "Cotton T-Shirts",
          quantity: 100,
          unit: "Units",
          packaging: "Cardboard"
        },
        {
          lineNo: 2,
          hsCode: "0302",
          commodity: "Fish",
          quantity: 50,
          unit: "MT",
          packaging: "Plastic",
          qualityCerts: ["APEDA", "Health Certificate", "Cold Chain Proof"]
        },
        {
          lineNo: 3,
          hsCode: "1201",
          commodity: "Soya Beans",
          quantity: 100,
          unit: "MT",
          packaging: "Cardboard"
        }
      ])

      expect(result.itemValidations).toHaveLength(3)
      // Line 1 & 3 should PASS
      expect(result.itemValidations[0]?.status).toBe("CLEAR")
      expect(result.itemValidations[2]?.status).toBe("CLEAR")
      // Line 2 should WARN (supervision)
      expect(result.itemValidations[1]?.status).toBe("WARNING")
    })

    it("should catch any blocker in multi-line invoice", async () => {
      const result = await validateCommodities("INV-MIXED-BLOCKED", [
        {
          lineNo: 1,
          hsCode: "6203",
          commodity: "T-Shirts",
          quantity: 100,
          unit: "Units",
          packaging: "Cardboard"  // OK
        },
        {
          lineNo: 2,
          hsCode: "1001",
          commodity: "Wheat",
          quantity: 50,
          unit: "MT",
          packaging: "Cardboard"  // BANNED
        }
      ])

      expect(result.allowed).toBe(false)
      expect(result.itemValidations[1]?.status).toBe("BLOCKED")
      // One blocker blocks entire invoice
    })
  })

  // ============================================
  // INTEGRATION TESTS
  // ============================================
  
  describe("Integration: Full Commodity Validation", () => {
    it("should process complete compliant invoice", async () => {
      const result = await validateCommodities("INV-COMPLIANT", [
        {
          lineNo: 1,
          hsCode: "6203",
          commodity: "Cotton T-Shirts",
          quantity: 100,
          unit: "Units",
          packaging: "Cardboard"
        },
        {
          lineNo: 2,
          hsCode: "1201",
          commodity: "Soya Beans",
          quantity: 100,
          unit: "MT",
          packaging: "Cardboard"
        }
      ])

      expect(result.allowed).toBe(true)
      expect(result.blockers).toHaveLength(0)
      expect(result.itemValidations).toHaveLength(2)
      expect(result.itemValidations.every(v => v.status !== "BLOCKED")).toBe(true)
    })

    it("canGenerateInvoiceDocuments_Commodity() should return correct decision", async () => {
      const decision = await canGenerateInvoiceDocuments_Commodity(
        "INV-001",
        [{
          lineNo: 1,
          hsCode: "6203",
          commodity: "T-Shirts",
          quantity: 100,
          unit: "Units",
          packaging: "Cardboard"
        }]
      )

      expect(decision).toHaveProperty("allowed")
      expect(decision).toHaveProperty("blockers")
      expect(decision).toHaveProperty("warnings")
      expect(typeof decision.allowed).toBe("boolean")
    })

    it("should generate complete audit log", async () => {
      const result = await validateCommodities("INV-AUDIT", [
        {
          lineNo: 1,
          hsCode: "0302",
          commodity: "Fish",
          quantity: 50,
          unit: "MT",
          packaging: "Plastic",
          qualityCerts: ["APEDA", "Health Certificate", "Cold Chain Proof"]
        }
      ])

      expect(result.auditLog.length).toBeGreaterThan(0)
      // Should have logs for each rule check
      const rules = result.auditLog.map(log => log.ruleCode)
      expect(rules).toContain("RULE_DGFT_BAN")
      expect(rules).toContain("RULE_QUALITY_CERT")
      expect(rules).toContain("RULE_PACKAGING")
    })

    it("should generate audit entry with timestamp, rule, and result", async () => {
      const result = await validateCommodities("INV-DETAILED", [
        {
          lineNo: 1,
          hsCode: "6203",
          commodity: "T-Shirts",
          quantity: 100,
          unit: "Units",
          packaging: "Cardboard"
        }
      ])

      const entry = result.auditLog[0]!
      expect(entry).toHaveProperty("timestamp")
      expect(entry).toHaveProperty("ruleCode")
      expect(entry).toHaveProperty("ruleDescription")
      expect(entry).toHaveProperty("result")
      expect(entry).toHaveProperty("details")
      expect(["PASS", "FAIL"]).toContain(entry.result)
    })
  })
})
