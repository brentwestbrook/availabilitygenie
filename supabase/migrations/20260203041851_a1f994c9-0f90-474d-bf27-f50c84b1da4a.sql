-- Fix calendar_connections_safe view to respect RLS

-- First, drop the overly restrictive policy that blocks all authenticated SELECT
-- This policy conflicts with proper RLS access patterns
DROP POLICY IF EXISTS "Deny direct select for authenticated users" ON public.calendar_connections;

-- Rename and recreate the proper SELECT policy as PERMISSIVE (default)
-- so users can actually query their own data
DROP POLICY IF EXISTS "Users can view their own connections via safe view" ON public.calendar_connections;

CREATE POLICY "Users can select their own connections"
ON public.calendar_connections
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Recreate the view with security_invoker = true
-- This ensures the view runs with the calling user's permissions,
-- so RLS on the underlying table is enforced
DROP VIEW IF EXISTS public.calendar_connections_safe;

CREATE VIEW public.calendar_connections_safe
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  provider,
  email,
  token_expires_at,
  created_at,
  updated_at
FROM public.calendar_connections;

-- Ensure authenticated users can query the view
GRANT SELECT ON public.calendar_connections_safe TO authenticated;

-- Add comment explaining the security model
COMMENT ON VIEW public.calendar_connections_safe IS 
'Safe view exposing non-sensitive calendar connection data. Uses security_invoker=true to enforce RLS from calendar_connections table.';