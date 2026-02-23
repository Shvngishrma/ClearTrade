import { NextResponse } from "next/server"
import { getUnlocodeCountries, getUnlocodeEntries, getCountryByPortCode } from "@/lib/unlocode"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const type = (searchParams.get("type") || "").toLowerCase()

  if (type === "countries") {
    const countries = await getUnlocodeCountries()
    return NextResponse.json({ countries })
  }

  const country = searchParams.get("country") || undefined
  const query = searchParams.get("q") || undefined
  const limitRaw = searchParams.get("limit") || "50"
  const limit = Number.isNaN(Number(limitRaw)) ? 50 : Math.max(1, Math.min(500, Number(limitRaw)))

  const onlyPorts = searchParams.get("onlyPorts") === "false" ? false : true
  const ports = await getUnlocodeEntries({ country, query, limit, onlyPorts })
  return NextResponse.json({ ports })
}

export async function POST(req: Request) {
  const { portCode } = await req.json()
  if (!portCode) return NextResponse.json({ country: null })
  const country = await getCountryByPortCode(portCode)
  return NextResponse.json({ country })
}
