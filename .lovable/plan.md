

# Fix Custom Domain Origin Validation

## Root Cause

The error occurs because you're accessing the app from your **custom domain** `https://availability.brentwestbrook.com`, which is not recognized by the current origin validation patterns.

The logs clearly show:
```
Google OAuth start: Origin rejected { origin: "https://availability.brentwestbrook.com" }
Microsoft OAuth start: Origin rejected { origin: "https://availability.brentwestbrook.com" }
```

## Solution

Add your custom domain to the allowed origins in both OAuth start functions. I'll add it as an explicit pattern alongside the existing Lovable patterns.

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/google-oauth-start/index.ts` | Add custom domain to ALLOWED_PATTERNS |
| `supabase/functions/microsoft-oauth-start/index.ts` | Add custom domain to ALLOWED_PATTERNS |

## Implementation Details

### Update isAllowedOrigin Function

Add the custom domain pattern to the ALLOWED_PATTERNS array:

```typescript
const ALLOWED_PATTERNS = [
  // Published domain
  /^https:\/\/availabilitygenie\.lovable\.app$/,
  // Custom domain
  /^https:\/\/availability\.brentwestbrook\.com$/,
  // Local development
  /^http:\/\/localhost:\d+$/,
  // Lovable preview URLs (various formats)
  /^https:\/\/[a-f0-9-]+\.lovable\.app$/,
  /^https:\/\/[a-f0-9-]+\.lovableproject\.com$/,
  /^https:\/\/id-preview--[a-f0-9-]+\.lovable\.app$/,
];
```

This change will be applied to both:
1. `supabase/functions/google-oauth-start/index.ts` (lines 17-26)
2. `supabase/functions/microsoft-oauth-start/index.ts` (lines 17-26)

## Why This Fixes The Issue

The origin validation currently only allows:
- `availabilitygenie.lovable.app` (published Lovable domain)
- `localhost:*` (local development)
- Various Lovable preview URL formats

Your custom domain `availability.brentwestbrook.com` doesn't match any of these patterns, so the request is rejected with a 400 error.

By adding your custom domain to the allowed patterns, the OAuth flow will proceed correctly.

## Deployment

After updating the files, both edge functions will be redeployed automatically.

