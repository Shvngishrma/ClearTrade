import { Document, Packer, Paragraph, Table, TextRun } from "docx"
import {
  dataTable,
  documentHeader,
  keyValueTable,
  partyDetailsTable,
  sectionHeading,
  signatureBlock,
  totalsBlock,
} from "./docx/layout"

function formatDate(value: unknown, fallback = "N/A") {
  if (!value) return fallback
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) return fallback
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

async function pack(children: (Paragraph | Table)[]) {
  const doc = new Document({
    sections: [{ children }],
  })
  return Packer.toBuffer(doc)
}

export async function generateInvoiceDOCX(invoice: any) {
  const itemRows = (invoice.items || [])
    .map((item: any) => {
      const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
      return { ...item, lineTotal }
    })
    .sort((a: any, b: any) => String(a.description || "").localeCompare(String(b.description || "")))

  const itemTableRows = itemRows.map((item: any, index: number) => [
    String(index + 1),
    item.description || "",
    item.hsCode || "-",
    String(item.quantity ?? "0"),
    item.unit || "PCS",
    `${invoice.currency || "USD"} ${Number(item.unitPrice || 0).toFixed(2)}`,
    `${invoice.currency || "USD"} ${item.lineTotal.toFixed(2)}`,
  ])

  const vesselOrFlight = (invoice.vesselOrFlightNumber || "").trim()
  const blOrAwb = (invoice.blNumber || invoice.awbNumber || "").trim()
  const containerNumber = (invoice.containerNumber || "").trim()
  const marksAndNumbers = (invoice.marksAndNumbers || "").trim()

  const hasExchangeDisclosure =
    invoice.currency !== "INR" && Number(invoice.totalValue) > 0 && Number(invoice.totalValueINR) > 0
  const derivedExchangeRate = hasExchangeDisclosure
    ? Number(invoice.totalValueINR) / Number(invoice.totalValue)
    : null

  const subtotal = itemRows.reduce((sum: number, item: any) => sum + Number(item.lineTotal || 0), 0)
  const freight = Number(invoice.freightCharges ?? invoice.freight ?? 0)
  const insurance = Number(invoice.insuranceCharges ?? invoice.insurance ?? 0)
  const totalValue = Number(invoice.totalValue || subtotal)

  const metadataRows: Array<[string, string]> = [
    ["INVOICE NO", invoice.invoiceNumber || "N/A"],
    ["DATE", formatDate(invoice.invoiceDate)],
    ["PAYMENT TERMS", invoice.paymentTerms || "N/A"],
  ]

  const shipmentRows: Array<[string, string]> = [
    ["INCOTERM", invoice.incoterm || "Not specified"],
    ["PORT OF LOADING", invoice.portOfLoading || "Not specified"],
    ["PORT OF DISCHARGE", invoice.portOfDischarge || "Not specified"],
    ["COUNTRY OF ORIGIN", invoice.countryOfOrigin || "Not specified"],
    ["MODE OF TRANSPORT", invoice.modeOfTransport || "Not specified"],
  ]

  const transportRows: Array<[string, string]> = [
    ["VESSEL / FLIGHT", vesselOrFlight],
    ["BL / AWB NO", blOrAwb],
    ["CONTAINER NO", containerNumber],
    ["MARKS & NUMBERS", marksAndNumbers],
  ].filter((row): row is [string, string] => Boolean(row[1]))

  const summaryRows: Array<[string, string]> = [
    ["Subtotal", `${invoice.currency || "USD"} ${subtotal.toFixed(2)}`],
    ...(freight > 0 ? ([["Freight", `${invoice.currency || "USD"} ${freight.toFixed(2)}`]] as Array<[string, string]>) : []),
    ...(insurance > 0
      ? ([["Insurance", `${invoice.currency || "USD"} ${insurance.toFixed(2)}`]] as Array<[string, string]>)
      : []),
    ["Total Invoice Value", `${invoice.currency || "USD"} ${totalValue.toFixed(2)}`],
    ...(hasExchangeDisclosure
      ? ([["Exchange Rate", `1 ${invoice.currency} = INR ${derivedExchangeRate?.toFixed(2)}`]] as Array<[string, string]>)
      : []),
    ...(hasExchangeDisclosure
      ? ([["Reference Date", formatDate(invoice.exchangeRateDate || invoice.invoiceDate)]] as Array<[string, string]>)
      : []),
  ]

  return pack([
    documentHeader("COMMERCIAL INVOICE"),
    keyValueTable(metadataRows, { compact: true }),
    sectionHeading("Party Details"),
    partyDetailsTable(invoice),
    sectionHeading("Shipment Details"),
    keyValueTable(shipmentRows, { columns: 2 }),
    ...(transportRows.length > 0 ? [sectionHeading("Transport Details"), keyValueTable(transportRows, { columns: 2 })] : []),
    sectionHeading("Items"),
    dataTable(["SR", "Description", "HS Code", "Qty", "Unit", "Unit Price", "Amount"], itemTableRows, {
      compact: true,
    }),
    sectionHeading("Summary / Totals"),
    totalsBlock(summaryRows),
    sectionHeading("Signature"),
    signatureBlock(invoice.exporter?.name || "Exporter"),
  ])
}

