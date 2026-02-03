
# Fix Calendar Connection Errors - Complete Solution

## Root Cause Analysis

After investigating the logs and code, I found **three interconnected issues**:

| Issue | Evidence | Impact |
|-------|----------|--------|
| Missing preview URL domains in ALLOWED_ORIGINS | Analytics show 400 errors for some requests while others succeed | Users on certain preview URLs cannot initiate OAuth |
| OAuth callbacks never reached | Zero logs for `google-oauth-callback` and `microsoft-oauth-callback` | OAuth flow fails silently after user authenticates |
| No debug logging or better error messages | Generic error messages hide real issues | Difficult to diagnose problems |

## Solution Overview

This fix requires both **code changes** and **external OAuth configuration**:

### Part 1: Code Changes (This Plan)

1. Improve origin validation to use pattern matching instead of exact matches
2. Add comprehensive debug logging to all OAuth functions
3. Improve error messages to show actual OAuth errors from providers
4. Add more preview URL variations to the allowed list

### Part 2: External Configuration (User Action Required)

The OAuth redirect URIs must be registered in the provider consoles:

**Google Cloud Console:**
- URL: `https://qrermcbuxylxwbimdmkt.supabase.co/functions/v1/google-oauth-callback`

**Microsoft Azure Portal:**
- URL: `https://qrermcbuxylxwbimdmkt.supabase.co/functions/v1/microsoft-oauth-callback`

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/google-oauth-start/index.ts` | Use pattern matching for origins, add debug logging |
| `supabase/functions/microsoft-oauth-start/index.ts` | Use pattern matching for origins, add debug logging |
| `supabase/functions/google-oauth-callback/index.ts` | Add comprehensive debug logging |
| `supabase/functions/microsoft-oauth-callback/index.ts` | Add comprehensive debug logging |

## Implementation Details

### 1. Update Origin Validation with Pattern Matching

Replace exact string matching with a function that handles various Lovable preview URL formats:

```typescript
function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  
  const ALLOWED_PATTERNS = [
    // Exact matches for known domains
    /^https:\/\/availabilitygenie\.lovable\.app$/,
    // Local development
    /^http:\/\/localhost:\d+$/,
    // Lovable preview URLs (various formats)
    /^https:\/\/[a-f0-9-]+\.lovable\.app$/,
    /^https:\/\/[a-f0-9-]+\.lovableproject\.com$/,
    /^https:\/\/id-preview--[a-f0-9-]+\.lovable\.app$/,
    // Custom FRONTEND_URL if set
  ];
  
  const frontendUrl = Deno.env.get('FRONTEND_URL');
  if (frontendUrl && origin === frontendUrl) return true;
  
  return ALLOWED_PATTERNS.some(pattern => pattern.test(origin));
}
```

### 2. Add Debug Logging to OAuth Start Functions

Log key information to help diagnose issues:

```typescript
console.log('OAuth start request:', {
  origin,
  userId,
  hasClientId: !!clientId,
  redirectUri,
});
```

### 3. Add Debug Logging to OAuth Callback Functions

Log the entire flow to identify where failures occur:

```typescript
console.log('OAuth callback received:', {
  hasCode: !!code,
  hasState: !!state,
  error,
  origin,
  userId,
});

// After token exchange
console.log('Token exchange result:', {
  success: !tokens.error,
  error: tokens.error,
  hasAccessToken: !!tokens.access_token,
  hasRefreshToken: !!tokens.refresh_token,
});

// After database upsert
console.log('Database upsert result:', {
  success: !dbError,
  error: dbError?.message,
});
```

### 4. Improve Error Messages in Frontend

Update the useCalendarConnections hook to show more specific errors:

```typescript
} catch (e) {
  const errorMessage = e instanceof Error ? e.message : 'Unknown error';
  console.error('Failed to start Google OAuth:', e);
  setError(`Failed to connect to Google Calendar: ${errorMessage}`);
  setLoadingProvider(null);
}
```

## Why This Will Fix the Issue

1. **Pattern matching for origins** will accept all valid Lovable preview URL formats without needing to enumerate each one
2. **Debug logging** will help identify exactly where the OAuth flow is failing
3. **Better error messages** will surface the actual issue to users and developers

## External Configuration Required

After deploying the code changes, verify/add these redirect URIs in the OAuth provider consoles:

**Google Cloud Console** (APIs & Services > Credentials > OAuth 2.0 Client IDs):
- Add: `https://qrermcbuxylxwbimdmkt.supabase.co/functions/v1/google-oauth-callback`

**Microsoft Azure Portal** (App registrations > Authentication > Redirect URIs):
- Add: `https://qrermcbuxylxwbimdmkt.supabase.co/functions/v1/microsoft-oauth-callback`
- Platform: Web
- Type: Redirect URI

## Testing Steps

After deploying:
1. Check edge function logs for debug output when clicking Connect
2. Verify the OAuth popup opens and shows Google/Microsoft login
3. After completing authentication, check callback function logs
4. Verify `calendar_connections` table has a new entry
5. Verify events appear on the calendar
