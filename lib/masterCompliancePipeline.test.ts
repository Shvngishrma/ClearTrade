import { describe, it, expect } from "vitest";
import { runMasterCompliancePipeline } from "./masterCompliancePipeline";
import type { CompliancePipelineInput } from "./masterCompliancePipeline";

describe("Master Compliance Pipeline", () => {
  const validInput: CompliancePipelineInput = {
    invoiceId: "INV001",
    userId: "user123",
    invoiceAmount: 5000,
    invoiceCurrency: "USD",
    invoiceLines: [
      {
        lineNo: 1,
        hsCode: "620300",
        description: "Men's shirts",
        commodity: "Textiles",
        quantity: 100,
        unitPrice: 50,
        gstRate: 5,
      },
    ],
    exporterName: "Export Co",
    exporterIEC: "0123456789",
    portOfLoading: "INMAA",
    portOfDischarge: "USLAX",
    incoterm: "FOB",
    paymentTerm: "LC",
    lcNumber: "LC001",
    submittedAt: new Date(),
  };

  it("should ALLOW when all 5 engines pass", async () => {
    const result = await runMasterCompliancePipeline(validInput);
    expect(result.pipelineAllowed).toBe(true);
    expect(result.httpStatusCode).toBe(200);
    expect(result.totalBlockers).toBe(0);
  });

  it("should BLOCK when LC is missing for LC payment term", async () => {
    const input = { ...validInput, lcNumber: undefined };
    const result = await runMasterCompliancePipeline(input);
    expect(result.pipelineAllowed).toBe(false);
    expect(result.httpStatusCode).toBe(400);
    expect(result.totalBlockers).toBeGreaterThan(0);
  });

  it("should BLOCK when HS code has invalid format", async () => {
    const input = {
      ...validInput,
      invoiceLines: [
        {
          ...validInput.invoiceLines[0],
          hsCode: "INVALID",
        },
      ],
    };
    const result = await runMasterCompliancePipeline(input);
    expect(result.pipelineAllowed).toBe(false);
    expect(result.httpStatusCode).toBe(400);
  });

  it("should BLOCK when port of shipment is invalid", async () => {
    const input = {
      ...validInput,
      portOfLoading: "INVALID_PORT",
    };
    const result = await runMasterCompliancePipeline(input);
    expect(result.pipelineAllowed).toBe(false);
    expect(result.httpStatusCode).toBe(400);
  });

  it("should BLOCK when payment term is invalid", async () => {
    const input = {
      ...validInput,
      paymentTerm: "INVALID_TERM",
    };
    const result = await runMasterCompliancePipeline(input);
    expect(result.pipelineAllowed).toBe(false);
    expect(result.httpStatusCode).toBe(400);
  });

  it("should BLOCK when incoterm and port mismatch", async () => {
    const input = {
      ...validInput,
      incoterm: "CIF",
      portOfDischarge: undefined,
    };
    const result = await runMasterCompliancePipeline(input);
    expect(result.pipelineAllowed).toBe(false);
    expect(result.httpStatusCode).toBe(400);
  });

  it("should collect multiple blockers from different engines", async () => {
    const input = {
      ...validInput,
      portOfLoading: "INVALID",
      paymentTerm: "INVALID_TERM",
    };
    const result = await runMasterCompliancePipeline(input);
    expect(result.pipelineAllowed).toBe(false);
    expect(result.totalBlockers).toBeGreaterThanOrEqual(2);
  });

  it("should generate audit trail for all engines", async () => {
    const result = await runMasterCompliancePipeline(validInput);
    expect(result.auditLog.length).toBeGreaterThanOrEqual(5);
  });

  it("should ALLOW advance payment without requiring LC", async () => {
    const input = {
      ...validInput,
      paymentTerm: "Advance",
      lcNumber: undefined,
    };
    const result = await runMasterCompliancePipeline(input);
    expect(result.pipelineAllowed).toBe(true);
    expect(result.httpStatusCode).toBe(200);
  });
});
