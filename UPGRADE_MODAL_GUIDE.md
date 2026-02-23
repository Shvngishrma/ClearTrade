# Upgrade Modal Implementation Guide

## When the Modal Appears

The upgrade modal is triggered in exactly THREE scenarios:

### 1. ✅ Free User Hits 7 Document Limit
- **Location:** `handleGenerate()` in page.tsx
- **Trigger:** Backend returns `FREE_LIMIT_EXCEEDED` error
- **Detection:** 
  ```typescript
  if (error.message === "FREE_LIMIT_EXCEEDED") {
    handleUpgradeError(res.status, error.message, "LIMIT_EXCEEDED")
  }
  ```
- **Modal Title:** "You've reached your free limit of 7 document generations"
- **Reason Code:** `LIMIT_EXCEEDED`

### 2. ✅ Free User Clicks Download DOCX
- **Location:** DOCX button handler in page.tsx
- **Trigger:** Backend returns HTTP 403 Forbidden
- **Detection:**
  ```typescript
  if (res.status === 403) {
    handleUpgradeError(403, "Pro only", "DOCX_RESTRICTED")
  }
  ```
- **Modal Title:** "DOCX export is a Pro-only feature"
- **Reason Code:** `DOCX_RESTRICTED`
- **Routes Returning 403:**
  - `/api/documents/generate-invoice/docx`
  - `/api/documents/generate-packing-list/docx`
  - `/api/documents/generate-shipping-bill/docx`

### 3. ✅ Free User Tries ZIP Download After Limit
- **Location:** `handleDownloadAll()` in page.tsx
- **Trigger:** Backend returns error "FREE_LIMIT_EXCEEDED" or status 429
- **Detection:**
  ```typescript
  if (errorText === "FREE_LIMIT_EXCEEDED" || res.status === 429) {
    handleUpgradeError(res.status, errorText, "LIMIT_EXCEEDED")
  }
  ```
- **Modal Title:** "You've reached your free limit"
- **Reason Code:** `LIMIT_EXCEEDED`

## Modal Component Structure

**File:** `components/UpgradeModal.tsx`

### Props:
```typescript
interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  triggerReason?: "LIMIT_EXCEEDED" | "DOCX_RESTRICTED" | "REGENERATE_RESTRICTED"
}
```

### Features:
- ✓ Conditional messaging based on trigger reason
- ✓ Displays Pro features list
- ✓ "Continue Free" button (closes modal)
- ✓ "Upgrade Now" button (redirects to /upgrade)
- ✓ Overlay backdrop that can be clicked to close
- ✓ Styled with Tailwind CSS

### Trigger-Specific Messages:

| Reason | Message |
|--------|---------|
| `LIMIT_EXCEEDED` | "You've reached your free limit of 7 document generations. Upgrade to Pro for unlimited documents." |
| `DOCX_RESTRICTED` | "DOCX export is a Pro-only feature. Upgrade to Pro to download documents as Word files." |
| `REGENERATE_RESTRICTED` | "You've used all your free generations. Upgrade to Pro to create more documents." |

## Frontend Error Detection Pattern

All API calls that might fail follow this pattern:

```typescript
try {
  const res = await fetch(endpoint, options)

  if (!res.ok) {
    const errorText = await res.text()
    
    // Check for FREE_LIMIT_EXCEEDED (from PDF/ZIP routes)
    if (errorText === "FREE_LIMIT_EXCEEDED") {
      handleUpgradeError(res.status, errorText, "LIMIT_EXCEEDED")
      return
    }
    
    // Check for 403 (from DOCX routes)
    if (res.status === 403) {
      handleUpgradeError(403, "Pro only", "DOCX_RESTRICTED")
      return
    }
    
    throw new Error(...)
  }

  // Continue with success path
} catch (error) {
  // Handle unexpected errors
}
```

## Backend Integration Points

### From PDF Routes (e.g., /api/documents/generate-invoice/pdf):
```typescript
const usage = await checkUsage()  // Throws: "FREE_LIMIT_EXCEEDED"
// ... generate PDF ...
await incrementUsage()
```

### From ZIP Route (/api/documents/download-zip):
```typescript
const usage = await checkUsage()  // Throws: "FREE_LIMIT_EXCEEDED"
// ... generate ZIP ...
await incrementUsage()
```

### From DOCX Routes (e.g., /api/documents/generate-invoice/docx):
```typescript
const usage = await checkUsage()
if (!usage.isPro) {
  return new NextResponse("Pro only", { status: 403 })  // Returns 403
}
// ... generate DOCX ...
```

## State Management

**State Variables in page.tsx:**
```typescript
const [showUpgradeModal, setShowUpgradeModal] = useState(false)
const [upgradeReason, setUpgradeReason] = useState<
  "LIMIT_EXCEEDED" | "DOCX_RESTRICTED" | "REGENERATE_RESTRICTED"
>("LIMIT_EXCEEDED")

const handleUpgradeError = (
  status: number,
  errorMessage: string,
  reason: "LIMIT_EXCEEDED" | "DOCX_RESTRICTED" | "REGENERATE_RESTRICTED"
) => {
  setUpgradeReason(reason)
  setShowUpgradeModal(true)
}
```

## Usage Example

When user clicks "Generate Documents" and hits limit:

1. `handleGenerate()` calls `/api/session` POST
2. Backend throws "FREE_LIMIT_EXCEEDED" error
3. Frontend catches error: `error.message === "FREE_LIMIT_EXCEEDED"`
4. Frontend calls: `handleUpgradeError(429, "...", "LIMIT_EXCEEDED")`
5. Modal sets: `upgradeReason = "LIMIT_EXCEEDED"`, `showUpgradeModal = true`
6. Modal renders with message about 7 document limit
7. User clicks "Upgrade Now" → redirects to `/upgrade` page
8. OR clicks "Continue Free" → closes modal

## Customization Points

### To change modal appearance:
Edit `components/UpgradeModal.tsx` className properties

### To change Pro features list:
Update the `<ul>` element in UpgradeModal with new `<li>` items

### To change upgrade redirect:
Modify the `window.location.href = "/upgrade"` in DOCX button handler

### To add new trigger reason:
1. Add new string literal to the union type: `| "NEW_REASON"`
2. Add case in `getTriggerMessage()` function
3. Call `handleUpgradeError(..., "NEW_REASON")` from relevant location
