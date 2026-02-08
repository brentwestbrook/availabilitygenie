
# Fix: Multiple Google Calendar Connections

## Problem Identified

When connecting a second Google account, the first one gets disconnected. This happens because the OAuth callback functions have an outdated `onConflict` clause that doesn't match the updated database constraint.

## Root Cause

The database was migrated to use a unique constraint on `(user_id, provider, email)` to support multiple accounts per provider. However, the OAuth callback functions still specify:

```
onConflict: 'user_id,provider'
```

This mismatch causes the upsert to behave incorrectly, replacing the first connection instead of creating a new one.

## Solution

Update both OAuth callback edge functions to use the correct conflict columns that match the database constraint.

## Changes Required

### 1. Update Google OAuth Callback
**File:** `supabase/functions/google-oauth-callback/index.ts`

Change line 139 from:
```typescript
onConflict: 'user_id,provider',
```
To:
```typescript
onConflict: 'user_id,provider,email',
```

### 2. Update Microsoft OAuth Callback  
**File:** `supabase/functions/microsoft-oauth-callback/index.ts`

Change line 141 from:
```typescript
onConflict: 'user_id,provider',
```
To:
```typescript
onConflict: 'user_id,provider,email',
```

### 3. Deploy Edge Functions
Deploy both updated callback functions to apply the fix.

## Expected Behavior After Fix

- Connecting a **new** Google/Microsoft account will create a new database row
- Re-connecting an **existing** account (same email) will update that row's tokens
- Multiple accounts from the same provider will coexist correctly

## Technical Details

The upsert operation needs to match the database's unique constraint to determine whether to INSERT or UPDATE. With the corrected `onConflict` clause:

| Scenario | Action |
|----------|--------|
| First Google account (user@gmail.com) | INSERT new row |
| Second Google account (other@gmail.com) | INSERT new row (different email) |
| Reconnect first account (user@gmail.com) | UPDATE existing row (same email) |
