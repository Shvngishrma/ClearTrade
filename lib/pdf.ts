// PDF generation utilities
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib"
import { getDocumentAuditMetadata } from "@/lib/auditMetadata"

function addWatermark(page: any) {
  const { width, height } = page.getSize()
  page.drawText("GENERATED VIA PLATFORM", {
    x: width / 2 - 190,
    y: height / 2,
    size: 36,
    opacity: 0.055,
    rotate: degrees(35),
    color: rgb(0, 0, 0),
  })
}

function shouldApplyWatermark(usage?: any): boolean {
  return usage?.isPro === false
}

function addAuditFooter(page: any, invoice: any, documentType: string) {
  if (!invoice) return

  const { width } = page.getSize()
  const auditMetadata = getDocumentAuditMetadata(documentType, invoice)
  const footerText = `System Generated | Document ID: ${auditMetadata.documentId} | Hash: ${auditMetadata.hash}`

  page.drawText(footerText, {
    x: 50,
    y: 18,
    size: 8,
    color: rgb(0.45, 0.45, 0.45),
  })

  page.drawLine({
    start: { x: 50, y: 30 },
    end: { x: width - 50, y: 30 },
    thickness: 0.5,
    color: rgb(0.88, 0.88, 0.88),
  })
}

export async function generateInvoicePDF(invoice: any, usage?: any) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)

  let y = 800

  page.drawText("COMMERCIAL INVOICE", { x: 50, y, size: 14, font })
  y -= 30

  page.drawText(`Exporter: ${invoice.exporter.name}`, { x: 50, y, size: 10, font })
  y -= 15
  page.drawText(`Buyer: ${invoice.buyer.name}`, { x: 50, y, size: 10, font })
  y -= 25

  invoice.items.forEach((item: any) => {
    page.drawText(
      `${item.description} | HS: ${item.hsCode} | Qty: ${item.quantity} | Price: ${item.unitPrice}`,
      { x: 50, y, size: 9, font }
    )
    y -= 12
  })

  y -= 20
  page.drawText(`Incoterm: ${invoice.incoterm}`, { x: 50, y, size: 10, font })
  y -= 12
  page.drawText(`Port of Loading: ${invoice.portOfLoading || ""}`, { x: 50, y, size: 10, font })
  y -= 12
  page.drawText(`Port of Discharge: ${invoice.portOfDischarge || ""}`, { x: 50, y, size: 10, font })
  y -= 12
  page.drawText(`Country of Origin: ${invoice.countryOfOrigin || ""}`, { x: 50, y, size: 10, font })
  y -= 12
  page.drawText(`Mode of Transport: ${invoice.modeOfTransport || ""}`, { x: 50, y, size: 10, font })
  y -= 14

  const vesselOrFlight = (invoice.vesselOrFlightNumber || "").trim()
  const blOrAwb = (invoice.blNumber || invoice.awbNumber || "").trim()
  const containerNumber = (invoice.containerNumber || "").trim()
  const marksAndNumbers = (invoice.marksAndNumbers || "").trim()

  const transportRows = [
    { label: "Vessel / Flight", value: vesselOrFlight },
    { label: "BL / AWB No", value: blOrAwb },
    { label: "Container No", value: containerNumber },
    { label: "Marks & Numbers", value: marksAndNumbers },
  ].filter((row) => row.value)

  if (transportRows.length > 0) {
    y -= 6
    page.drawText("Transport Details", { x: 50, y, size: 10, font: boldFont })
    y -= 4
    page.drawLine({
      start: { x: 50, y },
      end: { x: 300, y },
      thickness: 0.7,
      color: rgb(0.82, 0.82, 0.82),
    })
    y -= 12

    transportRows.forEach((row) => {
      page.drawText(`${row.label}: ${row.value}`, { x: 50, y, size: 10, font })
      y -= 12
    })

    y -= 8
  }

  page.drawText(`Total Value: ${invoice.totalValue} ${invoice.currency}`, {
    x: 50,
    y,
    size: 10,
    font,
  })

  const hasExchangeDisclosure =
    invoice.currency !== "INR" &&
    Number(invoice.totalValue) > 0 &&
    Number(invoice.totalValueINR) > 0

  if (hasExchangeDisclosure) {
    const derivedExchangeRate = Number(invoice.totalValueINR) / Number(invoice.totalValue)
    const referenceDate = new Date(invoice.exchangeRateDate || invoice.invoiceDate || new Date())
    const formattedReferenceDate = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(referenceDate)

    y -= 14
    page.drawText(`Exchange Rate: 1 ${invoice.currency} = INR ${derivedExchangeRate.toFixed(2)}`, {
      x: 50,
      y,
      size: 8,
      font,
      color: rgb(0.42, 0.42, 0.42),
    })
    y -= 10
    page.drawText(`Reference Date: ${formattedReferenceDate}`, {
      x: 50,
      y,
      size: 8,
      font,
      color: rgb(0.42, 0.42, 0.42),
    })
  }

  y -= 22
  page.drawText(`For ${invoice.exporter?.name || "Exporter"}`, {
    x: 395,
    y,
    size: 10,
    font,
  })

  y -= 80
  page.drawLine({
    start: { x: 360, y },
    end: { x: 545, y },
    thickness: 1,
    color: rgb(0.1, 0.1, 0.1),
  })
  y -= 12
  page.drawText("Authorized Signatory", {
    x: 410,
    y,
    size: 9,
    font: boldFont,
  })

  if (shouldApplyWatermark(usage)) {
    addWatermark(page)
  }

  addAuditFooter(page, invoice, "INVOICE")

  return await pdf.save()
}