export async function generatePackingListDOCX(invoice: any, packing: any) {
  const poRef = invoice.poReference || invoice.poRef || invoice.purchaseOrderRef || "N/A"
  const cartons = Array.isArray(packing?.cartons) ? packing.cartons : []

  const itemRows = (invoice.items || []).map((item: any, index: number) => [
    String(index + 1),
    item.description || "",
    item.hsCode || "",
    String(item.quantity ?? ""),
  ])

  const cartonRows = cartons.map((carton: any) => [
    String(carton.cartonNumber ?? ""),
    String(carton.marks || "").trim() || "N/M",
    carton.lengthCm && carton.widthCm && carton.heightCm
      ? `${Number(carton.lengthCm).toFixed(2)} x ${Number(carton.widthCm).toFixed(2)} x ${Number(carton.heightCm).toFixed(2)}`
      : "",
    Number(carton.netWeightKg || 0).toFixed(3),
    Number(carton.grossWeightKg || 0).toFixed(3),
    Number(carton.cbm || 0).toFixed(6),
  ])

  const metadataRows: Array<[string, string]> = [
    ["Invoice Ref", invoice.invoiceNumber || "N/A"],
    ["PO Ref", poRef],
    ["Incoterm", invoice.incoterm || "N/A"],
  ]

  const shipmentRows: Array<[string, string]> = [
    ["Port of Loading", invoice.portOfLoading || "N/A"],
    ["Port of Discharge", invoice.portOfDischarge || "N/A"],
    ["Country of Origin", invoice.countryOfOrigin || "N/A"],
    ["Mode of Transport", invoice.modeOfTransport || "N/A"],
  ]

  const summaryRows: Array<[string, string]> = [
    ["Total Cartons", String(Number(packing?.totalBoxes || cartons.length || 0))],
    ["Total Net Weight (kg)", Number(packing?.netWeight || 0).toFixed(3)],
    ["Total Gross Weight (kg)", Number(packing?.grossWeight || 0).toFixed(3)],
    ["Total CBM", Number(packing?.totalCBM || 0).toFixed(6)],
  ]

  return pack([
    documentHeader("PACKING LIST"),
    sectionHeading("Metadata"),
    keyValueTable(metadataRows),
    sectionHeading("Party Details"),
    partyDetailsTable(invoice),
    sectionHeading("Shipment Details"),
    keyValueTable(shipmentRows),
    sectionHeading("Items"),
    dataTable(["SR", "Description", "HS Code", "Qty"], itemRows),
    sectionHeading("Summary / Totals"),
    keyValueTable(summaryRows),
    sectionHeading("Carton Details"),
    dataTable(["Carton No", "Marks", "Dimensions (cm)", "Net Wt", "Gross Wt", "CBM"], cartonRows),
    sectionHeading("Signature"),
    signatureBlock(invoice.exporter?.name || "Exporter"),
  ])
}

