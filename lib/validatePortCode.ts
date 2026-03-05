import { UNLOCODE_PORTS } from "@/lib/data/unlocodePorts"

const VALID_PORT_CODES = new Set(UNLOCODE_PORTS.map((port) => port.code.toUpperCase()))

export function isValidPortCode(code: string | null | undefined): boolean {
  const normalized = String(code || "").trim().toUpperCase()
  if (!normalized) return false
  return VALID_PORT_CODES.has(normalized)
}