export async function generatePackingListPDF(invoice: any, packing: any, usage?: any) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])

  let y = 800
  page.drawText("PACKING LIST", { x: 50, y })
  y -= 30

  page.drawText(`Exporter: ${invoice.exporter.name}`, { x: 50, y })
  y -= 15
  page.drawText(`Buyer: ${invoice.buyer.name}`, { x: 50, y })
  y -= 25

  invoice.items.forEach((item: any) => {
    page.drawText(
      `${item.description} | Qty: ${item.quantity}`,
      { x: 50, y }
    )
    y -= 12
  })

  y -= 20
  page.drawText(`Total Boxes: ${packing.totalBoxes}`, { x: 50, y })
  y -= 12
  page.drawText(`Net Weight: ${packing.netWeight} kg`, { x: 50, y })
  y -= 12
  page.drawText(`Gross Weight: ${packing.grossWeight} kg`, { x: 50, y })

  if (shouldApplyWatermark(usage)) {
    addWatermark(page)
  }

  addAuditFooter(page, invoice, "PACKING_LIST")

  return await pdf.save()
}

export async function generateShippingBillPDF(invoice: any, sb: any, usage?: any) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)

  const { width } = page.getSize()

  const marginX = 50
  const rightX = width - marginX

  let y = 800

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0)

  const truncate = (text: string, maxLength: number) =>
    text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 3))}...`

  const exportDate = invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date()
  const formattedDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(exportDate)

  const shippingBillNo = `SB-${String(sb.id || "DRAFT").slice(0, 8).toUpperCase()}`
  const adCode = (sb?.adCode || invoice.exporter?.adCode || "").trim().toUpperCase() || "N/A"

  const lineValueByItem = invoice.items.map((item: any) => {
    const qty = Number(item.quantity) || 0
    const unitPrice = Number(item.unitPrice) || 0
    return qty * unitPrice
  })
  const computedFOB = lineValueByItem.reduce((sum: number, value: number) => sum + value, 0)
  const freight = Number(invoice.freight || 0)
  const insurance = Number(invoice.insurance || 0)
  const totalInvoiceValue = Number(invoice.totalValue || computedFOB)
  const exchangeRate =
    invoice.currency && invoice.currency !== "INR" && Number(invoice.totalValueINR || 0) > 0 && totalInvoiceValue > 0
      ? Number(invoice.totalValueINR) / totalInvoiceValue
      : null

  // Header
  page.drawText("SHIPPING BILL (DRAFT)", {
    x: marginX,
    y,
    size: 16,
    font: boldFont,
  })
  y -= 16
  page.drawText("(For ICEGATE Filing Reference)", {
    x: marginX,
    y,
    size: 10,
    font,
    color: rgb(0.35, 0.35, 0.35),
  })
  y -= 16
  page.drawLine({
    start: { x: marginX, y },
    end: { x: rightX, y },
    thickness: 0.8,
    color: rgb(0.86, 0.86, 0.86),
  })
  y -= 18

  // Top Meta Block
  const metaEntries = [
    ["Shipping Bill No", shippingBillNo],
    ["Invoice Ref", invoice.invoiceNumber || "N/A"],
    ["IEC", invoice.exporter?.iec || "N/A"],
    ["AD Code", adCode],
    ["Port of Loading", sb.portOfLoading || invoice.portOfLoading || "N/A"],
    ["Destination Country", invoice.buyer?.country || "N/A"],
    ["Scheme", sb.schemeCode || (sb.drawback ? "Drawback" : "N/A")],
    ["Invoice Date", formattedDate],
  ]

  const colGap = 20
  const colWidth = (rightX - marginX - colGap) / 2
  const leftColX = marginX
  const rightColX = marginX + colWidth + colGap

  for (let i = 0; i < metaEntries.length; i += 2) {
    const left = metaEntries[i]
    const right = metaEntries[i + 1]

    if (left) {
      page.drawText(`${left[0]}:`, { x: leftColX, y, size: 9, font: boldFont })
      page.drawText(String(left[1]), { x: leftColX + 95, y, size: 9, font })
    }
    if (right) {
      page.drawText(`${right[0]}:`, { x: rightColX, y, size: 9, font: boldFont })
      page.drawText(String(right[1]), { x: rightColX + 95, y, size: 9, font })
    }

    y -= 14
  }

  y -= 6
  page.drawLine({
    start: { x: marginX, y },
    end: { x: rightX, y },
    thickness: 0.8,
    color: rgb(0.9, 0.9, 0.9),
  })
  y -= 18

  // Exporter / Buyer
  page.drawText("Exporter", { x: leftColX, y, size: 11, font: boldFont })
  page.drawText("Buyer", { x: rightColX, y, size: 11, font: boldFont })
  y -= 14

  const exporterLines = [
    invoice.exporter?.name || "-",
    invoice.exporter?.address || "-",
    `IEC: ${invoice.exporter?.iec || "-"}`,
  ]
  const buyerLines = [
    invoice.buyer?.name || "-",
    invoice.buyer?.address || "-",
    `Country: ${invoice.buyer?.country || "-"}`,
  ]

  for (let i = 0; i < Math.max(exporterLines.length, buyerLines.length); i += 1) {
    if (exporterLines[i]) {
      page.drawText(truncate(exporterLines[i], 42), { x: leftColX, y, size: 9, font })
    }
    if (buyerLines[i]) {
      page.drawText(truncate(buyerLines[i], 42), { x: rightColX, y, size: 9, font })
    }
    y -= 12
  }

  y -= 8

  // Goods table
  page.drawText("Goods", { x: marginX, y, size: 11, font: boldFont })
  y -= 14

  const tableX = marginX
  const tableWidth = rightX - marginX
  const rowHeight = 16
  const columns = [
    { key: "sr", label: "SR", width: 34 },
    { key: "description", label: "Description", width: 210 },
    { key: "hsCode", label: "HS Code", width: 70 },
    { key: "qty", label: "Qty", width: 55 },
    { key: "fobValue", label: "FOB Value", width: 95 },
    { key: "scheme", label: "Scheme", width: 60 },
  ]

  page.drawRectangle({
    x: tableX,
    y: y - rowHeight + 3,
    width: tableWidth,
    height: rowHeight,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 0.8,
    color: rgb(0.97, 0.97, 0.97),
  })

  let colX = tableX + 4
  columns.forEach((column) => {
    page.drawText(column.label, { x: colX, y: y - 8, size: 8.5, font: boldFont })
    colX += column.width
  })
  y -= rowHeight

  invoice.items.forEach((item: any, index: number) => {
    page.drawRectangle({
      x: tableX,
      y: y - rowHeight + 3,
      width: tableWidth,
      height: rowHeight,
      borderColor: rgb(0.9, 0.9, 0.9),
      borderWidth: 0.6,
    })

    const values = {
      sr: String(index + 1),
      description: truncate(item.description || "", 38),
      hsCode: item.hsCode || "",
      qty: String(item.quantity ?? ""),
      fobValue: `${invoice.currency || "USD"} ${formatMoney(lineValueByItem[index] || 0)}`,
      scheme: sb.schemeCode || (sb.drawback ? "Drawback" : "-"),
    }

    let rowX = tableX + 4
    columns.forEach((column) => {
      page.drawText(String(values[column.key as keyof typeof values] || ""), {
        x: rowX,
        y: y - 8,
        size: 8,
        font,
      })
      rowX += column.width
    })

    y -= rowHeight
  })

  y -= 12

  // Valuation block
  page.drawText("Valuation", { x: marginX, y, size: 11, font: boldFont })
  y -= 14

  const valuationRows = [
    ["FOB Value", `${invoice.currency || "USD"} ${formatMoney(computedFOB)}`],
    ["Freight", `${invoice.currency || "USD"} ${formatMoney(freight)}`],
    ["Insurance", `${invoice.currency || "USD"} ${formatMoney(insurance)}`],
    ["Total Invoice Value", `${invoice.currency || "USD"} ${formatMoney(totalInvoiceValue)}`],
    ["Exchange Rate", exchangeRate ? `1 ${invoice.currency} = INR ${exchangeRate.toFixed(2)}` : "N/A"],
  ]

  valuationRows.forEach(([label, value]) => {
    page.drawText(`${label}:`, { x: marginX, y, size: 9, font: boldFont })
    page.drawText(String(value), { x: marginX + 130, y, size: 9, font })
    y -= 12
  })

  y -= 10

  // Declaration block
  page.drawText("Declaration", { x: marginX, y, size: 11, font: boldFont })
  y -= 13
  page.drawText(
    "We hereby declare that the particulars given above are true and correct, and the goods are intended for export as per applicable customs and FEMA regulations.",
    { x: marginX, y, size: 8.5, font, maxWidth: rightX - marginX, lineHeight: 11 }
  )
  y -= 34

  // Signature block (same style as invoice)
  page.drawText(`For ${invoice.exporter?.name || "Exporter"}`, {
    x: 395,
    y,
    size: 10,
    font,
  })

  y -= 80
  page.drawLine({
    start: { x: 360, y },
    end: { x: 545, y },
    thickness: 1,
    color: rgb(0.1, 0.1, 0.1),
  })
  y -= 12
  page.drawText("Authorized Signatory", {
    x: 410,
    y,
    size: 9,
    font: boldFont,
  })

  if (shouldApplyWatermark(usage)) {
    addWatermark(page)
  }

  addAuditFooter(page, invoice, "SHIPPING_BILL")

  return await pdf.save()
}

export async function generateDeclarationPDF(text: string, usage?: any, invoice?: any) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)

  const marginX = 50
  const rightX = 545

  const declarationClauses = [
    "Goods exported are as per invoice and accompanying export documents.",
    "Export proceeds will be realized within the prescribed period under FEMA regulations.",
    "No prohibited or restricted goods are included in this shipment.",
    "Details furnished in this declaration are true and correct to the best of our knowledge.",
  ]

  let y = 800
  page.drawText("EXPORT DECLARATION", { x: marginX, y, size: 16, font: boldFont })
  y -= 16
  page.drawText("(Under FEMA Regulations)", {
    x: marginX,
    y,
    size: 10,
    font,
    color: rgb(0.35, 0.35, 0.35),
  })
  y -= 14

  page.drawLine({
    start: { x: marginX, y },
    end: { x: rightX, y },
    thickness: 0.8,
    color: rgb(0.86, 0.86, 0.86),
  })
  y -= 20

  declarationClauses.forEach((clause) => {
    page.drawText("•", { x: marginX, y, size: 11, font: boldFont })
    page.drawText(clause, {
      x: marginX + 14,
      y,
      size: 10,
      font,
      maxWidth: rightX - (marginX + 14),
      lineHeight: 14,
    })
    y -= 30
  })

  y -= 12

  const declarationDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date())

  page.drawText(`Date: ${declarationDate}`, {
    x: marginX,
    y,
    size: 9,
    font,
  })

  y -= 46
  page.drawText(`For ${invoice?.exporter?.name || "Exporter"}`, {
    x: 390,
    y,
    size: 10,
    font,
  })

  y -= 72
  page.drawLine({
    start: { x: 360, y },
    end: { x: 545, y },
    thickness: 1,
    color: rgb(0.1, 0.1, 0.1),
  })
  y -= 12
  page.drawText("Authorized Signature", {
    x: 408,
    y,
    size: 9,
    font: boldFont,
  })

  if (shouldApplyWatermark(usage)) {
    addWatermark(page)
  }

  addAuditFooter(page, invoice, "DECLARATION")

  return await pdf.save()
}

export async function generateCertificateOfOriginPDF(invoice: any, coo: any, usage?: any) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)

  const marginX = 50
  const rightX = 545

  const truncate = (text: string, maxLength: number) =>
    text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 3))}...`

  let y = 800
  page.drawText("CERTIFICATE OF ORIGIN", { x: marginX, y, size: 16, font: boldFont })
  y -= 18

  page.drawLine({
    start: { x: marginX, y },
    end: { x: rightX, y },
    thickness: 0.8,
    color: rgb(0.86, 0.86, 0.86),
  })
  y -= 18

  page.drawText("This is to certify that the goods described below:", {
    x: marginX,
    y,
    size: 10,
    font,
  })
  y -= 16

  // Minimal compact goods table: Description | HS Code | Country of Origin
  const tableX = marginX
  const tableWidth = rightX - marginX
  const rowHeight = 16
  const columns = [
    { key: "description", label: "Description", width: 280 },
    { key: "hsCode", label: "HS Code", width: 95 },
    { key: "origin", label: "Country of Origin", width: 120 },
  ]

  page.drawRectangle({
    x: tableX,
    y: y - rowHeight + 3,
    width: tableWidth,
    height: rowHeight,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 0.8,
    color: rgb(0.97, 0.97, 0.97),
  })

  let headX = tableX + 4
  columns.forEach((column) => {
    page.drawText(column.label, { x: headX, y: y - 8, size: 8.5, font: boldFont })
    headX += column.width
  })
  y -= rowHeight

  const originCountry = coo.originCountry || invoice.countryOfOrigin || "N/A"

  invoice.items.forEach((item: any) => {
    page.drawRectangle({
      x: tableX,
      y: y - rowHeight + 3,
      width: tableWidth,
      height: rowHeight,
      borderColor: rgb(0.9, 0.9, 0.9),
      borderWidth: 0.6,
    })

    let rowX = tableX + 4
    page.drawText(truncate(item.description || "", 48), { x: rowX, y: y - 8, size: 8, font })
    rowX += columns[0].width
    page.drawText(String(item.hsCode || ""), { x: rowX, y: y - 8, size: 8, font })
    rowX += columns[1].width
    page.drawText(String(originCountry), { x: rowX, y: y - 8, size: 8, font })

    y -= rowHeight
  })

  y -= 18

  // Exporter Details
  page.drawText("Exporter Details", { x: marginX, y, size: 11, font: boldFont })
  y -= 13
  page.drawText(invoice.exporter?.name || "-", { x: marginX, y, size: 9, font })
  y -= 12
  page.drawText(invoice.exporter?.address || "-", { x: marginX, y, size: 9, font, maxWidth: 460 })
  y -= 12
  page.drawText(`IEC: ${invoice.exporter?.iec || "-"}`, { x: marginX, y, size: 9, font })

  y -= 18

  // Consignee Details
  page.drawText("Consignee Details", { x: marginX, y, size: 11, font: boldFont })
  y -= 13
  page.drawText(invoice.buyer?.name || "-", { x: marginX, y, size: 9, font })
  y -= 12
  page.drawText(invoice.buyer?.address || "-", { x: marginX, y, size: 9, font, maxWidth: 460 })
  y -= 12
  page.drawText(`Country: ${invoice.buyer?.country || "-"}`, { x: marginX, y, size: 9, font })

  y -= 18

  // Declaration Statement
  page.drawText("Declaration Statement", { x: marginX, y, size: 11, font: boldFont })
  y -= 13
  page.drawText(
    "We certify that the above-mentioned goods originate from the stated country of origin and are true to the best of our knowledge and records.",
    { x: marginX, y, size: 9, font, maxWidth: 480, lineHeight: 12 }
  )

  y -= 42

  // Authorized Signature
  page.drawText("Authorized Signature", { x: marginX, y, size: 10, font: boldFont })
  y -= 16
  page.drawLine({
    start: { x: marginX, y },
    end: { x: marginX + 180, y },
    thickness: 1,
    color: rgb(0.1, 0.1, 0.1),
  })

  if (coo.chamberName) {
    y -= 14
    page.drawText(`Issuing Chamber: ${coo.chamberName}`, { x: marginX, y, size: 9, font })
  }

  if (shouldApplyWatermark(usage)) {
    addWatermark(page)
  }

  addAuditFooter(page, invoice, "COO")

  return await pdf.save()
}

