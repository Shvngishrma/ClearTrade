# Code Citations

## License: MIT
https://github.com/orta/vscode-typescript-playground/blob/2f0fc525ab1e56c8b101209e6aae1063fe58e58f/src/web/sidebar/webviewProvider.ts

```
Done ✅

**Refactored Certificate of Origin HTML template** with full shared Invoice layout system compliance.

---

## Full Updated Template: [lib/htmlCertificateOfOriginTemplate.ts](lib/htmlCertificateOfOriginTemplate.ts)

```typescript
import { getDocumentAuditMetadata } from "@/lib/auditMetadata"
import { renderSignatureBlock, signatureBlockStyles } from "@/lib/renderSignatureBlock"
import {
  renderHeaderBlock,
  renderSectionTitle,
  sharedFooterStyles,
  sharedHeaderStyles,
  sharedPageStyles,
  sharedSectionStyles,
  sharedTableStyles,
} from "@/lib/renderDocumentLayout"

export function generateCertificateOfOriginHTML(invoice: any, coo: any): string {
  const exporter = invoice?.exporter || {}
  const buyer = invoice?.buyer || {}
  const layoutExporter = {
    ...exporter,
    iec: exporter?.iec || exporter?.iecNo,
    gstIN: exporter?.gstIN || exporter?.gstin,
  }
  const auditMetadata = getDocumentAuditMetadata("CERTIFICATE_OF_ORIGIN", invoice)

  const cooDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(coo?.createdAt || new Date()))

  const originCountry = coo?.originCountry || invoice?.countryOfOrigin || "N/A"

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate of Origin</title>
  <style>
    ${sharedPageStyles}
```


## License: MIT
https://github.com/orta/vscode-typescript-playground/blob/2f0fc525ab1e56c8b101209e6aae1063fe58e58f/src/web/sidebar/webviewProvider.ts

```
Done ✅

**Refactored Certificate of Origin HTML template** with full shared Invoice layout system compliance.

---

## Full Updated Template: [lib/htmlCertificateOfOriginTemplate.ts](lib/htmlCertificateOfOriginTemplate.ts)

```typescript
import { getDocumentAuditMetadata } from "@/lib/auditMetadata"
import { renderSignatureBlock, signatureBlockStyles } from "@/lib/renderSignatureBlock"
import {
  renderHeaderBlock,
  renderSectionTitle,
  sharedFooterStyles,
  sharedHeaderStyles,
  sharedPageStyles,
  sharedSectionStyles,
  sharedTableStyles,
} from "@/lib/renderDocumentLayout"

export function generateCertificateOfOriginHTML(invoice: any, coo: any): string {
  const exporter = invoice?.exporter || {}
  const buyer = invoice?.buyer || {}
  const layoutExporter = {
    ...exporter,
    iec: exporter?.iec || exporter?.iecNo,
    gstIN: exporter?.gstIN || exporter?.gstin,
  }
  const auditMetadata = getDocumentAuditMetadata("CERTIFICATE_OF_ORIGIN", invoice)

  const cooDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(coo?.createdAt || new Date()))

  const originCountry = coo?.originCountry || invoice?.countryOfOrigin || "N/A"

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate of Origin</title>
  <style>
    ${sharedPageStyles}
```


## License: MIT
https://github.com/orta/vscode-typescript-playground/blob/2f0fc525ab1e56c8b101209e6aae1063fe58e58f/src/web/sidebar/webviewProvider.ts

```
Done ✅

**Refactored Certificate of Origin HTML template** with full shared Invoice layout system compliance.

---

## Full Updated Template: [lib/htmlCertificateOfOriginTemplate.ts](lib/htmlCertificateOfOriginTemplate.ts)

```typescript
import { getDocumentAuditMetadata } from "@/lib/auditMetadata"
import { renderSignatureBlock, signatureBlockStyles } from "@/lib/renderSignatureBlock"
import {
  renderHeaderBlock,
  renderSectionTitle,
  sharedFooterStyles,
  sharedHeaderStyles,
  sharedPageStyles,
  sharedSectionStyles,
  sharedTableStyles,
} from "@/lib/renderDocumentLayout"

