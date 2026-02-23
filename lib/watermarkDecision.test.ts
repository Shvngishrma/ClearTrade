import { describe, it, expect } from "vitest"
import { generateInvoiceHTML } from "./htmlInvoiceTemplate"
import { generateInvoicePDF } from "./pdf"
import { inflateSync } from "zlib"

const sampleInvoice = {
  invoiceNumber: "INV-TEST-001",
  exporter: {
    name: "ACME EXPORTS",
    iec: "1234567890",
    iecNo: "1234567890",
    adCode: "AD00123",
    gstIN: "27AAAAA0000A1Z5",
  },
  buyer: {
    name: "GLOBAL IMPORT LLC",
    addressLine1: "101 Trade Street",
    city: "Dubai",
    country: "UAE",
  },
  items: [
    { description: "Industrial Pump", hsCode: "841370", quantity: 10, unitPrice: 250, unit: "PCS" },
  ],
  incoterm: "FOB",
  totalValue: 2500,
  currency: "USD",
  portOfLoading: "INNSA",
  portOfDischarge: "AEDXB",
  modeOfTransport: "Sea",
}

describe("Watermark Decision Lock", () => {
  it("shows watermark in HTML for free plan only", () => {
    const freeHtml = generateInvoiceHTML(sampleInvoice, { isPro: false })
    const proHtml = generateInvoiceHTML(sampleInvoice, { isPro: true })

    expect(freeHtml).toContain("GENERATED VIA PLATFORM")
    expect(freeHtml).toContain("document-watermark")

    expect(proHtml).not.toContain("GENERATED VIA PLATFORM")
    expect(proHtml).not.toContain("document-watermark\">GENERATED VIA PLATFORM")
  })

  it("applies fallback PDF watermark only for free plan", async () => {
    const freePdf = await generateInvoicePDF(sampleInvoice, { isPro: false })
    const proPdf = await generateInvoicePDF(sampleInvoice, { isPro: true })

    const extractInflatedText = (pdf: Uint8Array): string => {
      const buffer = Buffer.from(pdf)
      let cursor = 0
      let combined = ""

      while (cursor < buffer.length) {
        const streamMarker = buffer.indexOf("stream\n", cursor, "latin1")
        if (streamMarker === -1) break

        const dataStart = streamMarker + "stream\n".length
        const endMarker = buffer.indexOf("\nendstream", dataStart, "latin1")
        if (endMarker === -1) break

        const compressedChunk = buffer.subarray(dataStart, endMarker)

        try {
          combined += inflateSync(compressedChunk).toString("latin1")
        } catch {
          // Not a flate stream we can inflate; skip
        }

        cursor = endMarker + "\nendstream".length
      }

      return combined
    }

    const freeInflated = extractInflatedText(freePdf)
    const proInflated = extractInflatedText(proPdf)

    const watermarkHex = "47454E4552415445442056494120504C4154464F524D"

    expect(freeInflated).toContain(watermarkHex)
    expect(proInflated).not.toContain(watermarkHex)
  })
})