export async function generateInsurancePDF(invoice: any, insurance: any, usage?: any) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)

  const marginX = 50
  const rightX = 545

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0)

  const truncate = (text: string, maxLength: number) =>
    text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 3))}...`

  const insuredValue = Number(insurance.insuredValue || 0)
  const coverageType = (insurance.coverageType || "ICC (A)").toString()
  const vesselOrVoyage =
    (invoice.vesselOrFlightNumber || invoice.blNumber || invoice.awbNumber || "N/A").toString()
  const beneficiary = (insurance.beneficiary || invoice.buyer?.name || "N/A").toString()

  const itemValues = invoice.items.map((item: any) => {
    const quantity = Number(item.quantity) || 0
    const unitPrice = Number(item.unitPrice) || 0
    return quantity * unitPrice
  })
  const totalItemValue = itemValues.reduce((sum: number, value: number) => sum + value, 0)

  let y = 800
  page.drawText("MARINE INSURANCE CERTIFICATE", { x: marginX, y, size: 16, font: boldFont })
  y -= 18

  page.drawLine({
    start: { x: marginX, y },
    end: { x: rightX, y },
    thickness: 0.8,
    color: rgb(0.86, 0.86, 0.86),
  })
  y -= 18

  const details = [
    ["Policy No", insurance.policyNumber || "N/A"],
    ["Insured Value", `${invoice.currency || "USD"} ${formatMoney(insuredValue)}`],
    ["Coverage Type", coverageType],
    ["Vessel / Voyage", vesselOrVoyage],
    ["Beneficiary", beneficiary],
  ]

  details.forEach(([label, value]) => {
    page.drawText(`${label}:`, { x: marginX, y, size: 9.5, font: boldFont })
    page.drawText(String(value), { x: marginX + 115, y, size: 9.5, font })
    y -= 14
  })

  y -= 10

  // Minimal goods coverage table
  const tableX = marginX
  const tableWidth = rightX - marginX
  const rowHeight = 16
  const columns = [
    { key: "goods", label: "Goods", width: 265 },
    { key: "insuredAmount", label: "Insured Amount", width: 115 },
    { key: "riskCoverage", label: "Risk Coverage", width: 115 },
  ]

  page.drawRectangle({
    x: tableX,
    y: y - rowHeight + 3,
    width: tableWidth,
    height: rowHeight,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 0.8,
    color: rgb(0.97, 0.97, 0.97),
  })

  let headX = tableX + 4
  columns.forEach((column) => {
    page.drawText(column.label, { x: headX, y: y - 8, size: 8.5, font: boldFont })
    headX += column.width
  })
  y -= rowHeight

  invoice.items.forEach((item: any, index: number) => {
    page.drawRectangle({
      x: tableX,
      y: y - rowHeight + 3,
      width: tableWidth,
      height: rowHeight,
      borderColor: rgb(0.9, 0.9, 0.9),
      borderWidth: 0.6,
    })

    const lineShare =
      totalItemValue > 0 ? (itemValues[index] || 0) / totalItemValue : 1 / Math.max(1, invoice.items.length)
    const lineInsuredAmount = insuredValue * lineShare

    let rowX = tableX + 4
    page.drawText(truncate(item.description || "", 44), { x: rowX, y: y - 8, size: 8, font })
    rowX += columns[0].width
    page.drawText(`${invoice.currency || "USD"} ${formatMoney(lineInsuredAmount)}`, { x: rowX, y: y - 8, size: 8, font })
    rowX += columns[1].width
    page.drawText(coverageType, { x: rowX, y: y - 8, size: 8, font })

    y -= rowHeight
  })

  if (shouldApplyWatermark(usage)) {
    addWatermark(page)
  }

  addAuditFooter(page, invoice, "INSURANCE")

  return await pdf.save()
}

export async function generateLetterOfCreditPDF(invoice: any, lc: any, usage?: any) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold)

  const marginX = 50
  const rightX = 545

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0)

  const shipmentDeadlineValue = lc.shipmentDeadline || lc.latestShipmentDate
  const shipmentDeadline = shipmentDeadlineValue
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(shipmentDeadlineValue))
    : "N/A"

  const lcAmount = Number(lc.lcAmount || invoice.totalValue || 0)
  const lcCurrency = lc.lcCurrency || invoice.currency || "N/A"
  const issuingBank = lc.issuingBank || "N/A"
  const advisingBank = lc.advisingBank || "N/A"
  const tolerance =
    lc.tolerancePercent === null || lc.tolerancePercent === undefined
      ? "N/A"
      : `±${Number(lc.tolerancePercent).toFixed(2)}%`

  let y = 800
  page.drawText("LETTER OF CREDIT SUMMARY", { x: marginX, y, size: 16, font: boldFont })
  y -= 18

  page.drawLine({
    start: { x: marginX, y },
    end: { x: rightX, y },
    thickness: 0.8,
    color: rgb(0.86, 0.86, 0.86),
  })
  y -= 20

  const summaryRows = [
    ["LC No", lc.lcNumber || "N/A"],
    ["Issuing Bank", issuingBank],
    ["Advising Bank", advisingBank],
    ["Currency", lcCurrency],
    ["Amount", `${lcCurrency} ${formatMoney(lcAmount)}`],
    ["Shipment Deadline", shipmentDeadline],
    ["Presentation Period", `${Number(lc.presentationPeriodDays || lc.presentationDays || 45)} days`],
    ["Partial Shipment Allowed", lc.partialShipmentAllowed ? "Yes" : "No"],
    ["Tolerance", tolerance],
  ]

  summaryRows.forEach(([label, value]) => {
    page.drawText(`${label}:`, { x: marginX, y, size: 9.5, font: boldFont })
    page.drawText(String(value), { x: marginX + 170, y, size: 9.5, font })
    y -= 14
  })

  y -= 8
  page.drawText("This document summarizes LC terms for internal validation reference.", {
    x: marginX,
    y,
    size: 10,
    font,
    color: rgb(0.25, 0.25, 0.25),
    maxWidth: rightX - marginX,
  })

  if (shouldApplyWatermark(usage)) {
    addWatermark(page)
  }

  addAuditFooter(page, invoice, "LC_SUPPORT")

  return await pdf.save()
}

