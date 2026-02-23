/**
 * ENGINE 2: CUSTOMS DUTIES - TEST SUITE
 * 
 * 12 test cases covering all 5 rules + edge cases + bank rejection scenarios
 * Ready to run with: npm run test lib/customsDutiesEngine.test.ts
 */

import { describe, it, expect } from "vitest"
import { 
  validateCustomsDuties,
  canGenerateInvoiceDocuments_Duties,
  type DutyLine
} from "./customsDutiesEngine"

describe("Engine 2: Customs Duties Enforcement", () => {
  
  // ============================================
  // RULE 1: HS CODE FORMAT VALIDATION
  // ============================================
  
  describe("Rule 1: HS Code Format", () => {
    it("should PASS for valid 6-digit HS code", async () => {
      const result = await validateCustomsDuties(
        "INV-DT-001",
        [{
          lineNo: 1,
          hsCode: "620300",  // Valid 6-digit
          commodity: "Cotton T-Shirts",
          quantity: 100,
          unitPrice: 500,
          currency: "USD"
        }]
      )

      expect(result.allowed).toBe(true)
      expect(result.blockers.filter(b => b.code === "INVALID_HS_CODE_FORMAT")).toHaveLength(0)
    })

    it("should PASS for valid 8-digit HS code (ITC)", async () => {
      const result = await validateCustomsDuties(
        "INV-DT-002",
        [{
          lineNo: 1,
          hsCode: "62034210",  // Valid 8-digit ITC code
          commodity: "Cotton T-Shirts",
          quantity: 100,
          unitPrice: 500,
          currency: "USD"
        }]
      )

      expect(result.allowed).toBe(true)
    })

    it("should BLOCK for invalid format (4 digits)", async () => {
      const result = await validateCustomsDuties(
        "INV-DT-003",
        [{
          lineNo: 1,
          hsCode: "6203",  // Invalid - only 4 digits
          commodity: "Cotton T-Shirts",
          quantity: 100,
          unitPrice: 500,
          currency: "USD"
        }]
      )

      expect(result.allowed).toBe(false)
      expect(result.blockers.some(b => b.code === "INVALID_HS_CODE_FORMAT")).toBe(true)
    })

    it("should BLOCK for code with special characters", async () => {
      const result = await validateCustomsDuties(
        "INV-DT-004",
        [{
          lineNo: 1,
          hsCode: "62-03",  // Invalid - has dash
          commodity: "Cotton T-Shirts",
          quantity: 100,
          unitPrice: 500,
          currency: "USD"
        }]
      )

      expect(result.allowed).toBe(false)
      expect(result.blockers.some(b => b.code === "INVALID_HS_CODE_FORMAT")).toBe(true)
    })

    it("should BLOCK for empty HS code", async () => {
      const result = await validateCustomsDuties(
        "INV-DT-005",
        [{
          lineNo: 1,
          hsCode: "",  // Empty
          commodity: "Cotton T-Shirts",
          quantity: 100,
          unitPrice: 500,
          currency: "USD"
        }]
      )

      expect(result.allowed).toBe(false)
    })
  })

  // ============================================
  // RULE 2: DGFT RESTRICTION CHECK
  // ============================================
  
  describe("Rule 2: DGFT Restriction", () => {
    it("should PASS for allowed commodity (HS 6203)", async () => {
      const result = await validateCustomsDuties(
        "INV-DT-006",
        [{
          lineNo: 1,
          hsCode: "6203",
          commodity: "Cotton T-Shirts",
          quantity: 100,
          unitPrice: 500,
          currency: "USD"
        }]
      )

      expect(result.allowed).toBe(true)
      expect(result.blockers.filter(b => b.code === "DGFT_RESTRICTED")).toHaveLength(0)
    })

    it("should WARN for restricted commodity requiring certs (HS 0302 Fish)", async () => {
      const result = await validateCustomsDuties(
        "INV-DT-007",
        [{
          lineNo: 1,
          hsCode: "0302",
          commodity: "Fish (Fresh/Chilled)",
          quantity: 50,
          unitPrice: 800,
          currency: "USD"
        }]
      )

      // Should warn (not block) - warnings add documentation alerts
      expect(result.warnings.some(w => w.code === "DGFT_WARNING")).toBe(true)
    })

    it("should BLOCK for banned commodity (HS 1001 Wheat during ban period)", async () => {
      const result = await validateCustomsDuties(
        "INV-DT-008",
        [{
          lineNo: 1,
          hsCode: "1001",
          commodity: "Wheat",
          quantity: 100,
          unitPrice: 200,
          currency: "USD"
        }]
      )

      expect(result.allowed).toBe(false)
      expect(result.blockers.some(b => b.code === "DGFT_RESTRICTED")).toBe(true)
    })
  })

  // ============================================
  // RULE 3: DUTY CALCULATION
  // ============================================
  
  describe("Rule 3: Duty Calculation", () => {
    it("should calculate duty correctly for HS 6203 (19%)", async () => {
      const result = await validateCustomsDuties(
        "INV-DT-009",
        [{
          lineNo: 1,
          hsCode: "6203",
          commodity: "Cotton T-Shirts",
          quantity: 100,
          unitPrice: 500,  // 100 × 500 = 50,000 CIF
          currency: "USD"
        }]
      )

      expect(result.dutyCalculations).toHaveLength(1)
      const calc = result.dutyCalculations[0]!
      expect(calc.basicDuty).toBe(19)
      expect(calc.totalDutyRate).toBe(19)
      expect(calc.dutyAmount).toBe(9500)  // 50,000 × 0.19
    })

    it("should sum duties across multiple line items", async () => {
      const result = await validateCustomsDuties(
        "INV-DT-010",
        [
          {
            lineNo: 1,
            hsCode: "6203",
            commodity: "Cotton T-Shirts",
            quantity: 100,
            unitPrice: 500,  // CIF: 50,000
            currency: "USD"
          },
          {
            lineNo: 2,
            hsCode: "0302",
            commodity: "Fish",
            quantity: 50,
            unitPrice: 800,  // CIF: 40,000
            currency: "USD"
          }
        ]
      )

      expect(result.totalDutyCIF).toBe(90000)  // 50,000 + 40,000
      expect(result.totalDutyAmount).toBeGreaterThan(0)
    })

    it("should WARN when duty rate not found (new commodity)", async () => {
      const result = await validateCustomsDuties(
        "INV-DT-011",
        [{
          lineNo: 1,
          hsCode: "9999",  // Not in master
          commodity: "Unknown Commodity",
          quantity: 100,
          unitPrice: 500,
          currency: "USD"
        }]
      )

      expect(result.warnings.some(w => w.code === "DUTY_RATE_NOT_FOUND")).toBe(true)
    })
  })

  // ============================================
  // RULE 4: EXEMPTION ELIGIBILITY
  // ============================================
  
  describe("Rule 4: Exemption Eligibility", () => {
    it("should PASS when eligible IEC claims EPCG exemption", async () => {
      const result = await validateCustomsDuties(
        "INV-DT-012",
        [{
          lineNo: 1,
          hsCode: "6203",
          commodity: "Cotton T-Shirts",
          quantity: 100,
          unitPrice: 500,
          currency: "USD",
          adCode: "EPCG"
        }],
        "0323001001"  // Eligible IEC
      )

      expect(result.blockers.filter(b => b.code === "EXEMPTION_NOT_ELIGIBLE")).toHaveLength(0)
    })

    it("should BLOCK when ineligible IEC claims exemption", async () => {
      const result = await validateCustomsDuties(
        "INV-DT-013",
        [{
          lineNo: 1,
          hsCode: "6203",
          commodity: "Cotton T-Shirts",
          quantity: 100,
          unitPrice: 500,
          currency: "USD",
          adCode: "EPCG"
        }],
        "0323001003"  // NOT eligible
      )

      expect(result.allowed).toBe(false)
      expect(result.blockers.some(b => b.code === "EXEMPTION_NOT_ELIGIBLE")).toBe(true)
    })

    it("should WARN when exemption docs required", async () => {
      const result = await validateCustomsDuties(
        "INV-DT-014",
        [{
          lineNo: 1,
          hsCode: "6203",
          commodity: "Cotton T-Shirts",
          quantity: 100,
          unitPrice: 500,
          currency: "USD",
          adCode: "EPCG"
        }],
        "0323001001"
      )

      expect(result.warnings.some(w => w.code === "EXEMPTION_DOCS_REQUIRED")).toBe(true)
    })
  })

  // ============================================
  // RULE 5: AD CODE CONSISTENCY
  // ============================================
  
  describe("Rule 5: AD Code Consistency", () => {
    it("should PASS when all lines use same AD code", async () => {
      const result = await validateCustomsDuties(
        "INV-DT-015",
        [
          {
            lineNo: 1,
            hsCode: "6203",
            commodity: "Cotton T-Shirts",
            quantity: 50,
            unitPrice: 500,
            currency: "USD",
            adCode: "EPCG"
          },
          {
            lineNo: 2,
            hsCode: "0302",
            commodity: "Fish",
            quantity: 25,
            unitPrice: 800,
            currency: "USD",
            adCode: "EPCG"  // Same code
          }
        ]
      )

      expect(result.allowed).toBe(true)
      expect(result.blockers.filter(b => b.code === "AD_CODE_INCONSISTENCY")).toHaveLength(0)
    })

    it("should BLOCK when lines use different AD codes", async () => {
      const result = await validateCustomsDuties(
        "INV-DT-016",
        [
          {
            lineNo: 1,
            hsCode: "6203",
            commodity: "Cotton T-Shirts",
            quantity: 50,
            unitPrice: 500,
            currency: "USD",
            adCode: "EPCG"
          },
          {
            lineNo: 2,
            hsCode: "0302",
            commodity: "Fish",
            quantity: 25,
            unitPrice: 800,
            currency: "USD",
            adCode: "SEZ"  // Different code!
          }
        ]
      )

      expect(result.allowed).toBe(false)
      expect(result.blockers.some(b => b.code === "AD_CODE_INCONSISTENCY")).toBe(true)
    })

    it("should PASS when no AD codes used (normal import)", async () => {
      const result = await validateCustomsDuties(
        "INV-DT-017",
        [
          {
            lineNo: 1,
            hsCode: "6203",
            commodity: "Cotton T-Shirts",
            quantity: 100,
            unitPrice: 500,
            currency: "USD"
            // No adCode
          }
        ]
      )

      expect(result.blockers.filter(b => b.code === "AD_CODE_INCONSISTENCY")).toHaveLength(0)
    })
  })

  // ============================================
  // BANK REJECTION SCENARIOS
  // ============================================
  
  describe("Real-World: Bank Rejection Scenarios", () => {
    it("Scenario 1: Should prevent 'HS code banned' rejection", async () => {
      // Real scenario: Exporter tries to ship wheat during ban
      const result = await validateCustomsDuties(
        "INV-WHEAT-BAN",
        [{
          lineNo: 1,
          hsCode: "1001",
          commodity: "Wheat",
          quantity: 200,
          unitPrice: 180,
          currency: "USD"
        }]
      )

      expect(result.allowed).toBe(false)
      expect(result.blockers[0]?.message).toContain("DGFT BAN")
      // Bank WOULD have rejected this → Engine 2 catches it early
    })

    it("Scenario 2: Should prevent 'duty calculation error' rejection", async () => {
      // Real scenario: Exporter calculates duties wrong (basic is 19%, not 5%)
      const result = await validateCustomsDuties(
        "INV-DUTY-ERROR",
        [{
          lineNo: 1,
          hsCode: "6203",
          commodity: "Cotton T-Shirts",
          quantity: 100,
          unitPrice: 500,
          currency: "USD"
        }]
      )

      const duty = result.dutyCalculations[0]!
      expect(duty.totalDutyRate).toBe(19)  // Not 5%
      expect(duty.dutyAmount).toBe(9500)
      // Pre-calculated for bank submission
    })

    it("Scenario 3: Should prevent 'multiple AD codes' rejection", async () => {
      // Real scenario: Mixed exports with split AD codes
      const result = await validateCustomsDuties(
        "INV-AD-MIX",
        [
          { lineNo: 1, hsCode: "6203", commodity: "T-Shirts", quantity: 50, unitPrice: 500, currency: "USD", adCode: "001" },
          { lineNo: 2, hsCode: "6204", commodity: "Shirts", quantity: 50, unitPrice: 600, currency: "USD", adCode: "002" }
        ]
      )

      // This SHOULD fail - Bank would reject too
      expect(result.allowed).toBe(false)
      expect(result.blockers.some(b => b.code === "AD_CODE_INCONSISTENCY")).toBe(true)
    })

    it("Scenario 4: Should catch missing required certs", async () => {
      // Real scenario: Fish export without APEDA cert
      const result = await validateCustomsDuties(
        "INV-FISH-NOCERT",
        [{
          lineNo: 1,
          hsCode: "0302",
          commodity: "Fish",
          quantity: 50,
          unitPrice: 800,
          currency: "USD"
          // No quality certs provided
        }]
      )

      expect(result.warnings.some(w => w.code === "DGFT_WARNING")).toBe(true)
      // Engine 4 will catch the actual BLOCK when it validates certs
    })
  })

  // ============================================
  // INTEGRATION TESTS
  // ============================================
  
  describe("Integration: Full Customs Validation", () => {
    it("should validate complete multi-line invoice", async () => {
      const result = await validateCustomsDuties(
        "INV-COMPLETE",
        [
          {
            lineNo: 1,
            hsCode: "6203",
            commodity: "Cotton T-Shirts",
            quantity: 100,
            unitPrice: 500,
            currency: "USD"
          },
          {
            lineNo: 2,
            hsCode: "1201",
            commodity: "Soya Beans",
            quantity: 50,
            unitPrice: 400,
            currency: "USD"
          }
        ]
      )

      expect(result.allowed).toBe(true)
      expect(result.dutyCalculations).toHaveLength(2)
      expect(result.totalDutyCIF).toBe(70000)  // 50,000 + 20,000
    })

    it("canGenerateInvoiceDocuments_Duties() should return correct decision", async () => {
      const decision = await canGenerateInvoiceDocuments_Duties(
        "INV-001",
        [{
          lineNo: 1,
          hsCode: "6203",
          commodity: "Cotton T-Shirts",
          quantity: 100,
          unitPrice: 500,
          currency: "USD"
        }]
      )

      expect(decision).toHaveProperty("allowed")
      expect(decision).toHaveProperty("blockers")
      expect(decision).toHaveProperty("warnings")
      expect(typeof decision.allowed).toBe("boolean")
    })

    it("should generate audit log for every validation decision", async () => {
      const result = await validateCustomsDuties(
        "INV-AUDIT",
        [{
          lineNo: 1,
          hsCode: "6203",
          commodity: "Cotton T-Shirts",
          quantity: 100,
          unitPrice: 500,
          currency: "USD"
        }]
      )

      expect(result.auditLog.length).toBeGreaterThan(0)
      expect(result.auditLog[0]).toHaveProperty("timestamp")
      expect(result.auditLog[0]).toHaveProperty("ruleCode")
      expect(result.auditLog[0]).toHaveProperty("result")
    })
  })
})
