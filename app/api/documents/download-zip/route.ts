export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { checkUsage, incrementUsage } from "@/lib/usage";
import { validateBeforeRelease } from "@/lib/preSubmissionValidationGate";
import { lockInvoiceOnFirstPdfDownload } from "@/lib/documentLifecycle";
import {
  DocumentGenerationError,
  generateCertificateOfOriginPdfBuffer,
  generateDeclarationPdfBuffer,
  generateInsurancePdfBuffer,
  generateInvoicePdfBuffer,
  generateLetterOfCreditPdfBuffer,
  generatePackingListPdfBuffer,
  generateShippingBillPdfBuffer,
} from "@/lib/documentPdfService";

const DOC_GENERATORS: Record<string, (invoiceId: string, usage: any) => Promise<Uint8Array>> = {
  invoice: (invoiceId, usage) => generateInvoicePdfBuffer(invoiceId, { usage, skipValidation: true }),
  packingList: (invoiceId, usage) => generatePackingListPdfBuffer(invoiceId, { usage, skipValidation: true }),
  shippingBill: (invoiceId, usage) => generateShippingBillPdfBuffer(invoiceId, { usage, skipValidation: true }),
  declaration: (invoiceId, usage) => generateDeclarationPdfBuffer(invoiceId, { usage, skipValidation: true }),
  coo: (invoiceId, usage) => generateCertificateOfOriginPdfBuffer(invoiceId, { usage, skipValidation: true }),
  insurance: (invoiceId, usage) => generateInsurancePdfBuffer(invoiceId, { usage, skipValidation: true }),
  lc: (invoiceId, usage) => generateLetterOfCreditPdfBuffer(invoiceId, { usage, skipValidation: true }),
};

const FILE_NAMES: Record<string, string> = {
  invoice: "Commercial_Invoice.pdf",
  packingList: "Packing_List.pdf",
  shippingBill: "Shipping_Bill_Draft.pdf",
  declaration: "Declaration.pdf",
  coo: "Certificate_of_Origin_Draft.pdf",
  insurance: "Insurance_Declaration.pdf",
  lc: "LC_Supporting_Document.pdf",
};

const DISPLAY_NAMES: Record<string, string> = {
  invoice: "Commercial Invoice",
  packingList: "Packing List",
  shippingBill: "Shipping Bill",
  declaration: "Declaration",
  coo: "Certificate of Origin",
  insurance: "Insurance Declaration",
  lc: "LC Supporting Documents",
};

function parseRequestedDocs(raw: string | null): string[] {
  if (!raw) return []

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value in DOC_GENERATORS)
}

function resolveDocsToFetch(invoice: {
  packingLists: unknown[];
  shippingBills: unknown[];
  declarations: unknown[];
  certificatesOfOrigin: unknown[];
  insurances: unknown[];
  lettersOfCredit: unknown[];
}, requestedDocs: string[]) {
  const availableDocs = Object.keys(DOC_GENERATORS).filter((doc) => {
    if (doc === "invoice") return true;
    if (doc === "packingList") return invoice.packingLists.length > 0;
    if (doc === "shippingBill") return invoice.shippingBills.length > 0;
    if (doc === "declaration") return invoice.declarations.length > 0;
    if (doc === "coo") return invoice.certificatesOfOrigin.length > 0;
    if (doc === "insurance") return invoice.insurances.length > 0;
    if (doc === "lc") return invoice.lettersOfCredit.length > 0;
    return false;
  });

  if (requestedDocs.length === 0) {
    return availableDocs
  }

  return availableDocs.filter((doc) => requestedDocs.includes(doc))
}

export async function GET(req: NextRequest) {
  console.log("[ZIP] GET /api/documents/download-zip called");


  try {
    const invoiceId = req.nextUrl.searchParams.get("invoiceId");
    const listOnly = req.nextUrl.searchParams.get("list") === "1";
    const requestedDocs = parseRequestedDocs(req.nextUrl.searchParams.get("docs"))

    console.log("[ZIP] invoiceId from query:", invoiceId);

    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "Missing invoiceId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: true,
        packingLists: true,
        shippingBills: true,
        certificatesOfOrigin: true,
        insurances: true,
        declarations: true,
        lettersOfCredit: true,
      },
    });

    if (!invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const docsToFetch = resolveDocsToFetch(invoice, requestedDocs);
    const includedDocs = docsToFetch.map((doc) => DISPLAY_NAMES[doc] || doc);

    if (listOnly) {
      return new Response(JSON.stringify({ included: includedDocs }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const validation = await validateBeforeRelease(invoiceId);
    if (!validation.canRelease) {
      return new Response(
        JSON.stringify({
          error: "PRE_SUBMISSION_VALIDATION_FAILED",
          message: "Critical validation failed. Fix issues before ZIP download.",
          blockers: validation.blockers,
          warnings: validation.warnings,
          engines: validation.engines,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const zip = new JSZip();

    let filesAdded = 0;

    const usage = await checkUsage();

    for (const doc of docsToFetch) {
      try {
        const generator = DOC_GENERATORS[doc];
        const buffer = await generator(invoiceId, usage);

        if (!buffer || buffer.length === 0) {
          throw new Error(`Generated empty PDF buffer for ${doc}`);
        }

        zip.file(FILE_NAMES[doc], buffer);
        filesAdded++;
      } catch (err) {
        console.error(`[ZIP] Error fetching ${doc}:`, err);

        const details = err instanceof DocumentGenerationError
          ? err.payload
          : err instanceof Error
            ? err.message
            : String(err);

        const message = err instanceof DocumentGenerationError
          ? String(err.payload?.message || err.payload?.error || `Failed to generate ${doc}`)
          : `Failed to generate ${doc}`;

        const blockers = err instanceof DocumentGenerationError && Array.isArray((err.payload as any)?.blockers)
          ? (err.payload as any).blockers
          : [];

        return new Response(
          JSON.stringify({
            error: "PDF_GENERATION_BLOCKED",
            document: doc,
            status: err instanceof DocumentGenerationError ? err.status : 500,
            message,
            blockers,
            details,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    if (filesAdded !== docsToFetch.length) {
      return new Response(
        JSON.stringify({
          error: "PDF_GENERATION_BLOCKED",
          message: "One or more documents could not be generated.",
          expected: docsToFetch.length,
          generated: filesAdded,
          requestedDocuments: docsToFetch,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    if (zipBuffer.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No documents to download",
          filesAdded,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    await incrementUsage();
    await lockInvoiceOnFirstPdfDownload(invoiceId);

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="export-documents.zip"',
        "Content-Length": zipBuffer.length.toString(),
        "x-included-documents": encodeURIComponent(JSON.stringify(includedDocs)),
      },
    });
  } catch (err) {
    console.error("[ZIP] Error:", err);
    return new Response(
      JSON.stringify({ error: "ZIP generation failed", details: String(err) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}