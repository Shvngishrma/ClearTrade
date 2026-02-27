export const signatureBlockStyles = `
    .signature-block {
      margin-top: 24px;
      margin-bottom: 16px;
      display: flex;
      justify-content: flex-end;
      page-break-inside: avoid;
      break-inside: avoid;
      page-break-before: avoid;
      break-before: avoid;
    }

    .signature-container {
      width: 280px;
      text-align: right;
    }

    .signature-label {
      font-size: 12px;
      color: #000000;
      font-weight: 500;
      margin-bottom: 24px;
      line-height: 1.4;
    }

    .signature-space {
      height: 80px;
      margin-bottom: 0;
    }

    .signature-title {
      font-size: 11px;
      font-weight: 600;
      color: #000000;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      border-top: 1px solid #111827;
      padding-top: 8px;
      display: inline-block;
      min-width: 190px;
    }

    .signature-name {
      font-size: 11px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 16px;
    }

    .signature-hash {
      font-size: 9px;
      color: #9ca3af;
      font-family: 'Courier New', monospace;
      word-break: break-all;
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid #f3f4f6;
      line-height: 1.3;
    }
`

export function renderSignatureBlock(exporter: any): string {
  return `
    <div class="signature-block">
      <div class="signature-container">
        <div class="signature-label">For ${exporter?.name || "Exporter"}</div>
        <div class="signature-space"></div>
        <div class="signature-title">Authorized Signatory</div>
      </div>
    </div>
  `
}
