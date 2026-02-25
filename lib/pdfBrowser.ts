import puppeteer from "puppeteer"

export async function launchBrowser() {
  try {
    return await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    })
  } catch {
    const chromiumModule = await import("@sparticuz/chromium")
    const chromium = chromiumModule.default
    const executablePath = await chromium.executablePath()

    return await puppeteer.launch({
      headless: true,
      executablePath,
      args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
    })
  }
}

export async function renderHtmlToPdfA4AutoScale(htmlContent: string): Promise<Uint8Array> {
  const browser = await launchBrowser()

  try {
    const page = await browser.newPage()

    try {
      await page.setContent(htmlContent, {
        waitUntil: "networkidle0",
      })

      const contentHeightPx = await page.evaluate(() => {
        const bodyHeight = document.body?.scrollHeight || 0
        const htmlHeight = document.documentElement?.scrollHeight || 0
        return Math.max(bodyHeight, htmlHeight)
      })

      const a4HeightPx = 1122
      const fitScale = Math.max(0.72, Math.min(1, a4HeightPx / Math.max(contentHeightPx, 1)))

      const pdfData = (await page.pdf({
        format: "A4",
        preferCSSPageSize: true,
        margin: {
          top: "0mm",
          right: "0mm",
          bottom: "0mm",
          left: "0mm",
        },
        printBackground: true,
        scale: fitScale,
      })) as Uint8Array

      return new Uint8Array(pdfData)
    } finally {
      await page.close()
    }
  } finally {
    await browser.close()
  }
}