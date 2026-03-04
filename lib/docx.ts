import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx"

function h1(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 32 })],
    spacing: { after: 200 },
  })
}

function h2(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24 })],
    spacing: { before: 160, after: 120 },
  })
}

function sub(text: string) {
  return new Paragraph({
    children: [new TextRun({ text, italics: true, size: 20 })],
    spacing: { after: 140 },
  })
}

function kv(label: string, value: string) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20 }),
      new TextRun({ text: value || "N/A", size: 20 }),
    ],
    spacing: { after: 80 },
  })
}

function bullet(text: string) {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 100 },
  })
}

function table(headers: string[], rows: string[][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map(
          (header) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: header, bold: true })],
                }),
              ],
            })
        ),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map(
              (value) =>
                new TableCell({
                  children: [new Paragraph(String(value ?? ""))],
                })
            ),
          })
      ),
    ],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "D9D9D9" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "D9D9D9" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "D9D9D9" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "D9D9D9" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E5E5E5" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E5E5E5" },
    },
  })
}

function signBlock(exporterName: string) {
  return [
    new Paragraph({ text: "", spacing: { before: 240, after: 40 } }),
    new Paragraph({
      children: [new TextRun({ text: `For ${exporterName || "Exporter"}`, size: 20 })],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 500 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "________________________", size: 20 })],
      alignment: AlignmentType.RIGHT,
    }),
    new Paragraph({
      children: [new TextRun({ text: "Authorized Signatory", bold: true, size: 20 })],
      alignment: AlignmentType.RIGHT,
    }),
  ]
}

async function pack(children: (Paragraph | Table)[]) {
  const doc = new Document({
    sections: [{ children }],
  })
  return Packer.toBuffer(doc)
}

export async function generateInvoiceDOCX(invoice: any) {
  const rows = (invoice.items || []).map((item: any, index: number) => {
    const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
    return [
      String(index + 1),
      item.description || "",
      item.hsCode || "",
      String(item.quantity ?? ""),
      String(item.unitPrice ?? ""),
      `${invoice.currency || "USD"} ${lineTotal.toFixed(2)}`,
    ]
  })

  // Transport details
  const vesselOrFlight = (invoice.vesselOrFlightNumber || "").trim()
  const blOrAwb = (invoice.blNumber || invoice.awbNumber || "").trim()
  const containerNumber = (invoice.containerNumber || "").trim()
  const marksAndNumbers = (invoice.marksAndNumbers || "").trim()

  // Exchange rate
  const hasExchangeDisclosure =
    invoice.currency !== "INR" &&
    Number(invoice.totalValue) > 0 &&
    Number(invoice.totalValueINR) > 0
  const derivedExchangeRate = hasExchangeDisclosure
    ? Number(invoice.totalValueINR) / Number(invoice.totalValue)
    : null
  const referenceDate = hasExchangeDisclosure
    ? new Date(invoice.exchangeRateDate || invoice.invoiceDate || new Date())
    : null
  const formattedReferenceDate = referenceDate
    ? referenceDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : null

  return pack([
    h1("COMMERCIAL INVOICE"),
    kv("Invoice No", invoice.invoiceNumber || "N/A"),
    kv("Invoice Date", invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString("en-GB") : "N/A"),
    kv("Incoterm", invoice.incoterm || "N/A"),
    kv("Payment Terms", invoice.paymentTerms || "N/A"),
    kv("Port of Loading", invoice.portOfLoading || "N/A"),
    kv("Port of Discharge", invoice.portOfDischarge || "N/A"),
    kv("Country of Origin", invoice.countryOfOrigin || "N/A"),
    kv("Mode of Transport", invoice.modeOfTransport || "N/A"),
    h2("Exporter Details"),
    kv("Name", invoice.exporter?.name || "N/A"),
    kv("Address", invoice.exporter?.address || "N/A"),
    kv("IEC", invoice.exporter?.iec || "N/A"),
    h2("Buyer Details"),
    kv("Name", invoice.buyer?.name || "N/A"),
    kv("Address", invoice.buyer?.address || "N/A"),
    kv("Country", invoice.buyer?.country || "N/A"),
    h2("Goods"),
    table(["SR", "Description", "HS Code", "Qty", "Unit Price", "Value"], rows),
    h2("Transport Details"),
    ...(vesselOrFlight ? [kv("Vessel / Flight", vesselOrFlight)] : []),
    ...(blOrAwb ? [kv("BL / AWB No", blOrAwb)] : []),
    ...(containerNumber ? [kv("Container No", containerNumber)] : []),
    ...(marksAndNumbers ? [kv("Marks & Numbers", marksAndNumbers)] : []),
    h2("Valuation"),
    kv("Total Invoice Value", `${invoice.currency || "USD"} ${Number(invoice.totalValue || 0).toFixed(2)}`),
    ...(hasExchangeDisclosure
      ? [
          kv(
            "Exchange Rate",
            `1 ${invoice.currency} = ₹${derivedExchangeRate?.toFixed(2)}`
          ),
          kv("Reference Date", formattedReferenceDate || "N/A"),
        ]
      : []),
    ...signBlock(invoice.exporter?.name || "Exporter"),
  ])
}

