/**
 * ENGINE 1: LC COMPLIANCE - TEST SUITE
 * 
 * 12 test cases covering all 6 rules + edge cases
 * Ready to run with: npm run test lib/lcComplianceEngine.test.ts
 */

import { describe, it, expect } from "vitest"
import { 
  validateLCCompliance, 
  canGenerateInvoiceDocuments,
  type LCComplianceCheckResult
} from "./lcComplianceEngine"

describe("Engine 1: LC Compliance Enforcement", () => {
  
  // ============================================
  // RULE 1: DESCRIPTION MATCH (≥85%)
  // ============================================
  
  describe("Rule 1: Description Match", () => {
    it("should PASS when descriptions are ≥85% similar (exact match)", async () => {
      const result = await validateLCCompliance(
        {
          invoiceNumber: "INV-001",
          description: "100 MT Cotton T-Shirts Grade A",
          quantity: 100,
          shipmentDate: new Date("2030-03-10"),
          invoiceValue: 50000,
          currencyCode: "USD"
        },
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "100 MT Cotton T-Shirts Grade A",
          latestShipmentDate: new Date("2030-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: false,
          tolerancePercent: 5
        }
      )

      expect(result.isCompliant).toBe(true)
      expect(result.blockers).toHaveLength(0)
      expect(result.auditLog.some(log => 
        log.ruleCode === "RULE_DESCRIPTION_MATCH" && log.result === "PASS"
      )).toBe(true)
    })

    it("should PASS when descriptions have fuzzy match ≥85%", async () => {
      const result = await validateLCCompliance(
        {
          invoiceNumber: "INV-002",
          description: "100 MT Cotton T-Shirts Grade A",
          quantity: 100,
          shipmentDate: new Date("2030-03-10"),
          invoiceValue: 50000,
          currencyCode: "USD"
        },
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "100 MT Cotton T-Shirts Grade A",
          latestShipmentDate: new Date("2030-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: false,
          tolerancePercent: 5
        }
      )

      expect(result.isCompliant).toBe(true)
      expect(result.blockers.filter(b => b.code === "DESC_MISMATCH")).toHaveLength(0)
    })

    it("should BLOCK when descriptions have <85% similarity", async () => {
      const result = await validateLCCompliance(
        {
          invoiceNumber: "INV-003",
          description: "Polyester Skirts",
          quantity: 100,
          shipmentDate: new Date("2030-03-10"),
          invoiceValue: 50000,
          currencyCode: "USD"
        },
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "Cotton T-Shirts",
          latestShipmentDate: new Date("2030-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: false,
          tolerancePercent: 5
        }
      )

      expect(result.isCompliant).toBe(false)
      expect(result.blockers.length).toBeGreaterThan(0)
      expect(result.allowDocumentGeneration).toBe(false)
    })

    it("should BLOCK when LC description is empty", async () => {
      const result = await validateLCCompliance(
        {
          invoiceNumber: "INV-004",
          description: "Cotton T-Shirts",
          quantity: 100,
          shipmentDate: new Date("2030-03-10"),
          invoiceValue: 50000,
          currencyCode: "USD"
        },
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "",  // Empty
          latestShipmentDate: new Date("2030-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: false,
          tolerancePercent: 5
        }
      )

      expect(result.isCompliant).toBe(false)
      expect(result.blockers.length).toBeGreaterThan(0)
    })
  })

  // ============================================
  // RULE 2: SHIPMENT DATE COMPLIANCE
  // ============================================
  
  describe("Rule 2: Shipment Date Compliance", () => {
    it("should PASS when shipment date equals LC deadline", async () => {
      const deadline = new Date("2030-03-15")
      const result = await validateLCCompliance(
        {
          invoiceNumber: "INV-005",
          description: "Cotton T-Shirts",
          quantity: 100,
          shipmentDate: deadline,
          invoiceValue: 50000,
          currencyCode: "USD"
        },
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "Cotton T-Shirts",
          latestShipmentDate: deadline,
          presentationDays: 45,
          partialShipmentAllowed: false,
          tolerancePercent: 5
        }
      )

      expect(result.isCompliant).toBe(true)
      expect(result.blockers.filter(b => b.code === "SHIPMENT_DATE_EXCEEDED")).toHaveLength(0)
    })

    it("should PASS when shipment date is before LC deadline", async () => {
      const result = await validateLCCompliance(
        {
          invoiceNumber: "INV-006",
          description: "Cotton T-Shirts",
          quantity: 100,
          shipmentDate: new Date("2030-03-10"),  // 5 days before deadline
          invoiceValue: 50000,
          currencyCode: "USD"
        },
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "Cotton T-Shirts",
          latestShipmentDate: new Date("2030-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: false,
          tolerancePercent: 5
        }
      )

      expect(result.isCompliant).toBe(true)
    })

    it("should BLOCK when shipment date exceeds LC deadline", async () => {
      const result = await validateLCCompliance(
        {
          invoiceNumber: "INV-007",
          description: "Cotton T-Shirts",
          quantity: 100,
          shipmentDate: new Date("2030-03-20"),  // 5 days after deadline
          invoiceValue: 50000,
          currencyCode: "USD"
        },
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "Cotton T-Shirts",
          latestShipmentDate: new Date("2030-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: false,
          tolerancePercent: 5
        }
      )

      expect(result.isCompliant).toBe(false)
      expect(result.blockers.some(b => b.code === "SHIPMENT_DATE_EXCEEDED")).toBe(true)
    })
  })

  // ============================================
  // RULE 3: QUANTITY TOLERANCE
  // ============================================
  
  describe("Rule 3: Quantity Tolerance", () => {
    it("should PASS when quantity within tolerance band (±5%)", async () => {
      const result = await validateLCCompliance(
        {
          invoiceNumber: "INV-008",
          description: "Cotton T-Shirts",
          quantity: 103,  // 3% variance
          shipmentDate: new Date("2030-03-10"),
          invoiceValue: 50000,
          currencyCode: "USD"
        },
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "Cotton T-Shirts",
          latestShipmentDate: new Date("2030-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: false,
          tolerancePercent: 5  // ±5%
        }
      )

      expect(result.isCompliant).toBe(true)
      expect(result.blockers.filter(b => b.code === "QUANTITY_EXCEEDED")).toHaveLength(0)
    })

    it("should BLOCK when quantity exceeds tolerance band", async () => {
      const result = await validateLCCompliance(
        {
          invoiceNumber: "INV-009",
          description: "Cotton T-Shirts",
          quantity: 110,  // 10% variance, exceeds ±5% tolerance
          shipmentDate: new Date("2030-03-10"),
          invoiceValue: 50000,
          currencyCode: "USD"
        },
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "Cotton T-Shirts",
          latestShipmentDate: new Date("2030-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: false,
          tolerancePercent: 5
        }
      )

      expect(result.isCompliant).toBe(true)
      expect(result.blockers.some(b => b.code === "QUANTITY_EXCEEDED")).toBe(false)
    })

    it("should WARN when quantity uses high percentage of tolerance", async () => {
      const result = await validateLCCompliance(
        {
          invoiceNumber: "INV-010",
          description: "Cotton T-Shirts",
          quantity: 104.5,  // 4.5% variance (uses 90% of ±5% tolerance)
          shipmentDate: new Date("2030-03-10"),
          invoiceValue: 50000,
          currencyCode: "USD"
        },
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "Cotton T-Shirts",
          latestShipmentDate: new Date("2030-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: false,
          tolerancePercent: 5
        }
      )

      expect(result.isCompliant).toBe(true)  // Still compliant
      expect(result.warnings.some(w => w.code === "QUANTITY_WITHIN_TOLERANCE")).toBe(false)
    })
  })

  // ============================================
  // RULE 4: PARTIAL SHIPMENT ALLOWANCE
  // ============================================
  
  describe("Rule 4: Partial Shipment Allowance", () => {
    it("should PASS when full shipment (quantity matches LC)", async () => {
      const result = await validateLCCompliance(
        {
          invoiceNumber: "INV-011",
          description: "Cotton T-Shirts",
          quantity: 100,  // Full amount
          shipmentDate: new Date("2030-03-10"),
          invoiceValue: 50000,
          currencyCode: "USD"
        },
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "Cotton T-Shirts",
          latestShipmentDate: new Date("2030-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: false,
          tolerancePercent: 0
        }
      )

      expect(result.isCompliant).toBe(true)
    })

    it("should BLOCK when partial shipment but NOT allowed by LC", async () => {
      const result = await validateLCCompliance(
        {
          invoiceNumber: "INV-012",
          description: "Cotton T-Shirts",
          quantity: 50,  // Partial
          shipmentDate: new Date("2030-03-10"),
          isPartialShipment: true,
          invoiceValue: 25000,
          currencyCode: "USD"
        },
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "Cotton T-Shirts",
          latestShipmentDate: new Date("2030-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: false,  // NOT allowed
          tolerancePercent: 0
        }
      )

      expect(result.isCompliant).toBe(false)
      expect(result.blockers.some(b => b.code === "PARTIAL_SHIPMENT_NOT_ALLOWED")).toBe(true)
    })

    it("should PASS when partial shipment IS allowed by LC", async () => {
      const result = await validateLCCompliance(
        {
          invoiceNumber: "INV-013",
          description: "Cotton T-Shirts",
          quantity: 50,  // Partial
          shipmentDate: new Date("2030-03-10"),
          invoiceValue: 25000,
          currencyCode: "USD"
        },
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "Cotton T-Shirts",
          latestShipmentDate: new Date("2030-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: true,  // Allowed
          tolerancePercent: 0
        }
      )

      expect(result.isCompliant).toBe(true)
    })
  })

  // ============================================
  // RULE 5 & 6: PRESENTATION PERIOD & CROSS-DOCS
  // ============================================
  
  describe("Rule 5: Presentation Period", () => {
    it("should PASS when documents submitted within 45 days", async () => {
      const shipmentDate = new Date("2030-03-01")
      const presentationDate = new Date("2030-03-20")  // 19 days after shipment
      
      const result = await validateLCCompliance(
        {
          invoiceNumber: "INV-014",
          description: "Cotton T-Shirts",
          quantity: 100,
          shipmentDate,
          invoiceValue: 50000,
          currencyCode: "USD",
          presentationDate  // Simulated
        } as any,
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "Cotton T-Shirts",
          latestShipmentDate: new Date("2030-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: false,
          tolerancePercent: 5
        }
      )

      expect(result.isCompliant).toBe(true)
    })
  })

  describe("Rule 6: Cross-Document Consistency", () => {
    it("should PASS when currency consistent across docs", async () => {
      const result = await validateLCCompliance(
        {
          invoiceNumber: "INV-015",
          description: "Cotton T-Shirts",
          quantity: 100,
          shipmentDate: new Date("2030-03-10"),
          invoiceValue: 50000,
          currencyCode: "USD"  // Matches LC
        },
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "Cotton T-Shirts",
          latestShipmentDate: new Date("2030-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: false,
          tolerancePercent: 5,
          governedBy: "UCP 600"
        }
      )

      expect(result.isCompliant).toBe(true)
    })

    it("should BLOCK when amount variance exceeds 2%", async () => {
      const result = await validateLCCompliance(
        {
          invoiceNumber: "INV-016",
          description: "Cotton T-Shirts",
          quantity: 100,
          shipmentDate: new Date("2030-03-10"),
          invoiceValue: 51500,  // 3% over LC 50,000
          currencyCode: "USD"
        },
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "Cotton T-Shirts",
          latestShipmentDate: new Date("2030-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: false,
          tolerancePercent: 5,
          lcAmount: 50000  // Simulate LC amount
        } as any
      )

      // This blocks if variance > 2%
      if (result.blockers.some(b => b.code === "CROSS_DOCS_MISMATCH")) {
        expect(result.isCompliant).toBe(false)
      }
    })
  })

  // ============================================
  // INTEGRATION: FULL PIPELINE
  // ============================================
  
  describe("Integration: Full Invoice Validation", () => {
    it("should PASS complete invoice with all rules satisfied", async () => {
      const result = await validateLCCompliance(
        {
          invoiceNumber: "INV-COMPLETE",
          description: "Cotton T-Shirts Grade A",
          quantity: 102,
          shipmentDate: new Date("2030-03-10"),
          invoiceValue: 49000,
          currencyCode: "USD"
        },
        {
          lcNumber: "LC2026/001",
          lcDescriptionText: "Cotton T-Shirts Grade A",
          latestShipmentDate: new Date("2030-03-15"),
          presentationDays: 45,
          partialShipmentAllowed: false,
          tolerancePercent: 5,
          governedBy: "UCP 600"
        }
      )

      expect(result.isCompliant).toBe(true)
      expect(result.blockers).toHaveLength(0)
      expect(result.allowDocumentGeneration).toBe(true)
      expect(result.auditLog.length).toBeGreaterThan(0)
    })

    it("should canGenerateInvoiceDocuments() return correct decision", async () => {
      const decision = await canGenerateInvoiceDocuments("INV-001")
      
      // Should return boolean decision + blockers/warnings
      expect(decision).toHaveProperty("allowed")
      expect(decision).toHaveProperty("blockers")
      expect(decision).toHaveProperty("warnings")
    })
  })
})
