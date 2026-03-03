import puppeteer from "puppeteer"

export async function launchBrowser() {
  const isProduction = process.env.VERCEL || process.env.NODE_ENV === "production"

  if (isProduction) {
    const launchErrors: string[] = []
    try {
      const chromiumModule = await import("@sparticuz/chromium")
      const chromium = chromiumModule.default
      const puppeteerCoreModule = await import("puppeteer-core")
      const puppeteerCore = puppeteerCoreModule.default

      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath())
      const launchConfigs = [
        {
          label: "puppeteer-core+chromium(headless:true)",
          options: {
            headless: true,
            executablePath,
            args: chromium.args,
          },
        },
        {
          label: "puppeteer-core+chromium(headless:shell)",
          options: {
            headless: "shell" as const,
            executablePath,
            args: chromium.args,
          },
        },
      ]

      for (const config of launchConfigs) {
        try {
          return await puppeteerCore.launch(config.options as any)
        } catch (error) {
          launchErrors.push(`${config.label}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    } catch (error) {
      launchErrors.push(`chromium setup: ${error instanceof Error ? error.message : String(error)}`)
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
  const a4PageCss = `
    @page { size: A4; margin: 20mm; }
    html, body { width: 100%; }
  `

  try {
    const page: any = await browser.newPage()

    try {
      await page.setContent(htmlContent, {
        waitUntil: "networkidle0",
      })

      await page.addStyleTag({ content: a4PageCss })

      const pdfData = (await page.pdf({
        format: "A4",
        preferCSSPageSize: false,
        margin: {
          top: "20mm",
          right: "20mm",
          bottom: "20mm",
          left: "20mm",
        },
        printBackground: true,
        scale: 0.94,
      })) as Uint8Array

      return new Uint8Array(pdfData)
    } finally {
      await page.close()
    }
  } finally {
    await browser.close()
  }
}