export async function generatePackingListDOCX(invoice: any, packing: any) {
  const poRef = invoice.poReference || invoice.poRef || invoice.purchaseOrderRef || "N/A"
  const rows = (invoice.items || []).map((item: any, index: number) => [
    String(index + 1),
    item.description || "",
    item.hsCode || "",
    String(item.quantity ?? ""),
  ])
  const cartons = Array.isArray(packing?.cartons) ? packing.cartons : []
  const cartonRows = cartons.map((carton: any) => [
    String(carton.cartonNumber ?? ""),
    carton.marks || "",
    carton.lengthCm && carton.widthCm && carton.heightCm
      ? `${Number(carton.lengthCm).toFixed(2)} × ${Number(carton.widthCm).toFixed(2)} × ${Number(carton.heightCm).toFixed(2)}`
      : "",
    Number(carton.netWeightKg || 0).toFixed(3),
    Number(carton.grossWeightKg || 0).toFixed(3),
    Number(carton.cbm || 0).toFixed(6),
  ])
  const totalNetWeight = Number(packing?.netWeight || 0)
  const totalGrossWeight = Number(packing?.grossWeight || 0)
  const totalCBM = Number(packing?.totalCBM || 0)
  const totalBoxes = Number(packing?.totalBoxes || cartons.length || 0)

  return pack([
    h1("PACKING LIST"),
    kv("Invoice Ref", invoice.invoiceNumber || "N/A"),
    kv("PO Ref", poRef),
    kv("Incoterm", invoice.incoterm || "N/A"),
    kv("Port of Loading", invoice.portOfLoading || "N/A"),
    kv("Port of Discharge", invoice.portOfDischarge || "N/A"),
    kv("Country of Origin", invoice.countryOfOrigin || "N/A"),
    kv("Mode of Transport", invoice.modeOfTransport || "N/A"),
    h2("Exporter / Shipper"),
    kv("Name", invoice.exporter?.name || "N/A"),
    kv("Address", invoice.exporter?.address || "N/A"),
    kv("IEC", invoice.exporter?.iec || "N/A"),
    h2("Buyer / Importer"),
    kv("Name", invoice.buyer?.name || "N/A"),
    kv("Address", invoice.buyer?.address || "N/A"),
    kv("Country", invoice.buyer?.country || "N/A"),
    h2("Goods"),
    table(["SR", "Description", "HS Code", "Qty"], rows),
    h2("Carton Details"),
    table(["Carton No", "Marks", "Dimensions (cm)", "Net Wt", "Gross Wt", "CBM"], cartonRows),
    h2("Summary"),
    kv("Total Cartons", String(totalBoxes)),
    kv("Total Net Weight (kg)", totalNetWeight.toFixed(3)),
    kv("Total Gross Weight (kg)", totalGrossWeight.toFixed(3)),
    kv("Total CBM", totalCBM.toFixed(6)),
    h2("Declaration"),
    new Paragraph("We hereby certify that the above packing details are true and correct and correspond to the related commercial invoice."),
    ...signBlock(invoice.exporter?.name || "Exporter"),
  ])
}

