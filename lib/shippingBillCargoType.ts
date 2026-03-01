export const SHIPPING_BILL_CARGO_TYPES = [
  "General",
  "Containerized",
  "Bulk",
  "Hazardous",
  "Perishable",
  "Project Cargo",
  "Others",
] as const

export type ShippingBillCargoType = (typeof SHIPPING_BILL_CARGO_TYPES)[number]

export function normalizeShippingBillCargoType(value: unknown): ShippingBillCargoType {
  if (typeof value !== "string") {
    return "General"
  }

  return SHIPPING_BILL_CARGO_TYPES.includes(value as ShippingBillCargoType)
    ? (value as ShippingBillCargoType)
    : "General"
}