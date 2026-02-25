"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import PrimaryButton from "../../../components/PrimaryButton"

const DOCUMENTS = [
  { key: "invoice", label: "Commercial Invoice" },
  { key: "packingList", label: "Packing List" },
  { key: "shippingBill", label: "Shipping Bill (Draft)" },
  { key: "declaration", label: "Declaration / Undertaking" },
  { key: "coo", label: "Certificate of Origin (Draft)" },
  { key: "insurance", label: "Insurance Declaration" },
  { key: "lc", label: "LC Supporting Documents" },
]

function DocumentsPage() {
  const router = useRouter()
  const [selectedDocs, setSelectedDocs] = useState<string[]>([])
  const today = new Date().toISOString().split("T")[0]
  const autoInvoiceSequenceRef = useRef<number | null>(null)

  function getAutoInvoiceNumber(invoiceDate: string) {
    if (autoInvoiceSequenceRef.current === null) {
      autoInvoiceSequenceRef.current = Math.floor(Math.random() * 9000) + 1000
    }

    const year = new Date(invoiceDate || today).getFullYear()
    const sequence = String(autoInvoiceSequenceRef.current).padStart(4, "0")
    return `INV/${year}/${sequence}`
  }

  const createEmptyCarton = (cartonNumber: number) => ({
    cartonNumber,
    quantity: "",
    marks: "",
    lengthCm: "",
    widthCm: "",
    heightCm: "",
    netWeightKg: "",
    grossWeightKg: "",
  })

  const [step, setStep] = useState<"select" | "details">("select")

  const [sharedDetails, setSharedDetails] = useState({
    invoiceNumber: "",
    invoiceDate: today,
    exporterName: "",
    exporterAddress: "",
    exporterIEC: "",
    exporterGSTIN: "",
    buyerName: "",
    buyerAddress: "",
    buyerCountry: "",
    incoterm: "",
    currency: "USD",
    paymentTerms: "Advance",
    portOfLoading: "",
    portOfDischarge: "",
    countryOfOrigin: "India",
    finalDestination: "",
    modeOfTransport: "Sea",
    vesselOrFlightNumber: "",
    blOrAwbNumber: "",
    containerNumber: "",
    marksAndNumbers: "",
    freight: "",
    insurance: "",
    fobValue: "",
    cifValue: "",
    totalValueINR: "",
  })

  const [docDetails, setDocDetails] = useState({
    packingList: {
      cartons: [createEmptyCarton(1)],
    },
    shippingBill: {
      portOfLoading: "",
      portOfDischarge: "",
      cargoType: "",
      schemeCode: "",
      drawback: false,
    },
    coo: {
      originCountry: "",
      chamberName: "",
    },
    insurance: {
      policyNumber: "",
      insuredValue: "",
    },
    lc: {
      lcNumber: "",
    },
  })

  const [items, setItems] = useState([
    {
      description: "",
      hsCode: "",
      quantity: "",
      unitPrice: "",
    },
  ])

  const [isGenerating, setIsGenerating] = useState(false)
  const [formError, setFormError] = useState("")

  type PortOption = {
    code: string
    name: string
    country: string
  }

  type FieldErrors = {
    invoiceNumber?: string
    invoiceDate?: string
    exporterName?: string
    exporterIEC?: string
    buyerName?: string
    incoterm?: string
    paymentTerms?: string
    packingList?: string
    portOfLoading?: string
    portOfDischarge?: string
    lcNumber?: string
    chamberName?: string
    insuredValue?: string
    freight?: string
    hsCodeErrors: string[]
  }

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({ hsCodeErrors: [] })

  const invoiceNumberPattern = /^INV\/\d{4}\/\d{4}$/

  const validPaymentTerms = ["Advance", "LC", "DA", "DP", "COD", "Credit"]

  const [portCountries, setPortCountries] = useState<Array<{ code: string; name: string }>>([])
  const [loadingCountry, setLoadingCountry] = useState("")
  const [dischargeCountry, setDischargeCountry] = useState("")
  const [loadingPortOptions, setLoadingPortOptions] = useState<PortOption[]>([])
  const [dischargePortOptions, setDischargePortOptions] = useState<PortOption[]>([])

  const packingCartons = docDetails.packingList.cartons || []

  const livePackingTotals = packingCartons.reduce(
    (acc, carton) => {
      const quantity = Number(carton.quantity) || 0
      const netWeight = Number(carton.netWeightKg) || 0
      const grossWeight = Number(carton.grossWeightKg) || 0
      const length = Number(carton.lengthCm) || 0
      const width = Number(carton.widthCm) || 0
      const height = Number(carton.heightCm) || 0

      const hasAllDimensions = length > 0 && width > 0 && height > 0
      const cartonCBM = hasAllDimensions ? (length * width * height) / 1_000_000 : 0

      acc.totalBoxes += 1
      acc.totalQuantity += quantity
      acc.totalNetWeight += netWeight
      acc.totalGrossWeight += grossWeight
      acc.totalCBM += cartonCBM
      return acc
    },
    {
      totalBoxes: 0,
      totalQuantity: 0,
      totalNetWeight: 0,
      totalGrossWeight: 0,
      totalCBM: 0,
    }
  )

  function updatePackingCarton(index: number, field: string, value: string) {
    const nextCartons = [...packingCartons]
    nextCartons[index] = {
      ...nextCartons[index],
      [field]: field === "marks" ? value : value.replace(/[^0-9.]/g, ""),
    }

    setDocDetails({
      ...docDetails,
      packingList: {
        ...docDetails.packingList,
        cartons: nextCartons,
      },
    })
  }

  function addPackingCarton() {
    const nextNumber = packingCartons.length + 1
    setDocDetails({
      ...docDetails,
      packingList: {
        ...docDetails.packingList,
        cartons: [...packingCartons, createEmptyCarton(nextNumber)],
      },
    })
  }

  function removePackingCarton(index: number) {
    const nextCartons = packingCartons
      .filter((_, i) => i !== index)
      .map((carton, i) => ({ ...carton, cartonNumber: i + 1 }))

    setDocDetails({
      ...docDetails,
      packingList: {
        ...docDetails.packingList,
        cartons: nextCartons.length > 0 ? nextCartons : [createEmptyCarton(1)],
      },
    })
  }

  function handleUpgradeError(status: number, message: string, code: string) {
    alert(`${message}\n\nPlease upgrade your plan to continue.`)
  }

  useEffect(() => {
    let cancelled = false

    async function loadCountries() {
      try {
        const res = await fetch("/api/unlocode?type=countries")
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) {
          setPortCountries(Array.isArray(data.countries) ? data.countries : [])
        }
      } catch {
        if (!cancelled) {
          setPortCountries([])
        }
      }
    }

    loadCountries()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadPorts() {
      const query = sharedDetails.portOfLoading.trim()
      const params = new URLSearchParams()
      // Restrict port of loading to India
      params.set("country", "IN")
      if (query) params.set("q", query)
      params.set("limit", "200")

      try {
        const res = await fetch(`/api/unlocode?${params.toString()}`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) {
          setLoadingPortOptions(Array.isArray(data.ports) ? data.ports : [])
        }
      } catch {
        if (!cancelled) {
          setLoadingPortOptions([])
        }
      }
    }

    loadPorts()

    return () => {
      cancelled = true
    }
  }, [sharedDetails.portOfLoading])

  useEffect(() => {
    let cancelled = false

    async function loadPorts() {
      const query = sharedDetails.portOfDischarge.trim()
      const params = new URLSearchParams()
      // Restrict port of discharge to selected final destination country
      if (sharedDetails.finalDestination) params.set("country", sharedDetails.finalDestination)
      if (query) params.set("q", query)
      params.set("limit", "200")

      try {
        const res = await fetch(`/api/unlocode?${params.toString()}`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) {
          setDischargePortOptions(Array.isArray(data.ports) ? data.ports : [])
        }
      } catch {
        if (!cancelled) {
          setDischargePortOptions([])
        }
      }
    }

    loadPorts()

    return () => {
      cancelled = true
    }
  }, [sharedDetails.portOfDischarge, sharedDetails.finalDestination])

  useEffect(() => {
    // Auto-detect country from port code for loading/discharge
    async function detectCountry(field: "portOfLoading" | "portOfDischarge", portCode: string) {
      if (!portCode) return
      try {
        const res = await fetch("/api/unlocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ portCode }),
        })
        if (!res.ok) return
        const data = await res.json()
        if (data.country) {
          if (field === "portOfLoading") setLoadingCountry(data.country)
          if (field === "portOfDischarge") setDischargeCountry(data.country)
        }
      } catch {}
    }
    detectCountry("portOfLoading", sharedDetails.portOfLoading)
    detectCountry("portOfDischarge", sharedDetails.portOfDischarge)
  }, [sharedDetails.portOfLoading, sharedDetails.portOfDischarge])

  useEffect(() => {
    const normalizedLoading = (sharedDetails.portOfLoading || "").trim().toUpperCase()
    const requiresDischarge = ["CIF", "CFR", "DDP"].includes((sharedDetails.incoterm || "").toUpperCase())
    const normalizedDischarge = requiresDischarge
      ? (sharedDetails.portOfDischarge || "").trim().toUpperCase()
      : ""

    setDocDetails((prev) => ({
      ...prev,
      shippingBill: {
        ...prev.shippingBill,
        portOfLoading: normalizedLoading,
        portOfDischarge: normalizedDischarge,
      },
    }))
  }, [sharedDetails.portOfLoading, sharedDetails.portOfDischarge, sharedDetails.incoterm])

  useEffect(() => {
    const normalizedCountryOfOrigin = (sharedDetails.countryOfOrigin || "").trim()

    setDocDetails((prev) => ({
      ...prev,
      coo: {
        ...prev.coo,
        originCountry: normalizedCountryOfOrigin,
      },
    }))
  }, [sharedDetails.countryOfOrigin])

  useEffect(() => {
    setSharedDetails((prev) => ({
      ...prev,
      invoiceNumber: getAutoInvoiceNumber(prev.invoiceDate),
    }))
  }, [sharedDetails.invoiceDate])

  function buildFieldErrors(): FieldErrors {
    const errors: FieldErrors = { hsCodeErrors: items.map(() => "") }

    const normalizedInvoiceNumber = (sharedDetails.invoiceNumber || "").trim().toUpperCase()
    if (!normalizedInvoiceNumber) {
      errors.invoiceNumber = "Invoice number is required."
    } else if (!invoiceNumberPattern.test(normalizedInvoiceNumber)) {
      errors.invoiceNumber = "Use format INV/YYYY/NNNN (example: INV/2026/0001)."
    }

    if (!sharedDetails.invoiceDate) {
      errors.invoiceDate = "Invoice date is required."
    }

    if (!sharedDetails.incoterm) {
      errors.incoterm = "Select an incoterm."
    }

    if (!sharedDetails.exporterName?.trim()) {
      errors.exporterName = "Exporter name is required."
    }

    const normalizedIEC = (sharedDetails.exporterIEC || "").trim()
    if (!normalizedIEC) {
      errors.exporterIEC = "Exporter IEC is required for AD/IEC validation."
    } else if (!/^\d{10}$/.test(normalizedIEC)) {
      errors.exporterIEC = "Exporter IEC must be 10 digits."
    } else {
      const normalizedLoadingPort = (sharedDetails.portOfLoading || "").trim().toUpperCase()

      const adCandidatesByIEC: Record<string, string[]> = {
        "0123456788": ["AD0001", "AD0002", "AD0005"],
        "0123456789": ["AD0003"],
      }

      const adCandidatesByPort: Record<string, string[]> = {
        INMAA: ["AD0001", "AD0005", "AD0002"],
        INMAA1: ["AD0001", "AD0005", "AD0002"],
        INMCT: ["AD0001", "AD0005"],
        INMCT1: ["AD0001", "AD0005"],
        INBOM: ["AD0002", "AD0005"],
        INBOM1: ["AD0002", "AD0005"],
        INDEL: ["AD0002"],
        INDEL1: ["AD0002"],
        INKOL: ["AD0005"],
        INKOL1: ["AD0005"],
      }

      const adOwnerIEC: Record<string, string> = {
        AD0001: "0123456788",
        AD0002: "0123456788",
        AD0003: "0123456789",
        AD0005: "0123456788",
      }

      const preferredByIEC = adCandidatesByIEC[normalizedIEC] || []
      const preferredByPort = adCandidatesByPort[normalizedLoadingPort] || []

      let resolvedAdCode = preferredByIEC.find(code => preferredByPort.includes(code))
      if (!resolvedAdCode && preferredByIEC.length > 0) {
        resolvedAdCode = preferredByIEC[0]
      }
      if (!resolvedAdCode && preferredByPort.length > 0) {
        resolvedAdCode = preferredByPort[0]
      }
      if (!resolvedAdCode) {
        resolvedAdCode = "AD0001"
      }

      const mappedIEC = adOwnerIEC[resolvedAdCode]
      if (mappedIEC && mappedIEC !== normalizedIEC) {
        errors.exporterIEC = `IEC/AD mismatch risk: ${resolvedAdCode} is registered to IEC ${mappedIEC}, but entered IEC is ${normalizedIEC}. Use matching IEC or change port/ad setup.`
      }
    }

    if (!sharedDetails.buyerName?.trim()) {
      errors.buyerName = "Buyer name is required."
    }

    const portOfLoading = (sharedDetails.portOfLoading || "").trim().toUpperCase()
    if (!portOfLoading) {
      errors.portOfLoading = "Enter a port of loading."
    } else if (
      loadingPortOptions.length > 0 &&
      !loadingPortOptions.some(option => option.code === portOfLoading)
    ) {
      errors.portOfLoading = "Select a valid UN/LOCODE for port of loading."
    }

    if (!validPaymentTerms.includes(sharedDetails.paymentTerms)) {
      errors.paymentTerms = "Payment term must be Advance, LC, DA, DP, COD, or Credit."
    }

    if (sharedDetails.paymentTerms === "LC" && !docDetails.lc?.lcNumber?.trim()) {
      errors.lcNumber = "LC number is required when payment term is LC."
    }

    if (selectedDocs.includes("coo")) {
      const chamberName = (docDetails.coo?.chamberName || "").trim()
      if (chamberName && chamberName.length < 3) {
        errors.chamberName = "Chamber name must be at least 3 characters."
      }
    }

    if (selectedDocs.includes("insurance")) {
      const insuredValueRaw = String(docDetails.insurance?.insuredValue || "").trim()
      if (insuredValueRaw) {
        const insuredValue = Number(insuredValueRaw)
        if (!Number.isFinite(insuredValue) || insuredValue <= 0) {
          errors.insuredValue = "Insured value must be a positive number (example: 11000)."
        } else if (totalValue > 0) {
          const minInsured = totalValue * 0.95
          const maxInsured = totalValue * 1.15
          if (insuredValue < minInsured || insuredValue > maxInsured) {
            errors.insuredValue = `Insurance must be 95-115% of invoice value (${minInsured.toFixed(2)} - ${maxInsured.toFixed(2)}).`
          }
        }
      }
    }

    if (totalValue > 0 && sharedDetails.incoterm) {
      const incoterm = sharedDetails.incoterm.substring(0, 3).toUpperCase()
      const invoiceFreight = Number(sharedDetails.freight) || 0
      const maxAllowedFreight = totalValue * 0.2

      if (invoiceFreight > maxAllowedFreight) {
        errors.freight = `Freight exceeds 20% of invoice value (${maxAllowedFreight.toFixed(2)} max).`
      } else if (incoterm === "FOB" && invoiceFreight > 0) {
        errors.freight = "FOB: Freight should be 0. Buyer pays freight beyond port of loading."
      } else if ((incoterm === "CIF" || incoterm === "CFR") && invoiceFreight <= 0) {
        errors.freight = `${incoterm}: Freight must be greater than 0.`
      }
    }

    if (selectedDocs.includes("packingList")) {
      if (!packingCartons.length) {
        errors.packingList = "Add at least one carton row for Packing List."
      } else {
        const hasInvalidCarton = packingCartons.some((carton) => {
          const quantity = Number(carton.quantity)
          const netWeight = Number(carton.netWeightKg)
          const grossWeight = Number(carton.grossWeightKg)

          return (
            !Number.isFinite(quantity) ||
            quantity <= 0 ||
            !Number.isFinite(netWeight) ||
            netWeight <= 0 ||
            !Number.isFinite(grossWeight) ||
            grossWeight <= 0
          )
        })

        if (hasInvalidCarton) {
          errors.packingList = "Each carton must include valid quantity, net and gross weight values (> 0)."
        }
      }
    }

    const incotermRequiresDischarge = ["CIF", "CFR", "DDP"].includes(sharedDetails.incoterm)
    const portOfDischarge = (sharedDetails.portOfDischarge || "").trim().toUpperCase()
    if (incotermRequiresDischarge && !portOfDischarge) {
      errors.portOfDischarge = "Port of discharge is required for CIF/CFR/DDP incoterms."
    } else if (
      portOfDischarge &&
      dischargePortOptions.length > 0 &&
      !dischargePortOptions.some(option => option.code === portOfDischarge)
    ) {
      errors.portOfDischarge = "Select a valid UN/LOCODE for port of discharge."
    }

    items.forEach((item, index) => {
      const hs = (item.hsCode || "").trim()
      if (hs && !/^\d{6,8}$/.test(hs)) {
        errors.hsCodeErrors[index] = "HS code must be 6-8 digits."
      }
    })

    return errors
  }

  function validateGenerateInput(): boolean {
    const errors = buildFieldErrors()
    setFieldErrors(errors)

    const hasErrors = Boolean(
      errors.invoiceNumber ||
      errors.invoiceDate ||
      errors.incoterm ||
      errors.exporterName ||
      errors.exporterIEC ||
      errors.buyerName ||
      errors.paymentTerms ||
      errors.packingList ||
      errors.portOfLoading ||
      errors.portOfDischarge ||
      errors.lcNumber ||
      errors.chamberName ||
      errors.insuredValue ||
      errors.freight ||
      errors.hsCodeErrors.some(Boolean)
    )

    return !hasErrors
  }

  useEffect(() => {
    if (step !== "details") return
    setFieldErrors(buildFieldErrors())
  }, [
    step,
    selectedDocs,
    items,
    packingCartons,
    sharedDetails.invoiceNumber,
    sharedDetails.invoiceDate,
    sharedDetails.incoterm,
    sharedDetails.exporterName,
    sharedDetails.exporterIEC,
    sharedDetails.buyerName,
    sharedDetails.portOfLoading,
    sharedDetails.portOfDischarge,
    sharedDetails.freight,
    sharedDetails.paymentTerms,
    docDetails.coo?.chamberName,
    docDetails.insurance?.insuredValue,
    docDetails.lc?.lcNumber,
    loadingPortOptions,
    dischargePortOptions,
  ])

  function formatComplianceError(error: any): string | null {
    if (!error || error.error !== "COMPLIANCE_FAILED") {
      return null
    }

    const blockers = Array.isArray(error.blockers) ? error.blockers : []
    if (blockers.length === 0) {
      return error.message || "Compliance checks failed. Please review your inputs."
    }

    const messageByCode: Record<string, string> = {
      LC_REQUIRED_BUT_MISSING: "Payment term is LC, but LC number is missing. Add the LC number.",
      INVALID_HS_CODE_FORMAT: "HS code must be 6-8 digits. Fix the item HS code.",
      INVALID_PORT_CODE: "Port of loading is invalid or missing. Enter a valid port code (example: INMAA).",
      INVALID_PAYMENT_TERM: "Payment term is invalid. Use Advance, LC, DA, DP, COD, or Credit.",
      INCOTERM_PORT_MISMATCH: "Incoterm requires port of discharge. Provide the discharge port.",
      LC_CHECK_ERROR: "LC validation failed due to an internal error. Please try again.",
      TRADE_CHECK_ERROR: "Trade classification failed due to an internal error. Please try again.",
      PORT_CHECK_ERROR: "Port validation failed due to an internal error. Please try again.",
      REALIZATION_CHECK_ERROR: "FEMA realization validation failed due to an internal error. Please try again.",
      CONSISTENCY_CHECK_ERROR: "Consistency validation failed due to an internal error. Please try again.",
    }

    const friendly = blockers.map((blocker: any) => {
      if (blocker?.code && messageByCode[blocker.code]) {
        return messageByCode[blocker.code]
      }
      if (blocker?.message) {
        return blocker.message
      }
      return "Compliance check failed. Please review your inputs."
    })

    const unique = Array.from(new Set(friendly))
    return `Compliance checks failed:\n- ${unique.join("\n- ")}`
  }

  function toggleDoc(key: string) {
    setSelectedDocs(prev =>
      prev.includes(key)
        ? prev.filter(d => d !== key)
        : [...prev, key]
    )
  }

  function updateItem(index: number, field: string, value: string) {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    setItems(updated)
  }

  function addItem() {
    setItems([
      ...items,
      { description: "", hsCode: "", quantity: "", unitPrice: "" },
    ])
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index))
  }

  const totalValue = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unitPrice) || 0
    return sum + qty * price
  }, 0)

  // Smart Auto Calculation based on Incoterm
  const freight = Number(sharedDetails.freight) || 0
  const insurance = Number(sharedDetails.insurance) || 0
  
  let calculatedFOB = totalValue
  let calculatedCIF = null
  
  if (sharedDetails.incoterm === "FOB") {
    calculatedFOB = totalValue
    calculatedCIF = null
  } else if (sharedDetails.incoterm === "CIF") {
    calculatedFOB = totalValue
    calculatedCIF = totalValue + freight + insurance
  } else if (sharedDetails.incoterm === "CFR" || sharedDetails.incoterm === "CNF") {
    calculatedFOB = totalValue
    calculatedCIF = totalValue + freight
  } else if (sharedDetails.incoterm === "EXW") {
    calculatedFOB = totalValue
    calculatedCIF = freight > 0 || insurance > 0 ? totalValue + freight + insurance : null
  }

  const formattedTotalValue = new Intl.NumberFormat('en-US').format(totalValue)
  const formattedFOB = new Intl.NumberFormat('en-US').format(calculatedFOB)
  const formattedCIF = calculatedCIF ? new Intl.NumberFormat('en-US').format(calculatedCIF) : 'N/A'
  const formErrorLines = formError
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)

  async function handleGenerate() {
    setFormError("")
    const isValid = validateGenerateInput()
    if (!isValid) {
      setFormError("Please fix the highlighted fields above and try again.")
      if (typeof window !== "undefined") {
        requestAnimationFrame(() => {
          const firstInvalid = document.querySelector(".border-red-500") as HTMLElement | null
          firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" })
          firstInvalid?.focus?.()
        })
      }
      return
    }

    setIsGenerating(true)

    try {
      const normalizedPackingCartons = packingCartons.map((carton, index) => ({
        cartonNumber: index + 1,
        quantity: Number(carton.quantity),
        marks: carton.marks?.trim() || null,
        lengthCm: carton.lengthCm ? Number(carton.lengthCm) : null,
        widthCm: carton.widthCm ? Number(carton.widthCm) : null,
        heightCm: carton.heightCm ? Number(carton.heightCm) : null,
        netWeightKg: Number(carton.netWeightKg),
        grossWeightKg: Number(carton.grossWeightKg),
      }))

      const payloadDocDetails = {
        ...docDetails,
        packingList: {
          ...docDetails.packingList,
          cartons: normalizedPackingCartons,
        },
      }

      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          selectedDocs,
          sharedDetails: {
            ...sharedDetails,
            invoiceNumber: sharedDetails.invoiceNumber.trim().toUpperCase(),
          },
          items,
          docDetails: payloadDocDetails,
        }),
      })

      if (res.status === 429) {
        const error = await res.json()
        handleUpgradeError(429, error.message || "Free limit exceeded", "LIMIT_EXCEEDED")
        setIsGenerating(false)
        return
      }

      if (res.status === 401) {
        const rawBody = await res.text().catch(() => "")
        setFormError(rawBody || "Session expired. Please sign in again.")
        router.push("/login")
        return
      }

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        const complianceMessage = formatComplianceError(error)

        const detailMessage = Array.isArray(error?.details)
          ? error.details.filter(Boolean).join("\n")
          : ""

        const validationMessage = Array.isArray(error?.errors)
          ? error.errors
              .map((entry: any) => entry?.message || entry?.detail || "")
              .filter(Boolean)
              .join("\n")
          : ""

        const isValidationError = error?.error === "VALIDATION_ERROR"

        throw new Error(
          complianceMessage ||
            (isValidationError ? validationMessage : "") ||
            error?.message ||
            validationMessage ||
            detailMessage ||
            `Generation failed (HTTP ${res.status})`
        )
      }

      const { invoiceId, status } = await res.json()

      if (!invoiceId) {
        throw new Error("Invoice ID missing after generation")
      }

      const statusParam = status ? `&status=${encodeURIComponent(String(status))}` : ""
      router.push(`/documents/download?invoiceId=${invoiceId}${statusParam}`)

    } catch (err: any) {
      setFormError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="documents-page px-4 sm:px-6 lg:px-8 pt-8 pb-10 max-w-7xl text-gray-900 dark:text-zinc-100 rounded-2xl">
      <h1 className="text-2xl font-semibold mb-2">
        Generate export documents
      </h1>

      <p className="text-gray-500 mb-8">
        Select the documents you want to generate. You can choose multiple.
      </p>

      {/* Document selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DOCUMENTS.map(doc => {
            const active = selectedDocs.includes(doc.key)

            return (
              <button
                key={doc.key}
                onClick={() => toggleDoc(doc.key)}
                className={`p-4 rounded-lg border text-left transition
                  ${active
                    ? "border-gray-900 bg-gray-900 text-white shadow-sm ring-2 ring-gray-900/20 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100 dark:ring-zinc-200/40"
                    : "border-gray-200 bg-white hover:border-gray-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500"
                  }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">
                    {doc.label}
                  </div>
                </div>
                {!active && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-zinc-400">
                    Click to include
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Continue */}
        <div className="mt-10">
          <PrimaryButton
            disabled={selectedDocs.length === 0}
            onClick={() => setStep("details")}
          >
            Continue
          </PrimaryButton>
        </div>

        {step === "details" && (
          <div className="mt-16 max-w-3xl">

            <h2 className="text-xl font-semibold mb-6">
              Shared details
            </h2>

            <div className="mb-10">
              <h3 className="font-medium mb-4">Invoice</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <input
                    placeholder="Auto-generated"
                    readOnly
                    className={`border rounded-md px-3 py-2 w-full bg-gray-50 text-gray-700 cursor-not-allowed ${fieldErrors.invoiceNumber ? "border-red-500" : ""}`}
                    value={sharedDetails.invoiceNumber}
                  />
                  {fieldErrors.invoiceNumber && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.invoiceNumber}</p>
                  )}
                </div>

                <div>
                  <input
                    type="date"
                    className={`border rounded-md px-3 py-2 w-full ${fieldErrors.invoiceDate ? "border-red-500" : ""}`}
                    value={sharedDetails.invoiceDate}
                    onChange={e =>
                      setSharedDetails({ ...sharedDetails, invoiceDate: e.target.value })
                    }
                  />
                  {fieldErrors.invoiceDate && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.invoiceDate}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Exporter */}
            <div className="mb-10">
              <h3 className="font-medium mb-4">Exporter</h3>

              <div className="grid grid-cols-1 gap-4">
                <input
                  placeholder="Exporter name"
                  className={`border rounded-md px-3 py-2 ${fieldErrors.exporterName ? "border-red-500" : ""}`}
                  value={sharedDetails.exporterName}
                  onChange={e =>
                    setSharedDetails({ ...sharedDetails, exporterName: e.target.value })
                  }
                />
                {fieldErrors.exporterName && (
                  <p className="text-xs text-red-500">{fieldErrors.exporterName}</p>
                )}

                <textarea
                  placeholder="Exporter address"
                  className="border rounded-md px-3 py-2"
                  value={sharedDetails.exporterAddress}
                  onChange={e =>
                    setSharedDetails({ ...sharedDetails, exporterAddress: e.target.value })
                  }
                />

                <input
                  placeholder="IEC"
                  className={`border rounded-md px-3 py-2 ${fieldErrors.exporterIEC ? "border-red-500" : ""}`}
                  value={sharedDetails.exporterIEC}
                  onChange={e =>
                    setSharedDetails({ ...sharedDetails, exporterIEC: e.target.value })
                  }
                />
                {fieldErrors.exporterIEC && (
                  <p className="text-xs text-red-500">{fieldErrors.exporterIEC}</p>
                )}

                <input
                  placeholder="GSTIN (optional)"
                  className="border rounded-md px-3 py-2"
                  value={sharedDetails.exporterGSTIN}
                  onChange={e =>
                    setSharedDetails({ ...sharedDetails, exporterGSTIN: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Buyer */}
            <div className="mb-10">
              <h3 className="font-medium mb-4">Buyer</h3>

              <div className="grid grid-cols-1 gap-4">
                <input
                  placeholder="Buyer name"
                  className={`border rounded-md px-3 py-2 ${fieldErrors.buyerName ? "border-red-500" : ""}`}
                  value={sharedDetails.buyerName}
                  onChange={e =>
                    setSharedDetails({ ...sharedDetails, buyerName: e.target.value })
                  }
                />
                {fieldErrors.buyerName && (
                  <p className="text-xs text-red-500">{fieldErrors.buyerName}</p>
                )}

                <textarea
                  placeholder="Buyer address"
                  className="border rounded-md px-3 py-2"
                  value={sharedDetails.buyerAddress}
                  onChange={e =>
                    setSharedDetails({ ...sharedDetails, buyerAddress: e.target.value })
                  }
                />

                <select
                  className="border rounded-md px-3 py-2"
                  value={sharedDetails.buyerCountry}
                  onChange={e =>
                    setSharedDetails({ ...sharedDetails, buyerCountry: e.target.value })
                  }
                >
                  <option value="">Select buyer country</option>
                  {portCountries.map(country => (
                    <option key={country.code} value={country.code}>
                      {country.name} ({country.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Shipment */}
            <div className="mb-10">
              <h3 className="font-medium mb-4">Shipment & Terms</h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <select
                    className={`border rounded-md px-3 py-2 w-full ${fieldErrors.incoterm ? "border-red-500" : ""}`}
                    value={sharedDetails.incoterm}
                    onChange={e =>
                      setSharedDetails({ ...sharedDetails, incoterm: e.target.value })
                    }
                  >
                    <option value="">Select Incoterm</option>
                    <option value="FOB">FOB (Free On Board)</option>
                    <option value="CIF">CIF (Cost, Insurance & Freight)</option>
                    <option value="CFR">CFR (Cost & Freight)</option>
                    <option value="EXW">EXW (Ex Works)</option>
                    <option value="FCA">FCA (Free Carrier)</option>
                    <option value="DAP">DAP (Delivered At Place)</option>
                  </select>
                  {fieldErrors.incoterm && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.incoterm}</p>
                  )}
                </div>

                <select
                  className="border rounded-md px-3 py-2"
                  value={sharedDetails.currency}
                  onChange={e =>
                    setSharedDetails({ ...sharedDetails, currency: e.target.value })
                  }
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="AED">AED</option>
                </select>

                <div>
                  <select
                    className={`border rounded-md px-3 py-2 w-full ${fieldErrors.paymentTerms ? "border-red-500" : ""}`}
                    value={sharedDetails.paymentTerms}
                    onChange={e =>
                      setSharedDetails({ ...sharedDetails, paymentTerms: e.target.value })
                    }
                  >
                    <option value="Advance">Advance Payment</option>
                    <option value="LC">Letter of Credit (LC)</option>
                    <option value="DA">Documents Against Acceptance (DA)</option>
                    <option value="DP">Documents Against Payment (DP)</option>
                    <option value="COD">Cash Against Documents (COD)</option>
                    <option value="Credit">Credit</option>
                  </select>
                  {fieldErrors.paymentTerms && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.paymentTerms}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <select
                  className="border rounded-md px-3 py-2"
                  value={sharedDetails.countryOfOrigin}
                  onChange={e =>
                    setSharedDetails({ ...sharedDetails, countryOfOrigin: e.target.value })
                  }
                >
                  <option value="">Select country of origin</option>
                  {portCountries.map(country => (
                    <option key={country.code} value={country.code}>
                      {country.name} ({country.code})
                    </option>
                  ))}
                </select>

                <select
                  className="border rounded-md px-3 py-2"
                  value={sharedDetails.finalDestination}
                  onChange={e =>
                    setSharedDetails({ ...sharedDetails, finalDestination: e.target.value })
                  }
                >
                  <option value="">Select final destination</option>
                  {portCountries.map(country => (
                    <option key={country.code} value={country.code}>
                      {country.name} ({country.code})
                    </option>
                  ))}
                </select>

                <div>
                  <select
                    className={`border rounded-md px-3 py-2 w-full ${fieldErrors.portOfLoading ? "border-red-500" : ""}`}
                    value={sharedDetails.portOfLoading}
                    onChange={e =>
                      setSharedDetails({ ...sharedDetails, portOfLoading: e.target.value.toUpperCase() })
                    }
                  >
                    <option value="">Select port of loading</option>
                    {loadingPortOptions.map(option => (
                      <option key={option.code} value={option.code}>
                        {option.code} - {option.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.portOfLoading && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.portOfLoading}</p>
                  )}
                </div>

                <div>
                  <select
                    className={`border rounded-md px-3 py-2 w-full ${fieldErrors.portOfDischarge ? "border-red-500" : ""}`}
                    value={sharedDetails.portOfDischarge}
                    onChange={e =>
                      setSharedDetails({ ...sharedDetails, portOfDischarge: e.target.value.toUpperCase() })
                    }
                  >
                    <option value="">Select port of discharge</option>
                    {dischargePortOptions.map(option => (
                      <option key={option.code} value={option.code}>
                        {option.code} - {option.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.portOfDischarge && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.portOfDischarge}</p>
                  )}
                </div>

                <select
                  className="border rounded-md px-3 py-2"
                  value={sharedDetails.modeOfTransport}
                  onChange={e =>
                    setSharedDetails({ ...sharedDetails, modeOfTransport: e.target.value })
                  }
                >
                  <option value="Sea">Sea</option>
                  <option value="Air">Air</option>
                  <option value="Road">Road</option>
                  <option value="Rail">Rail</option>
                  <option value="Courier">Courier</option>
                </select>

                <input
                  placeholder="Vessel / Flight (optional)"
                  className="border rounded-md px-3 py-2"
                  value={sharedDetails.vesselOrFlightNumber}
                  onChange={e =>
                    setSharedDetails({ ...sharedDetails, vesselOrFlightNumber: e.target.value })
                  }
                />

                <input
                  placeholder="BL / AWB No (optional)"
                  className="border rounded-md px-3 py-2"
                  value={sharedDetails.blOrAwbNumber}
                  onChange={e =>
                    setSharedDetails({ ...sharedDetails, blOrAwbNumber: e.target.value })
                  }
                />

                <input
                  placeholder="Container No (optional)"
                  className="border rounded-md px-3 py-2"
                  value={sharedDetails.containerNumber}
                  onChange={e =>
                    setSharedDetails({ ...sharedDetails, containerNumber: e.target.value })
                  }
                />

                <input
                  placeholder="Marks & Numbers (optional)"
                  className="border rounded-md px-3 py-2"
                  value={sharedDetails.marksAndNumbers}
                  onChange={e =>
                    setSharedDetails({ ...sharedDetails, marksAndNumbers: e.target.value })
                  }
                />

                <input
                  placeholder="Freight Cost (optional)"
                  type="number"
                  className={`border rounded-md px-3 py-2 ${fieldErrors.freight ? "border-red-500" : ""}`}
                  value={sharedDetails.freight}
                  onChange={e =>
                    setSharedDetails({ ...sharedDetails, freight: e.target.value })
                  }
                />
                {fieldErrors.freight && (
                  <p className="text-xs text-red-500 sm:col-span-2">{fieldErrors.freight}</p>
                )}

                <input
                  placeholder="Insurance Cost (optional)"
                  type="number"
                  className="border rounded-md px-3 py-2"
                  value={sharedDetails.insurance}
                  onChange={e =>
                    setSharedDetails({ ...sharedDetails, insurance: e.target.value })
                  }
                />

                <input
                  placeholder="FOB Value (optional)"
                  type="number"
                  className="border rounded-md px-3 py-2"
                  value={sharedDetails.fobValue}
                  onChange={e =>
                    setSharedDetails({ ...sharedDetails, fobValue: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Document-specific details */}
            <div className="mt-16 max-w-3xl space-y-12">

              {selectedDocs.includes("packingList") && (
                <div>
                  <h3 className="font-medium mb-4">Packing List</h3>
                  <div className="space-y-4">
                    {packingCartons.map((carton, index) => {
                      const length = Number(carton.lengthCm) || 0
                      const width = Number(carton.widthCm) || 0
                      const height = Number(carton.heightCm) || 0
                      const rowCBM =
                        length > 0 && width > 0 && height > 0
                          ? ((length * width * height) / 1_000_000).toFixed(6)
                          : "-"

                      return (
                        <div
                          key={index}
                          className="rounded-md border border-gray-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                              Carton {index + 1}
                            </p>
                            <button
                              type="button"
                              onClick={() => removePackingCarton(index)}
                              className="px-3 py-1.5 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:hover:bg-red-600"
                              disabled={packingCartons.length <= 1}
                            >
                              Remove
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">Carton #</label>
                              <input
                                type="number"
                                min="1"
                                className="border rounded-md px-2 py-2 w-full dark:[color-scheme:dark]"
                                value={carton.cartonNumber}
                                onChange={e => updatePackingCarton(index, "cartonNumber", e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">Qty</label>
                              <input
                                type="number"
                                min="1"
                                className="border rounded-md px-2 py-2 w-full dark:[color-scheme:dark]"
                                value={carton.quantity}
                                onChange={e => updatePackingCarton(index, "quantity", e.target.value)}
                              />
                            </div>
                            <div className="sm:col-span-2 lg:col-span-2">
                              <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">Marks</label>
                              <input
                                className="border rounded-md px-2 py-2 w-full"
                                value={carton.marks}
                                onChange={e => updatePackingCarton(index, "marks", e.target.value)}
                              />
                            </div>

                            <div>
                              <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">L (cm)</label>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                className="border rounded-md px-2 py-2 w-full dark:[color-scheme:dark]"
                                value={carton.lengthCm}
                                onChange={e => updatePackingCarton(index, "lengthCm", e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">W (cm)</label>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                className="border rounded-md px-2 py-2 w-full dark:[color-scheme:dark]"
                                value={carton.widthCm}
                                onChange={e => updatePackingCarton(index, "widthCm", e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">H (cm)</label>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                className="border rounded-md px-2 py-2 w-full dark:[color-scheme:dark]"
                                value={carton.heightCm}
                                onChange={e => updatePackingCarton(index, "heightCm", e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">Net Wt (kg)</label>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                className="border rounded-md px-2 py-2 w-full dark:[color-scheme:dark]"
                                value={carton.netWeightKg}
                                onChange={e => updatePackingCarton(index, "netWeightKg", e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">Gross Wt (kg)</label>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                className="border rounded-md px-2 py-2 w-full dark:[color-scheme:dark]"
                                value={carton.grossWeightKg}
                                onChange={e => updatePackingCarton(index, "grossWeightKg", e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">CBM</label>
                              <div className="border rounded-md px-2 py-2 w-full bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200">
                                {rowCBM}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <PrimaryButton
                      type="button"
                      onClick={addPackingCarton}
                      className="px-3 py-2 text-sm"
                    >
                      + Add Carton
                    </PrimaryButton>
                  </div>

                  {fieldErrors.packingList && (
                    <p className="text-xs text-red-500 mt-2">{fieldErrors.packingList}</p>
                  )}

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="border rounded-md px-3 py-2 bg-gray-50">
                      <p className="text-xs text-gray-500">Total Boxes</p>
                      <p className="text-sm font-medium text-gray-900">{livePackingTotals.totalBoxes}</p>
                    </div>
                    <div className="border rounded-md px-3 py-2 bg-gray-50">
                      <p className="text-xs text-gray-500">Total Quantity</p>
                      <p className="text-sm font-medium text-gray-900">{livePackingTotals.totalQuantity}</p>
                    </div>
                    <div className="border rounded-md px-3 py-2 bg-gray-50">
                      <p className="text-xs text-gray-500">Total Net Weight (kg)</p>
                      <p className="text-sm font-medium text-gray-900">{livePackingTotals.totalNetWeight.toFixed(3)}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="border rounded-md px-3 py-2 bg-gray-50">
                      <p className="text-xs text-gray-500">Total Gross Weight (kg)</p>
                      <p className="text-sm font-medium text-gray-900">{livePackingTotals.totalGrossWeight.toFixed(3)}</p>
                    </div>
                    <div className="border rounded-md px-3 py-2 bg-gray-50">
                      <p className="text-xs text-gray-500">Total CBM</p>
                      <p className="text-sm font-medium text-gray-900">{livePackingTotals.totalCBM.toFixed(6)}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedDocs.includes("shippingBill") && (
                <div>
                  <h3 className="font-medium mb-4">Shipping Bill (Draft)</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Port of loading and port of discharge are auto-filled from shipment details and selected incoterm.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <input
                      placeholder="Port of loading"
                      list="port-codes-loading"
                      readOnly
                      className="border rounded-md px-3 py-2 bg-gray-50 text-gray-700 cursor-not-allowed"
                      value={docDetails.shippingBill.portOfLoading}
                    />
                    <input
                      placeholder="Port of discharge"
                      list="port-codes"
                      readOnly
                      className="border rounded-md px-3 py-2 bg-gray-50 text-gray-700 cursor-not-allowed"
                      value={docDetails.shippingBill.portOfDischarge}
                    />
                    <input
                      placeholder="Cargo type"
                      className="border rounded-md px-3 py-2"
                      value={docDetails.shippingBill.cargoType}
                      onChange={e =>
                        setDocDetails({
                          ...docDetails,
                          shippingBill: { ...docDetails.shippingBill, cargoType: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <input
                      placeholder="Scheme code (optional)"
                      className="border rounded-md px-3 py-2"
                      value={docDetails.shippingBill.schemeCode || ""}
                      onChange={e =>
                        setDocDetails({
                          ...docDetails,
                          shippingBill: { ...docDetails.shippingBill, schemeCode: e.target.value },
                        })
                      }
                    />
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        className="border rounded px-3 py-2"
                        checked={docDetails.shippingBill.drawback || false}
                        onChange={e =>
                          setDocDetails({
                            ...docDetails,
                            shippingBill: { ...docDetails.shippingBill, drawback: e.target.checked },
                          })
                        }
                      />
                      <span className="ml-2">Drawback applicable</span>
                    </label>
                  </div>
                </div>
              )}

              {selectedDocs.includes("coo") && (
                <div>
                  <h3 className="font-medium mb-4">Certificate of Origin</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    Country of origin is auto-filled from shipment and terms.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      placeholder="Country of origin"
                      readOnly
                      className="border rounded-md px-3 py-2 bg-gray-50 text-gray-700 cursor-not-allowed"
                      value={docDetails.coo.originCountry}
                    />
                    <input
                      placeholder="Chamber name"
                      className={`border rounded-md px-3 py-2 ${fieldErrors.chamberName ? "border-red-500" : ""}`}
                      value={docDetails.coo.chamberName}
                      onChange={e =>
                        setDocDetails({
                          ...docDetails,
                          coo: { ...docDetails.coo, chamberName: e.target.value },
                        })
                      }
                    />
                    {fieldErrors.chamberName && (
                      <p className="text-xs text-red-500 mt-1 sm:col-span-2">{fieldErrors.chamberName}</p>
                    )}
                  </div>
                </div>
              )}

              {selectedDocs.includes("insurance") && (
                <div>
                  <h3 className="font-medium mb-4">Insurance</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      placeholder="Policy number"
                      className="border rounded-md px-3 py-2"
                      value={docDetails.insurance.policyNumber}
                      onChange={e =>
                        setDocDetails({
                          ...docDetails,
                          insurance: { ...docDetails.insurance, policyNumber: e.target.value },
                        })
                      }
                    />
                    <input
                      placeholder="Insured value"
                      className={`border rounded-md px-3 py-2 ${fieldErrors.insuredValue ? "border-red-500" : ""}`}
                      value={docDetails.insurance.insuredValue}
                      onChange={e =>
                        setDocDetails({
                          ...docDetails,
                          insurance: { ...docDetails.insurance, insuredValue: e.target.value },
                        })
                      }
                    />
                    {fieldErrors.insuredValue && (
                      <p className="text-xs text-red-500 mt-1 sm:col-span-2">{fieldErrors.insuredValue}</p>
                    )}
                  </div>
                </div>
              )}

              {selectedDocs.includes("lc") && (
                <div>
                  <h3 className="font-medium mb-4">Letter of Credit</h3>
                  <input
                    placeholder="LC number"
                    className={`border rounded-md px-3 py-2 w-full ${fieldErrors.lcNumber ? "border-red-500" : ""}`}
                    value={docDetails.lc.lcNumber}
                    onChange={e =>
                      setDocDetails({
                        ...docDetails,
                        lc: { lcNumber: e.target.value },
                      })
                    }
                  />
                  {fieldErrors.lcNumber && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.lcNumber}</p>
                  )}
                </div>
              )}

            </div>

            {/* Invoice Items */}
            <div className="mt-20 max-w-5xl">

              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                Invoice items
                {sharedDetails.paymentTerms === "LC" && (
                  <span className="text-xs font-normal text-amber-600 bg-amber-50 px-2 py-1 rounded">
                    🔒 Description & Quantity locked for LC compliance
                  </span>
                )}
              </h2>

              <div className="space-y-4">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center"
                  >
                    <input
                      placeholder="Description"
                      className={`border rounded-md px-3 py-2 md:col-span-2 ${sharedDetails.paymentTerms === "LC" ? "bg-gray-100 cursor-not-allowed opacity-60" : ""}`}
                      value={item.description}
                      onChange={e => updateItem(index, "description", e.target.value)}
                      disabled={sharedDetails.paymentTerms === "LC"}
                      title={sharedDetails.paymentTerms === "LC" ? "Locked: Must match LC terms exactly" : ""}
                    />

                    <input
                      placeholder="HS Code"
                      className={`border rounded-md px-3 py-2 ${fieldErrors.hsCodeErrors[index] ? "border-red-500" : ""}`}
                      value={item.hsCode}
                      onChange={e => updateItem(index, "hsCode", e.target.value)}
                    />
                    {fieldErrors.hsCodeErrors[index] && (
                      <div className="md:col-span-6">
                        <p className="text-xs text-red-500">{fieldErrors.hsCodeErrors[index]}</p>
                      </div>
                    )}

                    <input
                      placeholder="Qty"
                      className={`border rounded-md px-3 py-2 ${sharedDetails.paymentTerms === "LC" ? "bg-gray-100 cursor-not-allowed opacity-60" : ""}`}
                      value={item.quantity}
                      onChange={e => updateItem(index, "quantity", e.target.value)}
                      disabled={sharedDetails.paymentTerms === "LC"}
                      title={sharedDetails.paymentTerms === "LC" ? "Locked: Must match LC terms exactly" : ""}
                    />

                    <input
                      placeholder="Unit price"
                      className="border rounded-md px-3 py-2"
                      value={item.unitPrice}
                      onChange={e => updateItem(index, "unitPrice", e.target.value)}
                    />

                    <div className="text-sm text-gray-600">
                      {Number(item.quantity || 0) * Number(item.unitPrice || 0)}
                    </div>

                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(index)}
                        className="text-sm text-red-500"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={addItem}
                className="mt-4 text-sm text-gray-700 underline"
              >
                + Add another item
              </button>

              <div className="mt-8">
                <div className="text-lg font-medium mb-3">
                  Invoice Summary
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Base Value (Items):</span>
                    <span className="font-medium">{sharedDetails.currency} {formattedTotalValue}</span>
                  </div>
                  
                  {sharedDetails.incoterm && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">FOB Value:</span>
                        <span className="font-medium">{sharedDetails.currency} {formattedFOB}</span>
                      </div>
                      
                      {freight > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">+ Freight:</span>
                          <span className="text-gray-500">{sharedDetails.currency} {freight.toLocaleString()}</span>
                        </div>
                      )}
                      
                      {insurance > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">+ Insurance:</span>
                          <span className="text-gray-500">{sharedDetails.currency} {insurance.toLocaleString()}</span>
                        </div>
                      )}
                      
                      {calculatedCIF !== null && (
                        <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                          <span className="text-gray-600 font-medium">CIF Value:</span>
                          <span className="font-medium text-gray-900">{sharedDetails.currency} {formattedCIF}</span>
                        </div>
                      )}
                      
                      <div className="pt-2 text-xs text-gray-500">
                        {sharedDetails.incoterm === "FOB" && "FOB: Freight & Insurance excluded"}
                        {sharedDetails.incoterm === "CIF" && "CIF: Includes Cost, Insurance & Freight"}
                        {sharedDetails.incoterm === "CFR" && "CFR: Includes Cost & Freight (no insurance)"}
                        {sharedDetails.incoterm === "EXW" && "EXW: Ex Works (buyer arranges transport)"}
                      </div>
                    </>
                  )}
                </div>
              </div>

            </div>

            {/* Review & Generate */}
            <div className="mt-24 max-w-3xl border-t pt-10">

              <h2 className="text-xl font-semibold mb-6">
                Review & generate
              </h2>

              <div className="mb-6 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                <p className="font-medium text-gray-900 mb-2">Compliance hints before generate</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Exporter IEC must be 10 digits.</li>
                  <li>If Insurance is selected, insured value must be 95-115% of invoice value.</li>
                  <li>Freight must satisfy incoterm logic and stay within 20% of invoice value.</li>
                </ul>
              </div>

              <div className="space-y-4 text-sm text-gray-700">

                <div>
                  <span className="font-medium">Documents:</span>{" "}
                  {selectedDocs.join(", ")}
                </div>

                <div>
                  <span className="font-medium">Exporter:</span>{" "}
                  {sharedDetails.exporterName || "—"}
                </div>

                <div>
                  <span className="font-medium">Buyer:</span>{" "}
                  {sharedDetails.buyerName || "—"}
                </div>

                <div>
                  <span className="font-medium">Total value:</span>{" "}
                  {sharedDetails.currency} {formattedTotalValue}
                </div>

              </div>

              <PrimaryButton
                onClick={handleGenerate}
                disabled={isGenerating}
                className="mt-8"
              >
                {isGenerating ? "Generating…" : "Generate documents"}
              </PrimaryButton>
              {formError && (
                formErrorLines.length > 1 ? (
                  <div className="mt-3 text-sm text-red-600">
                    <p className="font-medium">Please fix the following:</p>
                    <ul className="mt-1 list-disc pl-5 space-y-1">
                      {formErrorLines.map((line, index) => (
                        <li key={`${line}-${index}`}>{line.replace(/^[-•]\s*/, "")}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-red-600 whitespace-pre-line">{formError}</p>
                )
              )}
            </div>

          </div>
        )}
        <datalist id="port-codes-loading">
          {loadingPortOptions.map(option => (
            <option key={option.code} value={option.code} />
          ))}
        </datalist>
        <datalist id="port-codes-discharge">
          {dischargePortOptions.map(option => (
            <option key={option.code} value={option.code} />
          ))}
        </datalist>
      </div>
    )
}

export default DocumentsPage