export async function generateShippingBillDOCX(invoice: any, sb: any) {
  const adCode =
    invoice.exporter?.adMappings?.find((mapping: any) => {
      const mappedPort = (mapping.portCode || "").trim().toUpperCase()
      const port = (sb.portOfLoading || invoice.portOfLoading || "").trim().toUpperCase()
      return mappedPort === port
    })?.adCode || invoice.exporter?.adMappings?.[0]?.adCode || "N/A"

  const rows = (invoice.items || []).map((item: any, index: number) => {
    const lineValue = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
    return [
      String(index + 1),
      item.description || "",
      item.hsCode || "",
      String(item.quantity ?? ""),
      `${invoice.currency || "USD"} ${lineValue.toFixed(2)}`,
      sb.schemeCode || (sb.drawback ? "Drawback" : "-"),
    ]
  })

  return pack([
    h1("SHIPPING BILL (DRAFT)"),
    sub("(For ICEGATE Filing Reference)"),
    kv("Shipping Bill No", `SB-${String(sb.id || "DRAFT").slice(0, 8).toUpperCase()}`),
    kv("Invoice Ref", invoice.invoiceNumber || "N/A"),
    kv("IEC", invoice.exporter?.iec || "N/A"),
    kv("AD Code", adCode),
    kv("Port of Loading", sb.portOfLoading || invoice.portOfLoading || "N/A"),
    kv("Destination Country", invoice.buyer?.country || "N/A"),
    kv("Scheme", sb.schemeCode || (sb.drawback ? "Drawback" : "N/A")),
    h2("Exporter Details"),
    kv("Name", invoice.exporter?.name || "N/A"),
    kv("Address", invoice.exporter?.address || "N/A"),
    h2("Consignee Details"),
    kv("Name", invoice.buyer?.name || "N/A"),
    kv("Address", invoice.buyer?.address || "N/A"),
    h2("Goods"),
    table(["SR", "Description", "HS Code", "Qty", "FOB Value", "Scheme"], rows),
    h2("Valuation"),
    kv("FOB Value", `${invoice.currency || "USD"} ${Number(invoice.totalValue || 0).toFixed(2)}`),
    kv("Freight", `${invoice.currency || "USD"} ${Number(invoice.freight || 0).toFixed(2)}`),
    kv("Insurance", `${invoice.currency || "USD"} ${Number(invoice.insurance || 0).toFixed(2)}`),
    kv("Total Invoice Value", `${invoice.currency || "USD"} ${Number(invoice.totalValue || 0).toFixed(2)}`),
    kv("Exchange Rate", invoice.currency !== "INR" && Number(invoice.totalValueINR || 0) > 0 && Number(invoice.totalValue || 0) > 0
      ? `1 ${invoice.currency} = INR ${(Number(invoice.totalValueINR) / Number(invoice.totalValue)).toFixed(2)}`
      : "N/A"),
    h2("Declaration"),
    new Paragraph("We hereby declare that the particulars given above are true and correct, and the goods are intended for export as per applicable customs and FEMA regulations."),
    ...signBlock(invoice.exporter?.name || "Exporter"),
  ])
}

export async function generateCertificateOfOriginDOCX(invoice: any, coo: any) {
  const origin = coo?.originCountry || invoice.countryOfOrigin || "N/A"
  const rows = (invoice.items || []).map((item: any) => [
    item.description || "",
    item.hsCode || "",
    origin,
  ])

  return pack([
    h1("CERTIFICATE OF ORIGIN"),
    new Paragraph("This is to certify that the goods described below:"),
    table(["Description", "HS Code", "Country of Origin"], rows),
    h2("Exporter Details"),
    kv("Name", invoice.exporter?.name || "N/A"),
    kv("Address", invoice.exporter?.address || "N/A"),
    kv("IEC", invoice.exporter?.iec || "N/A"),
    h2("Consignee Details"),
    kv("Name", invoice.buyer?.name || "N/A"),
    kv("Address", invoice.buyer?.address || "N/A"),
    kv("Country", invoice.buyer?.country || "N/A"),
    h2("Declaration Statement"),
    new Paragraph("We certify that the above-mentioned goods originate from the stated country of origin and are true to the best of our knowledge and records."),
    h2("Authorized Signature"),
    ...signBlock(invoice.exporter?.name || "Exporter"),
  ])
}