export async function generateShippingBillDOCX(invoice: any, sb: any) {
  const adCode = (sb?.adCode || invoice.exporter?.adCode || "").trim().toUpperCase() || "N/A"

  const itemRows = (invoice.items || []).map((item: any, index: number) => {
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

  const metadataRows: Array<[string, string]> = [
    ["Shipping Bill No", `SB-${String(sb.id || "DRAFT").slice(0, 8).toUpperCase()}`],
    ["Invoice Ref", invoice.invoiceNumber || "N/A"],
    ["IEC", invoice.exporter?.iec || "N/A"],
    ["AD Code", adCode],
  ]

  const shipmentRows: Array<[string, string]> = [
    ["Port of Loading", sb.portOfLoading || invoice.portOfLoading || "N/A"],
    ["Port of Discharge", sb.portOfDischarge || invoice.portOfDischarge || "N/A"],
    ["Destination Country", invoice.buyer?.country || "N/A"],
    ["Scheme", sb.schemeCode || (sb.drawback ? "Drawback" : "N/A")],
  ]

  const summaryRows: Array<[string, string]> = [
    ["FOB Value", `${invoice.currency || "USD"} ${Number(invoice.totalValue || 0).toFixed(2)}`],
    ["Freight", `${invoice.currency || "USD"} ${Number(invoice.freight || 0).toFixed(2)}`],
    ["Insurance", `${invoice.currency || "USD"} ${Number(invoice.insurance || 0).toFixed(2)}`],
    ["Total Invoice Value", `${invoice.currency || "USD"} ${Number(invoice.totalValue || 0).toFixed(2)}`],
    [
      "Exchange Rate",
      invoice.currency !== "INR" && Number(invoice.totalValueINR || 0) > 0 && Number(invoice.totalValue || 0) > 0
        ? `1 ${invoice.currency} = INR ${(Number(invoice.totalValueINR) / Number(invoice.totalValue)).toFixed(2)}`
        : "N/A",
    ],
  ]

  return pack([
    documentHeader("SHIPPING BILL (DRAFT)"),
    sectionHeading("Metadata"),
    keyValueTable(metadataRows),
    sectionHeading("Party Details"),
    partyDetailsTable(invoice),
    sectionHeading("Shipment Details"),
    keyValueTable(shipmentRows),
    sectionHeading("Items"),
    dataTable(["SR", "Description", "HS Code", "Qty", "FOB Value", "Scheme"], itemRows),
    sectionHeading("Summary / Totals"),
    keyValueTable(summaryRows),
    sectionHeading("Signature"),
    signatureBlock(invoice.exporter?.name || "Exporter"),
  ])
}

export async function generateCertificateOfOriginDOCX(invoice: any, coo: any) {
  const origin = coo?.originCountry || invoice.countryOfOrigin || "N/A"
  const itemRows = (invoice.items || []).map((item: any, index: number) => [
    String(index + 1),
    item.description || "",
    item.hsCode || "",
    origin,
  ])

  const metadataRows: Array<[string, string]> = [
    ["Certificate Type", "Certificate of Origin"],
    ["Invoice Ref", invoice.invoiceNumber || "N/A"],
    ["Date", formatDate(invoice.invoiceDate)],
  ]

  const shipmentRows: Array<[string, string]> = [
    ["Country of Origin", origin],
    ["Port of Loading", invoice.portOfLoading || "N/A"],
    ["Port of Discharge", invoice.portOfDischarge || "N/A"],
    ["Mode of Transport", invoice.modeOfTransport || "N/A"],
  ]

  const summaryRows: Array<[string, string]> = [
    ["Consignee Country", invoice.buyer?.country || "N/A"],
    ["Exporter IEC", invoice.exporter?.iec || "N/A"],
  ]

  return pack([
    documentHeader("CERTIFICATE OF ORIGIN"),
    sectionHeading("Metadata"),
    keyValueTable(metadataRows),
    sectionHeading("Party Details"),
    partyDetailsTable(invoice),
    sectionHeading("Shipment Details"),
    keyValueTable(shipmentRows),
    sectionHeading("Items"),
    dataTable(["SR", "Description", "HS Code", "Country of Origin"], itemRows),
    sectionHeading("Summary / Totals"),
    keyValueTable(summaryRows),
    sectionHeading("Signature"),
    signatureBlock(invoice.exporter?.name || "Exporter"),
  ])
}

export async function generateInsuranceDOCX(invoice: any, insurance: any) {
  const insuredValue = Number(insurance?.insuredValue || 0)
  const coverageType = insurance?.coverageType || "ICC (A)"
  const vesselOrVoyage = invoice.vesselOrFlightNumber || invoice.blNumber || invoice.awbNumber || "N/A"
  const beneficiary = insurance?.beneficiary || invoice.buyer?.name || "N/A"

  const itemValues = (invoice.items || []).map((item: any) =>
    (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
  )
  const totalItemValue = itemValues.reduce((sum: number, value: number) => sum + value, 0)

  const itemRows = (invoice.items || []).map((item: any, index: number) => {
    const lineShare = totalItemValue > 0 ? (itemValues[index] || 0) / totalItemValue : 1 / Math.max(1, (invoice.items || []).length)
    const lineInsured = insuredValue * lineShare
    return [
      String(index + 1),
      item.description || "",
      `${invoice.currency || "USD"} ${lineInsured.toFixed(2)}`,
      coverageType,
    ]
  })

  const metadataRows: Array<[string, string]> = [
    ["Policy No", insurance?.policyNumber || "N/A"],
    ["Coverage Type", coverageType],
    ["Beneficiary", beneficiary],
  ]

  const shipmentRows: Array<[string, string]> = [
    ["Vessel / Voyage", vesselOrVoyage],
    ["Port of Loading", invoice.portOfLoading || "N/A"],
    ["Port of Discharge", invoice.portOfDischarge || "N/A"],
    ["Mode of Transport", invoice.modeOfTransport || "N/A"],
  ]

  const summaryRows: Array<[string, string]> = [
    ["Insured Value", `${invoice.currency || "USD"} ${insuredValue.toFixed(2)}`],
    ["Currency", invoice.currency || "USD"],
  ]

  return pack([
    documentHeader("MARINE INSURANCE CERTIFICATE"),
    sectionHeading("Metadata"),
    keyValueTable(metadataRows),
    sectionHeading("Party Details"),
    partyDetailsTable(invoice),
    sectionHeading("Shipment Details"),
    keyValueTable(shipmentRows),
    sectionHeading("Items"),
    dataTable(["SR", "Goods", "Insured Amount", "Risk Coverage"], itemRows),
    sectionHeading("Summary / Totals"),
    keyValueTable(summaryRows),
    sectionHeading("Signature"),
    signatureBlock(invoice.exporter?.name || "Exporter"),
  ])
}

export async function generateDeclarationDOCX(invoice: any) {
  const metadataRows: Array<[string, string]> = [
    ["Declaration Type", "Export Declaration"],
    ["Invoice Ref", invoice.invoiceNumber || "N/A"],
    ["Date", formatDate(invoice.invoiceDate)],
  ]

  const shipmentRows: Array<[string, string]> = [
    ["Port of Loading", invoice.portOfLoading || "N/A"],
    ["Port of Discharge", invoice.portOfDischarge || "N/A"],
    ["Country of Origin", invoice.countryOfOrigin || "N/A"],
    ["Mode of Transport", invoice.modeOfTransport || "N/A"],
  ]

  const declarationRows = [
    ["1", "Goods exported are as per invoice."],
    ["2", "Proceeds will be realized within prescribed period."],
    ["3", "No prohibited goods included."],
    ["4", "Details furnished are true and correct."],
  ]

  const summaryRows: Array<[string, string]> = [
    ["Exporter", invoice.exporter?.name || "N/A"],
    ["Buyer", invoice.buyer?.name || "N/A"],
  ]

  return pack([
    documentHeader("EXPORT DECLARATION"),
    sectionHeading("Metadata"),
    keyValueTable(metadataRows),
    sectionHeading("Party Details"),
    partyDetailsTable(invoice),
    sectionHeading("Shipment Details"),
    keyValueTable(shipmentRows),
    sectionHeading("Items"),
    dataTable(["Clause", "Statement"], declarationRows),
    sectionHeading("Summary / Totals"),
    keyValueTable(summaryRows),
    sectionHeading("Signature"),
    signatureBlock(invoice.exporter?.name || "Exporter"),
  ])
}

export async function generateLetterOfCreditSummaryDOCX(invoice: any, lc: any) {
  const shipmentDeadlineValue = lc?.shipmentDeadline || lc?.latestShipmentDate
  const shipmentDeadline = shipmentDeadlineValue ? new Date(shipmentDeadlineValue).toLocaleDateString("en-GB") : "N/A"

  const lcCurrency = lc?.lcCurrency || invoice.currency || "N/A"
  const lcAmount = Number(lc?.lcAmount || invoice.totalValue || 0)

  const tolerance =
    lc?.tolerancePercent === null || lc?.tolerancePercent === undefined
      ? "N/A"
      : `+/-${Number(lc.tolerancePercent).toFixed(2)}%`

  const metadataRows: Array<[string, string]> = [
    ["LC No", lc?.lcNumber || "N/A"],
    ["Issuing Bank", lc?.issuingBank || "N/A"],
    ["Advising Bank", lc?.advisingBank || "N/A"],
  ]

  const shipmentRows: Array<[string, string]> = [
    ["Shipment Deadline", shipmentDeadline],
    ["Presentation Period", `${Number(lc?.presentationPeriodDays || lc?.presentationDays || 45)} days`],
    ["Partial Shipment Allowed", lc?.partialShipmentAllowed ? "Yes" : "No"],
    ["Tolerance", tolerance],
  ]

  const itemRows = (invoice.items || []).map((item: any, index: number) => [
    String(index + 1),
    item.description || "",
    item.hsCode || "",
    String(item.quantity ?? 0),
  ])

  const summaryRows: Array<[string, string]> = [
    ["Currency", lcCurrency],
    ["Amount", `${lcCurrency} ${lcAmount.toFixed(2)}`],
    ["Reference", "This document summarizes LC terms for internal validation reference."],
  ]

  return pack([
    documentHeader("LETTER OF CREDIT SUMMARY"),
    sectionHeading("Metadata"),
    keyValueTable(metadataRows),
    sectionHeading("Party Details"),
    partyDetailsTable(invoice),
    sectionHeading("Shipment Details"),
    keyValueTable(shipmentRows),
    sectionHeading("Items"),
    dataTable(["SR", "Description", "HS Code", "Qty"], itemRows.length > 0 ? itemRows : [["1", "N/A", "N/A", "0"]]),
    sectionHeading("Summary / Totals"),
    keyValueTable(summaryRows),
    sectionHeading("Signature"),
    signatureBlock(invoice.exporter?.name || "Exporter"),
  ])
}

export async function generateComplianceCertificateDOCX(invoice: any, validation: any) {
  const engineRows = Object.entries(validation?.engines || {}).map(([engine, status]) => [engine, String(status)])
  const blockerRows = (validation?.blockers || []).map((issue: any) => [
    issue.engine || "-",
    issue.code || "-",
    issue.message || "-",
  ])

  const metadataRows: Array<[string, string]> = [
    ["Invoice No", invoice?.invoiceNumber || "N/A"],
    ["Exporter", invoice?.exporter?.name || "N/A"],
    ["Buyer", invoice?.buyer?.name || "N/A"],
  ]

  const shipmentRows: Array<[string, string]> = [
    ["Validation Result", validation?.canRelease ? "PASSED" : "FAILED"],
    ["Blocker Count", String((validation?.blockers || []).length)],
    ["Warning Count", String((validation?.warnings || []).length)],
    ["Invoice ID", invoice?.id || "N/A"],
  ]

  const summaryRows: Array<[string, string]> = [
    [
      "Validation Summary",
      validation?.canRelease
        ? "All critical compliance checks passed."
        : "One or more compliance blockers were identified.",
    ],
  ]

  return pack([
    documentHeader("COMPLIANCE CERTIFICATE"),
    sectionHeading("Metadata"),
    keyValueTable(metadataRows),
    sectionHeading("Party Details"),
    partyDetailsTable(invoice),
    sectionHeading("Shipment Details"),
    keyValueTable(shipmentRows),
    sectionHeading("Items"),
    dataTable(["Engine", "Status"], engineRows.length > 0 ? engineRows : [["N/A", "N/A"]]),
    sectionHeading("Summary / Totals"),
    keyValueTable(summaryRows),
    sectionHeading("Blockers"),
    dataTable(["Engine", "Code", "Message"], blockerRows.length > 0 ? blockerRows : [["-", "-", "No blockers."]]),
    sectionHeading("Signature"),
    signatureBlock(invoice?.exporter?.name || "Exporter"),
  ])
}
