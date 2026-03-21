import {
  AlignmentType,
  BorderStyle,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx"

type KeyValueRow = [string, string]

const FONT = "Calibri"
const BORDER_COLOR_OUTER = "D9D9D9"
const BORDER_COLOR_INNER = "E5E5E5"
const GAP_SMALL = 40
const GAP_MEDIUM = 180
const GAP_LARGE = 320

type KeyValueTableOptions = {
  columns?: 1 | 2
  compact?: boolean
}

type DataTableOptions = {
  compact?: boolean
}

type AlignmentValue = (typeof AlignmentType)[keyof typeof AlignmentType]

function tableBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR_OUTER },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR_OUTER },
    left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR_OUTER },
    right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR_OUTER },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR_INNER },
    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR_INNER },
  }
}

export function documentHeader(title: string) {
  return new Paragraph({
    children: [new TextRun({ text: title, bold: true, size: 30, font: FONT })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 140 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR_OUTER },
    },
  })
}

export function sectionHeading(text: string) {
  return new Paragraph({
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 22,
        font: FONT,
      }),
    ],
    spacing: { before: GAP_MEDIUM, after: 80 },
  })
}

function keyValueCell(text: string, bold: boolean, compact: boolean, align: AlignmentValue = AlignmentType.LEFT) {
  return new Paragraph({
    children: [new TextRun({ text: text || "", bold, size: compact ? 19 : 20, font: FONT })],
    spacing: { after: compact ? GAP_SMALL : 60 },
    alignment: align,
  })
}

export function keyValueTable(rows: KeyValueRow[], options: KeyValueTableOptions = {}) {
  const compact = options.compact ?? false
  const columns = options.columns ?? 1

  if (columns === 2) {
    const pairedRows: Array<[KeyValueRow, KeyValueRow | null]> = []
    for (let i = 0; i < rows.length; i += 2) {
      pairedRows.push([rows[i], rows[i + 1] || null])
    }

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: pairedRows.map(([left, right]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 22, type: WidthType.PERCENTAGE },
              children: [keyValueCell(left[0], true, compact)],
            }),
            new TableCell({
              width: { size: 28, type: WidthType.PERCENTAGE },
              children: [keyValueCell(left[1] || "N/A", false, compact)],
            }),
            new TableCell({
              width: { size: 22, type: WidthType.PERCENTAGE },
              children: [keyValueCell(right?.[0] || "", true, compact)],
            }),
            new TableCell({
              width: { size: 28, type: WidthType.PERCENTAGE },
              children: [keyValueCell(right?.[1] || "", false, compact)],
            }),
          ],
        })
      ),
      borders: tableBorders(),
    })
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 35, type: WidthType.PERCENTAGE },
              children: [keyValueCell(label, true, compact)],
            }),
            new TableCell({
              width: { size: 65, type: WidthType.PERCENTAGE },
              children: [keyValueCell(value || "N/A", false, compact)],
            }),
          ],
        })
    ),
    borders: tableBorders(),
  })
}

function contentAlignment(header: string): AlignmentValue {
  const key = header.toLowerCase()
  if (key.includes("qty") || key === "sr") return AlignmentType.CENTER
  if (key.includes("amount") || key.includes("value") || key.includes("price") || key.includes("total")) {
    return AlignmentType.RIGHT
  }
  return AlignmentType.LEFT
}

export function dataTable(headers: string[], rows: string[][], options: DataTableOptions = {}) {
  const compact = options.compact ?? false

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map(
          (header) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: header, bold: true, size: 20, font: FONT })],
                  alignment: contentAlignment(header),
                  spacing: { after: compact ? GAP_SMALL : 70 },
                }),
              ],
            })
        ),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map((value, index) => {
              const header = headers[index] || ""
              return (
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: String(value ?? ""), size: compact ? 19 : 20, font: FONT })],
                      alignment: contentAlignment(header),
                      spacing: { after: compact ? GAP_SMALL : 60 },
                    }),
                  ],
                })
              )
            }),
          })
      ),
    ],
    borders: tableBorders(),
  })
}

export function partyDetailsTable(invoice: any) {
  const exporterLines = [
    invoice.exporter?.name || "N/A",
    invoice.exporter?.address || "Address not provided",
    invoice.exporter?.iec ? `IEC: ${invoice.exporter.iec}` : "",
    invoice.exporter?.gstIN ? `GSTIN: ${invoice.exporter.gstIN}` : "",
  ].filter(Boolean)

  const buyerLines = [
    invoice.buyer?.name || "N/A",
    invoice.buyer?.address || "Address not provided",
    invoice.buyer?.country ? `Country: ${invoice.buyer.country}` : "",
    invoice.buyer?.buyerTaxId ? `Tax ID: ${invoice.buyer.buyerTaxId}` : "",
    invoice.buyer?.buyerVAT ? `VAT: ${invoice.buyer.buyerVAT}` : "",
    invoice.buyer?.buyerRegistrationNumber
      ? `Registration No: ${invoice.buyer.buyerRegistrationNumber}`
      : "",
  ].filter(Boolean)

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "EXPORTER / SHIPPER", bold: true, size: 20, font: FONT })],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: "BUYER / IMPORTER", bold: true, size: 20, font: FONT })],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            children: exporterLines.map(
              (line, index) =>
                new Paragraph({
                  children: [new TextRun({ text: line, size: 20, font: FONT, bold: index === 0 })],
                  spacing: { after: GAP_SMALL },
                })
            ),
          }),
          new TableCell({
            children: buyerLines.map(
              (line, index) =>
                new Paragraph({
                  children: [new TextRun({ text: line, size: 20, font: FONT, bold: index === 0 })],
                  spacing: { after: GAP_SMALL },
                })
            ),
          }),
        ],
      }),
    ],
    borders: tableBorders(),
  })
}

export function signatureBlock(exporterName: string) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 60, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: "" })],
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            },
          }),
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                text: "",
                spacing: { before: GAP_LARGE, after: GAP_SMALL },
              }),
              new Paragraph({
                children: [new TextRun({ text: `For ${exporterName || "Exporter"}`, size: 20, font: FONT })],
                alignment: AlignmentType.RIGHT,
                spacing: { after: 400 },
              }),
              new Paragraph({
                children: [new TextRun({ text: "________________________", size: 20, font: FONT })],
                alignment: AlignmentType.RIGHT,
                spacing: { after: 80 },
              }),
              new Paragraph({
                children: [new TextRun({ text: "Authorized Signatory", bold: true, size: 20, font: FONT })],
                alignment: AlignmentType.RIGHT,
              }),
            ],
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            },
          }),
        ],
      }),
    ],
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
  })
}

export function totalsBlock(rows: KeyValueRow[]) {
  const totalsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(([label, value]) => {
      const isTotal = label.toLowerCase().includes("total")
      return new TableRow({
        children: [
          new TableCell({
            width: { size: 62, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: label, size: 20, font: FONT, bold: isTotal })],
                alignment: AlignmentType.RIGHT,
                spacing: { after: GAP_SMALL },
              }),
            ],
          }),
          new TableCell({
            width: { size: 38, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: value, size: 20, font: FONT, bold: isTotal })],
                alignment: AlignmentType.RIGHT,
                spacing: { after: GAP_SMALL },
              }),
            ],
          }),
        ],
      })
    }),
    borders: tableBorders(),
  })

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: "" })],
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            },
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: [totalsTable],
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            },
          }),
        ],
      }),
    ],
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
  })
}
