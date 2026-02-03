

# Fix Calendar Connection Errors - CORS Headers

## Root Cause

The edge functions are failing due to **incomplete CORS headers**. The Supabase JS client sends additional headers (`x-supabase-client-platform`, `x-supabase-client-platform-version`, etc.) that are not included in the `Access-Control-Allow-Headers` list. This causes the CORS preflight request to fail, preventing the OAuth start functions from being called.

## Evidence

- When testing the edge function directly, it returns a 401 error
- The `calendar_connections` table is empty - OAuth callbacks never complete
- No logs are recorded for actual OAuth operations, only boot logs
- All edge functions have the same incomplete CORS headers

## Solution

Update the CORS headers in all three edge functions to include the required Supabase client headers.

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/google-oauth-start/index.ts` | Update CORS headers |
| `supabase/functions/microsoft-oauth-start/index.ts` | Update CORS headers |
| `supabase/functions/calendar-events/index.ts` | Update CORS headers |

## Implementation Details

### Update CORS Headers

Change from:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

To:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
```

This change needs to be applied to all three edge functions:
1. `google-oauth-start/index.ts` (line 4-7)
2. `microsoft-oauth-start/index.ts` (line 4-7)
3. `calendar-events/index.ts` (line 5-8)

## Why This Fixes The Issue

The Supabase JS client automatically includes telemetry/platform headers in every request. When the browser makes a preflight OPTIONS request, it checks if these headers are allowed. If any header is not in the `Access-Control-Allow-Headers` list, the preflight fails and the main request is never sent.

By adding the missing headers, the preflight will succeed and the actual OAuth start request will go through.

## Deployment

After updating the files, all three edge functions will need to be redeployed for the changes to take effect.

## Testing

After deployment:
1. Log in to the app
2. Click the "Connect" button for Google Calendar
3. Verify the OAuth popup opens (instead of showing an error immediately)
4. Complete the OAuth flow
5. Verify events appear on the calendar

