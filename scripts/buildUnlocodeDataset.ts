import fs from "node:fs/promises"
import path from "node:path"
import JSZip from "jszip"

type TransportType = "SEA" | "AIR" | "RAIL"

type DatasetRow = {
  code: string
  name: string
  countryCode: string
  type: TransportType
}

const SOURCE_PAGE_URL = "https://service.unece.org/trade/locode/"
const FALLBACK_ZIP_NAME = "loc242csv.zip"
const PART_FILE_PATTERN = /UNLOCODE CodeListPart\d+\.csv/i

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      const nextChar = line[index + 1]
      if (inQuotes && nextChar === '"') {
        current += '"'
        index += 1
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

function mapFunctionCodeToTypes(functionCode: string): TransportType[] {
  const normalized = functionCode || ""
  const types: TransportType[] = []

  if (normalized.includes("1")) types.push("SEA")
  if (normalized.includes("4")) types.push("AIR")
  if (normalized.includes("2")) types.push("RAIL")

  return types
}

async function resolveLatestZipUrl(): Promise<string> {
  const response = await fetch(SOURCE_PAGE_URL)
  if (!response.ok) {
    return `${SOURCE_PAGE_URL}${FALLBACK_ZIP_NAME}`
  }

  const html = await response.text()
  const matches = Array.from(html.matchAll(/loc(\d+)csv\.zip/gi))
  if (matches.length === 0) {
    return `${SOURCE_PAGE_URL}${FALLBACK_ZIP_NAME}`
  }

  const newest = matches
    .map((match) => ({
      name: match[0].toLowerCase(),
      version: Number(match[1] || 0),
    }))
    .sort((left, right) => right.version - left.version)[0]

  return `${SOURCE_PAGE_URL}${newest.name}`
}

function createDatasetFileContent(rows: DatasetRow[]): string {
  const header = `export type UnlocodePort = {\n  code: string\n  name: string\n  countryCode: string\n  type: \"SEA\" | \"AIR\" | \"RAIL\"\n}\n\n`

  const bodyItems = rows
    .map(
      (row) =>
        `  { code: ${JSON.stringify(row.code)}, name: ${JSON.stringify(row.name)}, countryCode: ${JSON.stringify(row.countryCode)}, type: ${JSON.stringify(row.type)} },`
    )
    .join("\n")

  return `${header}export const UNLOCODE_PORTS: UnlocodePort[] = [\n${bodyItems}\n]\n`
}

async function main() {
  const zipUrl = await resolveLatestZipUrl()
  console.log(`Using UN/LOCODE source: ${zipUrl}`)

  const response = await fetch(zipUrl)
  if (!response.ok) {
    throw new Error(`Failed to download UN/LOCODE ZIP (${response.status})`)
  }

  const zipBuffer = await response.arrayBuffer()
  const zip = await JSZip.loadAsync(zipBuffer)

  const partFiles = Object.keys(zip.files).filter((name) => PART_FILE_PATTERN.test(name))
  if (partFiles.length === 0) {
    throw new Error("UN/LOCODE ZIP did not contain expected CodeListPart CSV files")
  }

  const dedupedRows = new Map<string, DatasetRow>()

  for (const fileName of partFiles) {
    const file = zip.file(fileName)
    if (!file) continue

    const text = await file.async("string")
    const lines = text.split(/\r?\n/)

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      const columns = parseCsvLine(line)
      const countryCode = (columns[1] || "").trim().toUpperCase()
      const location = (columns[2] || "").trim().toUpperCase()
      const name = (columns[3] || columns[4] || "").trim()
      const functionCode = (columns[6] || "").trim()

      if (!countryCode || !location || location.length !== 3 || !name) {
        continue
      }

      const code = `${countryCode}${location}`
      const types = mapFunctionCodeToTypes(functionCode)
      if (types.length === 0) {
        continue
      }

      for (const type of types) {
        const key = `${code}:${type}`
        if (!dedupedRows.has(key)) {
          dedupedRows.set(key, {
            code,
            name,
            countryCode,
            type,
          })
        }
      }
    }
  }

  const rows = Array.from(dedupedRows.values()).sort((left, right) => {
    if (left.countryCode !== right.countryCode) {
      return left.countryCode.localeCompare(right.countryCode)
    }
    if (left.code !== right.code) {
      return left.code.localeCompare(right.code)
    }
    if (left.type !== right.type) {
      return left.type.localeCompare(right.type)
    }
    return left.name.localeCompare(right.name)
  })

  const content = createDatasetFileContent(rows)
  const outputPath = path.resolve(process.cwd(), "lib/data/unlocodePorts.ts")
  await fs.writeFile(outputPath, content, "utf8")

  console.log(`Wrote ${rows.length} entries to ${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
