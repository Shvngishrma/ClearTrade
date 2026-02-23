import { Document, Packer } from "docx"
import { heading, line } from "./common"

export async function generatePackingListDOCX(invoice: any, packing: any) {
  const doc = new Document({
    sections: [
      {
        children: [
          heading("PACKING LIST"),

          line(`Exporter: ${invoice.exporter.name}`),
          line(`Buyer: ${invoice.buyer.name}`),

          line("Items:"),

          ...invoice.items.map((item: any) =>
            line(`${item.description} | Qty ${item.quantity}`)
          ),

          line(`Total Boxes: ${packing.totalBoxes}`),
          line(`Net Weight: ${packing.netWeight} kg`),
          line(`Gross Weight: ${packing.grossWeight} kg`),
        ],
      },
    ],
  })

  return await Packer.toBuffer(doc)
}
