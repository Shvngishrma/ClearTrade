import puppeteer from "puppeteer"

export async function launchBrowser() {
  const isProduction = process.env.VERCEL || process.env.NODE_ENV === "production"

  if (isProduction) {
    const launchErrors: string[] = []

    try {
      const puppeteerCoreModule = await import("puppeteer-core")
      const puppeteerCore = puppeteerCoreModule.default
      const chromiumModule = await import("@sparticuz/chromium")
      const chromium = chromiumModule.default
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath())

      return await puppeteerCore.launch({
        headless: "shell",
        executablePath,
        args: chromium.args,
      })
    } catch (error) {
      launchErrors.push(`puppeteer-core+chromium: ${error instanceof Error ? error.message : String(error)}`)
    }

    try {
      return await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      })
    } catch (error) {
      launchErrors.push(`puppeteer bundled: ${error instanceof Error ? error.message : String(error)}`)
    }

    throw new Error(`Browser launch failed (${launchErrors.join(" | ")})`)
  }

  return await puppeteer.launch({
    headless: true,
  })
}

export async function renderHtmlToPdfA4AutoScale(htmlContent: string): Promise<Uint8Array> {
  const browser: any = await launchBrowser()

  try {
    const page: any = await browser.newPage()

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