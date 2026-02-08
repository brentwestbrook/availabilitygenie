

# Fix: Drop Old Unique Constraint Blocking Multiple Accounts

## Problem Identified

The database error occurs because **two unique constraints** exist on the `calendar_connections` table:

| Constraint Name | Columns | Status |
|-----------------|---------|--------|
| `calendar_connections_user_provider_unique` | `(user_id, provider)` | OLD - blocking new accounts |
| `calendar_connections_user_id_provider_email_key` | `(user_id, provider, email)` | NEW - correct |

The previous migration attempted to drop a constraint named `calendar_connections_user_id_provider_key`, but the actual constraint is named `calendar_connections_user_provider_unique`. Since `DROP CONSTRAINT IF EXISTS` silently does nothing when the constraint doesn't exist, the old constraint remained.

## Solution

Create a new database migration to drop the correctly-named old constraint.

## Changes Required

### Database Migration

Create a migration with the following SQL:

```sql
-- Drop the OLD unique constraint that blocks multiple accounts per provider
-- The previous migration tried to drop 'calendar_connections_user_id_provider_key' 
-- but the actual constraint name is 'calendar_connections_user_provider_unique'
ALTER TABLE public.calendar_connections 
DROP CONSTRAINT IF EXISTS calendar_connections_user_provider_unique;
```

## Technical Details

The edge function logs confirm the issue:

```
duplicate key value violates unique constraint "calendar_connections_user_provider_unique"
Key (user_id, provider)=(7c604933-..., google) already exists.
```

The `onConflict: 'user_id,provider,email'` in the edge functions is correct, but PostgreSQL's `upsert` still fails because the **insert** attempt violates the old `(user_id, provider)` unique constraint before the conflict resolution logic can run.

## Expected Behavior After Fix

- Connecting a **new** Google/Microsoft account will INSERT a new row
- Reconnecting an **existing** account (same email) will UPDATE that row
- Multiple accounts from the same provider will work correctly

