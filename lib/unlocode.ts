import { UNLOCODE_PORTS, type UnlocodePort } from "@/lib/data/unlocodePorts"

type UnlocodeEntry = {
  code: string
  country: string
  location: string
  name: string
  function: string
}

type UnlocodeCountry = {
  code: string
  name: string
}

type UnlocodeCache = {
  entries: UnlocodeEntry[]
  countries: UnlocodeCountry[]
}

const cache: UnlocodeCache = (() => {
  const dedupedByCode = new Map<string, UnlocodePort>()
  UNLOCODE_PORTS.forEach((port) => {
    dedupedByCode.set(port.code.toUpperCase(), {
      ...port,
      code: port.code.toUpperCase(),
      countryCode: port.countryCode.toUpperCase(),
    })
  })

  const entries = Array.from(dedupedByCode.values()).map((port) => ({
    code: port.code,
    country: port.countryCode,
    location: port.code.slice(2),
    name: port.name,
    function: "1",
  }))

  const countryMap = new Map<string, string>()
  Array.from(dedupedByCode.values()).forEach((port) => {
    countryMap.set(port.countryCode, port.countryName)
  })

  const countries = Array.from(countryMap.entries())
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return { entries, countries }
})()

async function loadUnlocode(): Promise<UnlocodeCache> {
  return cache
}

export async function getUnlocodeCountries(): Promise<UnlocodeCountry[]> {
  const data = await loadUnlocode()
  return data.countries
}

export async function getUnlocodeEntries(options: {
  country?: string
  query?: string
  limit?: number
  onlyPorts?: boolean
}): Promise<UnlocodeEntry[]> {
  const { country, query, limit = 50, onlyPorts = true } = options
  const data = await loadUnlocode()
  const normalizedQuery = (query || "").trim().toLowerCase()
  const normalizedCountry = (country || "").trim().toUpperCase()

  const filtered = data.entries.filter(entry => {
    if (normalizedCountry && entry.country !== normalizedCountry) {
      return false
    }
    if (onlyPorts && !entry.function.includes("1")) {
      return false
    }
    if (!normalizedQuery) {
      return true
    }

    const codeMatch = entry.code.toLowerCase().includes(normalizedQuery)
    const nameMatch = entry.name.toLowerCase().includes(normalizedQuery)
    return codeMatch || nameMatch
  })

  return filtered.slice(0, limit)
}

export async function getCountryByPortCode(portCode: string): Promise<string | null> {
  const normalized = (portCode || "").trim().toUpperCase()
  if (!normalized) return null
  const data = await loadUnlocode()
  const entry = data.entries.find(e => e.code === normalized)
  if (!entry) return null
  const country = data.countries.find(c => c.code === entry.country)
  return country ? country.name : null
}

export async function isValidUnlocode(code: string): Promise<boolean> {
  const normalized = (code || "").trim().toUpperCase()
  if (!normalized) return false
  const data = await loadUnlocode()
  return data.entries.some(entry => entry.code === normalized)
}