export function generateCertificateOfOriginHTML(invoice: any, coo: any): string {
  const exporter = invoice?.exporter || {}
  const buyer = invoice?.buyer || {}
  const layoutExporter = {
    ...exporter,
    iec: exporter?.iec || exporter?.iecNo,
    gstIN: exporter?.gstIN || exporter?.gstin,
  }
  const auditMetadata = getDocumentAuditMetadata("CERTIFICATE_OF_ORIGIN", invoice)

  const cooDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(coo?.createdAt || new Date()))

  const originCountry = coo?.originCountry || invoice?.countryOfOrigin || "N/A"

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate of Origin</title>
  <style>
    ${sharedPageStyles}
```


## License: MIT
https://github.com/orta/vscode-typescript-playground/blob/2f0fc525ab1e56c8b101209e6aae1063fe58e58f/src/web/sidebar/webviewProvider.ts

```
Done ✅

**Refactored Certificate of Origin HTML template** with full shared Invoice layout system compliance.

---

## Full Updated Template: [lib/htmlCertificateOfOriginTemplate.ts](lib/htmlCertificateOfOriginTemplate.ts)

```typescript
import { getDocumentAuditMetadata } from "@/lib/auditMetadata"
import { renderSignatureBlock, signatureBlockStyles } from "@/lib/renderSignatureBlock"
import {
  renderHeaderBlock,
  renderSectionTitle,
  sharedFooterStyles,
  sharedHeaderStyles,
  sharedPageStyles,
  sharedSectionStyles,
  sharedTableStyles,
} from "@/lib/renderDocumentLayout"

export function generateCertificateOfOriginHTML(invoice: any, coo: any): string {
  const exporter = invoice?.exporter || {}
  const buyer = invoice?.buyer || {}
  const layoutExporter = {
    ...exporter,
    iec: exporter?.iec || exporter?.iecNo,
    gstIN: exporter?.gstIN || exporter?.gstin,
  }
  const auditMetadata = getDocumentAuditMetadata("CERTIFICATE_OF_ORIGIN", invoice)

  const cooDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(coo?.createdAt || new Date()))

  const originCountry = coo?.originCountry || invoice?.countryOfOrigin || "N/A"

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate of Origin</title>
  <style>
    ${sharedPageStyles}
```


## License: MIT
https://github.com/orta/vscode-typescript-playground/blob/2f0fc525ab1e56c8b101209e6aae1063fe58e58f/src/web/sidebar/webviewProvider.ts

```
Done ✅

**Refactored Certificate of Origin HTML template** with full shared Invoice layout system compliance.

---

## Full Updated Template: [lib/htmlCertificateOfOriginTemplate.ts](lib/htmlCertificateOfOriginTemplate.ts)

```typescript
import { getDocumentAuditMetadata } from "@/lib/auditMetadata"
import { renderSignatureBlock, signatureBlockStyles } from "@/lib/renderSignatureBlock"
import {
  renderHeaderBlock,
  renderSectionTitle,
  sharedFooterStyles,
  sharedHeaderStyles,
  sharedPageStyles,
  sharedSectionStyles,
  sharedTableStyles,
} from "@/lib/renderDocumentLayout"

export function generateCertificateOfOriginHTML(invoice: any, coo: any): string {
  const exporter = invoice?.exporter || {}
  const buyer = invoice?.buyer || {}
  const layoutExporter = {
    ...exporter,
    iec: exporter?.iec || exporter?.iecNo,
    gstIN: exporter?.gstIN || exporter?.gstin,
  }
  const auditMetadata = getDocumentAuditMetadata("CERTIFICATE_OF_ORIGIN", invoice)

  const cooDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(coo?.createdAt || new Date()))

  const originCountry = coo?.originCountry || invoice?.countryOfOrigin || "N/A"

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate of Origin</title>
  <style>
    ${sharedPageStyles}
```


## License: MIT
https://github.com/orta/vscode-typescript-playground/blob/2f0fc525ab1e56c8b101209e6aae1063fe58e58f/src/web/sidebar/webviewProvider.ts

```
Done ✅

**Refactored Certificate of Origin HTML template** with full shared Invoice layout system compliance.

---

## Full Updated Template: [lib/htmlCertificateOfOriginTemplate.ts](lib/htmlCertificateOfOriginTemplate.ts)

