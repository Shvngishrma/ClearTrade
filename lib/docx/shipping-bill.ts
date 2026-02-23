import { Document, Packer } from "docx"
import { heading, line } from "./common"

export async function generateShippingBillDOCX(invoice: any, sb: any) {
  const doc = new Document({
    sections: [
      {
        children: [
          heading("SHIPPING BILL (DRAFT)"),

          line(`Exporter IEC: ${invoice.exporter.iec}`),
          line(`Port of Loading: ${sb.portOfLoading}`),
          line(`Port of Discharge: ${sb.portOfDischarge}`),
          line(`Cargo Type: ${sb.cargoType}`),

          line("Items:"),

          ...invoice.items.map((item: any) =>
            line(`${item.description} | HS ${item.hsCode} | Qty ${item.quantity}`)
          ),

          line(`FOB Value: ${invoice.totalValue} ${invoice.currency}`),
        ],
      },
    ],
  })

  return await Packer.toBuffer(doc)
}
