import fs from "node:fs"
import path from "node:path"

const workspaceRoot = process.cwd()

const templateFiles = [
  "lib/htmlInvoiceTemplate.ts",
  "lib/htmlShippingBillTemplate.ts",
  "lib/htmlPackingListTemplate.ts",
  "lib/htmlComplianceReportTemplate.ts",
]

const requiredSharedImports = [
  "sharedHeaderStyles",
  "sharedSectionStyles",
  "sharedTableStyles",
  "sharedSummaryStyles",
  "sharedFooterStyles",
]

const prohibitedIndependentSelectors = [
  /\.document-title\s*\{/g,
  /\.section-title\s*\{/g,
  /\.signature-(?:block|container|label|space|title|name|hash)\s*\{/g,
  /\.summary-row\.total\s*\{/g,
]

const typographySelectors = ["document-title", "section-title", "signature-title", "summary-row.total"]

function read(filePath) {
  return fs.readFileSync(path.join(workspaceRoot, filePath), "utf8")
}

function checkRequiredImports(content) {
  const missing = []
  for (const token of requiredSharedImports) {
    if (!content.includes(token)) {
      missing.push(token)
    }
  }

  if (!content.includes("renderSignatureBlock")) {
    missing.push("renderSignatureBlock")
  }

  return missing
}

function findIndependentStyling(content) {
  const hits = []
  for (const pattern of prohibitedIndependentSelectors) {
    if (pattern.test(content)) {
      hits.push(pattern.source)
    }
    pattern.lastIndex = 0
  }
  return hits
}

function extractCssBlocks(content) {
  const blocks = []
  const styleMatch = content.match(/<style>[\s\S]*?<\/style>/)
  if (!styleMatch) return blocks

  const css = styleMatch[0]
  const regex = /(^|\n)\s*([.#][\w-]+(?:\s+[.#][\w-]+)?)\s*\{([\s\S]*?)\n\s*\}/g
  let match
  while ((match = regex.exec(css)) !== null) {
    const selector = match[2].trim()
    const body = match[3]
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ")
    if (!body) continue
    blocks.push({ selector, body })
  }
  return blocks
}

function extractFontSizes(content) {
  const sizes = []
  for (const selector of typographySelectors) {
    const escaped = selector.replace(".", "\\.")
    const regex = new RegExp(`\\.${escaped}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, "g")
    let match
    while ((match = regex.exec(content)) !== null) {
      const block = match[1]
      const fontSizeMatch = block.match(/font-size\s*:\s*([^;]+);/)
      if (fontSizeMatch) {
        sizes.push({ selector, fontSize: fontSizeMatch[1].trim() })
      }
    }
  }
  return sizes
}

const compliance = []
const duplicateMap = new Map()
const fontSizesBySelector = new Map()

for (const file of templateFiles) {
  const content = read(file)
  const missingImports = checkRequiredImports(content)
  const independentStyling = findIndependentStyling(content)
  const cssBlocks = extractCssBlocks(content)
  const typographySizes = extractFontSizes(content)

  compliance.push({
    file,
    missingImports,
    independentStyling,
  })

  for (const block of cssBlocks) {
    const key = `${block.selector}::{${block.body}}`
    const current = duplicateMap.get(key) || []
    current.push(file)
    duplicateMap.set(key, current)
  }

  for (const item of typographySizes) {
    const existing = fontSizesBySelector.get(item.selector) || new Set()
    existing.add(item.fontSize)
    fontSizesBySelector.set(item.selector, existing)
  }
}

const duplicateCssBlocks = Array.from(duplicateMap.entries())
  .map(([key, files]) => ({ key, files: Array.from(new Set(files)) }))
  .filter((entry) => entry.files.length > 1)
  .map((entry) => {
    const [selectorPart] = entry.key.split("::{")
    return {
      selector: selectorPart,
      files: entry.files,
    }
  })

const inconsistentFontSizes = Array.from(fontSizesBySelector.entries())
  .filter(([, values]) => values.size > 1)
  .map(([selector, values]) => ({
    selector,
    values: Array.from(values.values()),
  }))

const report = {
  generatedAt: new Date().toISOString(),
  templatesAudited: templateFiles,
  compliance,
  duplicateCssBlocks,
  inconsistentFontSizes,
}

console.log(JSON.stringify(report, null, 2))