```typescript
import { getDocumentAuditMetadata } from "@/lib/auditMetadata"
import { renderSignatureBlock, signatureBlockStyles } from "@/lib/renderSignatureBlock"
import {
  renderHeaderBlock,
  renderSectionTitle,
  sharedFooterStyles,
  sharedHeaderStyles,
  sharedPageStyles,
  sharedSectionStyles,
  sharedTableStyles,
} from "@/lib/renderDocumentLayout"

export function generateCertificateOfOriginHTML(invoice: any, coo: any): string {
  const exporter = invoice?.exporter || {}
  const buyer = invoice?.buyer || {}
  const layoutExporter = {
    ...exporter,
    iec: exporter?.iec || exporter?.iecNo,
    gstIN: exporter?.gstIN || exporter?.gstin,
  }
  const auditMetadata = getDocumentAuditMetadata("CERTIFICATE_OF_ORIGIN", invoice)

  const cooDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(coo?.createdAt || new Date()))

  const originCountry = coo?.originCountry || invoice?.countryOfOrigin || "N/A"

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate of Origin</title>
  <style>
    ${sharedPageStyles}
```


## License: MIT
https://github.com/orta/vscode-typescript-playground/blob/2f0fc525ab1e56c8b101209e6aae1063fe58e58f/src/web/sidebar/webviewProvider.ts

```
Done ✅

**Refactored Certificate of Origin HTML template** with full shared Invoice layout system compliance.

---

## Full Updated Template: [lib/htmlCertificateOfOriginTemplate.ts](lib/htmlCertificateOfOriginTemplate.ts)

```typescript
import { getDocumentAuditMetadata } from "@/lib/auditMetadata"
import { renderSignatureBlock, signatureBlockStyles } from "@/lib/renderSignatureBlock"
import {
  renderHeaderBlock,
  renderSectionTitle,
  sharedFooterStyles,
  sharedHeaderStyles,
  sharedPageStyles,
  sharedSectionStyles,
  sharedTableStyles,
} from "@/lib/renderDocumentLayout"

export function generateCertificateOfOriginHTML(invoice: any, coo: any): string {
  const exporter = invoice?.exporter || {}
  const buyer = invoice?.buyer || {}
  const layoutExporter = {
    ...exporter,
    iec: exporter?.iec || exporter?.iecNo,
    gstIN: exporter?.gstIN || exporter?.gstin,
  }
  const auditMetadata = getDocumentAuditMetadata("CERTIFICATE_OF_ORIGIN", invoice)

  const cooDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(coo?.createdAt || new Date()))

  const originCountry = coo?.originCountry || invoice?.countryOfOrigin || "N/A"

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate of Origin</title>
  <style>
    ${sharedPageStyles}
```


## License: MIT
https://github.com/orta/vscode-typescript-playground/blob/2f0fc525ab1e56c8b101209e6aae1063fe58e58f/src/web/sidebar/webviewProvider.ts

```
Done ✅

**Refactored Certificate of Origin HTML template** with full shared Invoice layout system compliance.

---

## Full Updated Template: [lib/htmlCertificateOfOriginTemplate.ts](lib/htmlCertificateOfOriginTemplate.ts)

```typescript
import { getDocumentAuditMetadata } from "@/lib/auditMetadata"
import { renderSignatureBlock, signatureBlockStyles } from "@/lib/renderSignatureBlock"
import {
  renderHeaderBlock,
  renderSectionTitle,
  sharedFooterStyles,
  sharedHeaderStyles,
  sharedPageStyles,
  sharedSectionStyles,
  sharedTableStyles,
} from "@/lib/renderDocumentLayout"

export function generateCertificateOfOriginHTML(invoice: any, coo: any): string {
  const exporter = invoice?.exporter || {}
  const buyer = invoice?.buyer || {}
  const layoutExporter = {
    ...exporter,
    iec: exporter?.iec || exporter?.iecNo,
    gstIN: exporter?.gstIN || exporter?.gstin,
  }
  const auditMetadata = getDocumentAuditMetadata("CERTIFICATE_OF_ORIGIN", invoice)

  const cooDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(coo?.createdAt || new Date()))

  const originCountry = coo?.originCountry || invoice?.countryOfOrigin || "N/A"

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate of Origin</title>
  <style>
    ${sharedPageStyles}
```

