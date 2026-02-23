import JSZip from "jszip"

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
  loadedAt: number
}

const UNLOCODE_ZIP_URL = "https://service.unece.org/trade/locode/loc242csv.zip"
const UNLOCODE_PART_PATTERN = /UNLOCODE CodeListPart\d+\.csv/i

let cache: UnlocodeCache | null = null
let inFlight: Promise<UnlocodeCache> | null = null

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      const nextChar = line[i + 1]
      if (inQuotes && nextChar === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === "," && !inQuotes) {
      result.push(current)
      current = ""
      continue
    }

    current += char
  }

  result.push(current)
  return result
}

async function loadUnlocode(): Promise<UnlocodeCache> {
  if (cache) {
    return cache
  }
  if (inFlight) {
    return inFlight
  }

  inFlight = (async () => {
    const response = await fetch(UNLOCODE_ZIP_URL)
    if (!response.ok) {
      throw new Error(`Failed to fetch UN/LOCODE list: ${response.status}`)
    }

    const buffer = await response.arrayBuffer()
    const zip = await JSZip.loadAsync(buffer)

    const partFiles = Object.keys(zip.files).filter(name => UNLOCODE_PART_PATTERN.test(name))
    const entries: UnlocodeEntry[] = []
    const countryMap = new Map<string, string>()

    for (const name of partFiles) {
      const file = zip.file(name)
      if (!file) continue

      const text = await file.async("string")
      const lines = text.split(/\r?\n/)

      for (const line of lines) {
        if (!line.trim()) continue

        const columns = parseCsvLine(line)
        const country = (columns[1] || "").trim()
        const location = (columns[2] || "").trim()
        const nameValue = (columns[3] || columns[4] || "").trim()
        const functionCode = (columns[6] || "").trim()

        if (!country) continue

        if (!location) {
          if (nameValue.startsWith(".")) {
            countryMap.set(country, nameValue.replace(/^\./, ""))
          }
          continue
        }

        if (location.length !== 3 || !nameValue) {
          continue
        }

        const code = `${country}${location}`
        entries.push({
          code,
          country,
          location,
          name: nameValue,
          function: functionCode,
        })
      }
    }

    const countries = Array.from(countryMap.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name))

    cache = {
      entries,
      countries,
      loadedAt: Date.now(),
    }

    return cache
  })()

  try {
    return await inFlight
  } finally {
    inFlight = null
  }
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

  // UN/LOCODE function codes: 1 = port, 2 = rail terminal, 3 = road terminal, 4 = airport, 5 = postal, 6 = inland water, 7 = border
  // We want seaports (1) and airports (4)
  const portFunctionCodes = ["1", "4"]

  const filtered = data.entries.filter(entry => {
    if (normalizedCountry && entry.country !== normalizedCountry) {
      return false
    }
    if (onlyPorts && !portFunctionCodes.some(code => entry.function.includes(code))) {
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
