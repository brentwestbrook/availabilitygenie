

# Fix Google and Microsoft Calendar Connection Errors

## Problem Summary

The calendar connections are failing for two main reasons:
1. The `calendar-events` edge function uses `supabase.auth.getClaims(token)` which is not the correct API
2. Token refresh logic is missing - expired tokens cause API failures

The edge function logs show:
```
Error: Failed to fetch Google events
```

And the `calendar_connections` database table is empty, suggesting either OAuth callbacks are failing or tokens are not being stored properly.

## Solution Overview

| Issue | Fix |
|-------|-----|
| `getClaims()` API not working | Replace with `getUser()` which is the standard method |
| Token expiration causing API failures | Add token refresh logic before making API calls |
| Better error logging | Add detailed logging to diagnose issues |

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/calendar-events/index.ts` | Fix authentication method and add token refresh |

## Implementation Details

### 1. Replace getClaims with getUser

The current code:
```typescript
const token = authHeader.replace('Bearer ', '');
const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
const userId = claimsData.claims.sub;
```

Should be replaced with:
```typescript
const { data: { user }, error: userError } = await supabase.auth.getUser();
if (userError || !user) {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
const userId = user.id;
```

This uses the standard `getUser()` method which automatically works with the Authorization header passed in the client configuration.

### 2. Add Token Refresh Logic

Before making API calls, check if the access token has expired and refresh it if needed:

```typescript
async function refreshGoogleToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
} | null> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  
  if (!response.ok) return null;
  return response.json();
}
```

Similar logic for Microsoft tokens.

### 3. Add Better Error Logging

Add detailed logging before throwing errors to help diagnose issues:

```typescript
const response = await fetch(url.toString(), {
  headers: { Authorization: `Bearer ${accessToken}` },
});

if (!response.ok) {
  const errorBody = await response.text();
  console.error(`Google Calendar API error: ${response.status} - ${errorBody}`);
  throw new Error(`Failed to fetch Google events: ${response.status}`);
}
```

### 4. Check Token Expiry Before API Calls

```typescript
// Check if token is expired or will expire soon (5 minute buffer)
const tokenExpiresAt = new Date(connection.token_expires_at);
const now = new Date();
const bufferMs = 5 * 60 * 1000; // 5 minutes

if (tokenExpiresAt.getTime() - now.getTime() < bufferMs) {
  // Token expired or expiring soon, refresh it
  const newTokens = await refreshGoogleToken(decryptedRefreshToken);
  if (newTokens) {
    // Update tokens in database
    // Use new access token
  }
}
```

## Technical Notes

- **Authentication**: Using `getUser()` without parameters works because the Supabase client is already configured with the Authorization header
- **Token Refresh**: Google refresh tokens don't expire (unless revoked), so we can always refresh if we have one stored
- **Error Handling**: Better error messages will help identify the root cause if issues persist

## Testing Notes

After deploying, test by:
1. Disconnecting any existing calendar connections
2. Re-connecting Google Calendar
3. Verifying the OAuth popup completes successfully
4. Checking that events appear on the calendar

If issues persist, check the edge function logs for detailed error messages.