export async function generateInsuranceDOCX(invoice: any, insurance: any) {
  const insuredValue = Number(insurance?.insuredValue || 0)
  const coverageType = insurance?.coverageType || "ICC (A)"
  const vesselOrVoyage = invoice.vesselOrFlightNumber || invoice.blNumber || invoice.awbNumber || "N/A"
  const beneficiary = insurance?.beneficiary || invoice.buyer?.name || "N/A"
  const itemValues = (invoice.items || []).map((item: any) => (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))
  const totalItemValue = itemValues.reduce((sum: number, value: number) => sum + value, 0)

  const rows = (invoice.items || []).map((item: any, index: number) => {
    const lineShare = totalItemValue > 0 ? (itemValues[index] || 0) / totalItemValue : 1 / Math.max(1, (invoice.items || []).length)
    const lineInsured = insuredValue * lineShare
    return [
      item.description || "",
      `${invoice.currency || "USD"} ${lineInsured.toFixed(2)}`,
      coverageType,
    ]
  })

  return pack([
    h1("MARINE INSURANCE CERTIFICATE"),
    kv("Policy No", insurance?.policyNumber || "N/A"),
    kv("Insured Value", `${invoice.currency || "USD"} ${insuredValue.toFixed(2)}`),
    kv("Coverage Type", coverageType),
    kv("Vessel / Voyage", vesselOrVoyage),
    kv("Beneficiary", beneficiary),
    table(["Goods", "Insured Amount", "Risk Coverage"], rows),
    ...signBlock(invoice.exporter?.name || "Exporter"),
  ])
}

export async function generateDeclarationDOCX(invoice: any) {
  return pack([
    h1("EXPORT DECLARATION"),
    sub("(Under FEMA Regulations)"),
    bullet("Goods exported are as per invoice."),
    bullet("Proceeds will be realized within prescribed period."),
    bullet("No prohibited goods included."),
    bullet("Details furnished are true and correct."),
    ...signBlock(invoice.exporter?.name || "Exporter"),
  ])
}

export async function generateLetterOfCreditSummaryDOCX(invoice: any, lc: any) {
  const shipmentDeadlineValue = lc?.shipmentDeadline || lc?.latestShipmentDate
  const shipmentDeadline = shipmentDeadlineValue
    ? new Date(shipmentDeadlineValue).toLocaleDateString("en-GB")
    : "N/A"

  const lcCurrency = lc?.lcCurrency || invoice.currency || "N/A"
  const lcAmount = Number(lc?.lcAmount || invoice.totalValue || 0)

  const tolerance =
    lc?.tolerancePercent === null || lc?.tolerancePercent === undefined
      ? "N/A"
      : `±${Number(lc.tolerancePercent).toFixed(2)}%`

  return pack([
    h1("LETTER OF CREDIT SUMMARY"),
    kv("LC No", lc?.lcNumber || "N/A"),
    kv("Issuing Bank", lc?.issuingBank || "N/A"),
    kv("Advising Bank", lc?.advisingBank || "N/A"),
    kv("Currency", lcCurrency),
    kv("Amount", `${lcCurrency} ${lcAmount.toFixed(2)}`),
    kv("Shipment Deadline", shipmentDeadline),
    kv("Presentation Period", `${Number(lc?.presentationPeriodDays || lc?.presentationDays || 45)} days`),
    kv("Partial Shipment Allowed", lc?.partialShipmentAllowed ? "Yes" : "No"),
    kv("Tolerance", tolerance),
    new Paragraph("This document summarizes LC terms for internal validation reference."),
  ])
}

export async function generateComplianceCertificateDOCX(invoice: any, validation: any) {
  const engineRows = Object.entries(validation?.engines || {}).map(([engine, status]) => [engine, String(status)])
  const blockerRows = (validation?.blockers || []).map((issue: any) => [
    issue.engine || "-",
    issue.code || "-",
    issue.message || "-",
  ])

  return pack([
    h1("COMPLIANCE CERTIFICATE"),
    kv("Invoice No", invoice?.invoiceNumber || "N/A"),
    kv("Exporter", invoice?.exporter?.name || "N/A"),
    kv("Buyer", invoice?.buyer?.name || "N/A"),
    h2("Engine Status"),
    table(["Engine", "Status"], engineRows.length > 0 ? engineRows : [["N/A", "N/A"]]),
    h2("Validation Summary"),
    new Paragraph(
      validation?.canRelease
        ? "All critical compliance checks passed."
        : "One or more compliance blockers were identified."
    ),
    h2("Blockers"),
    blockerRows.length > 0
      ? table(["Engine", "Code", "Message"], blockerRows)
      : new Paragraph("No blockers."),
  ])
}
