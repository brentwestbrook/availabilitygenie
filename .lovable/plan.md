

# Fix Google Calendar OAuth Connection

## Problem Identified

The OAuth flow is failing because:
1. **Origin validation failure**: The edge function rejects `https://599645c8-f274-42a2-bfb6-3180155b3d75.lovableproject.com` because it's not in the allowed origins list
2. **Missing domains**: The allowed origins list is outdated and missing your current preview and published domains

## Solution

### 1. Update Edge Functions (Code Changes)

Update the allowed origins in both `google-oauth-start` and `microsoft-oauth-start` to include all valid app domains:

```typescript
const ALLOWED_ORIGINS = [
  Deno.env.get('FRONTEND_URL') || '',
  // Preview domains
  'https://id-preview--599645c8-f274-42a2-bfb6-3180155b3d75.lovable.app',
  'https://599645c8-f274-42a2-bfb6-3180155b3d75.lovableproject.com',
  // Published domain
  'https://availabilitygenie.lovable.app',
  // Local development
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8080',
].filter(Boolean);
```

### 2. Google Cloud Console Configuration (Manual Steps)

You'll need to configure these in the Google Cloud Console:

**Authorized JavaScript Origins:**
- `https://599645c8-f274-42a2-bfb6-3180155b3d75.lovableproject.com`
- `https://id-preview--599645c8-f274-42a2-bfb6-3180155b3d75.lovable.app`
- `https://availabilitygenie.lovable.app`
- `http://localhost:5173` (for local development)

**Authorized Redirect URI:**
- `https://qrermcbuxylxwbimdmkt.supabase.co/functions/v1/google-oauth-callback`

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/google-oauth-start/index.ts` | Add missing domains to ALLOWED_ORIGINS |
| `supabase/functions/microsoft-oauth-start/index.ts` | Add missing domains to ALLOWED_ORIGINS |

## Technical Details

The edge functions validate the `origin` parameter sent from the frontend against a hardcoded allowlist. This prevents open redirect attacks but requires the list to include all legitimate domains where the app is hosted.

