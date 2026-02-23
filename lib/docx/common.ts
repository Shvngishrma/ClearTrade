import { Paragraph, TextRun } from "docx"

export function heading(text: string) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        size: 28,
      }),
    ],
    spacing: { after: 300 },
  })
}

export function line(text: string) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        size: 22,
      }),
    ],
    spacing: { after: 120 },
  })
}
