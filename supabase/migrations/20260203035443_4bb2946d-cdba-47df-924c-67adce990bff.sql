-- Create a secure view that excludes sensitive token columns
-- This prevents clients from querying encrypted tokens directly

CREATE VIEW public.calendar_connections_safe AS
SELECT 
  id,
  user_id,
  provider,
  email,
  token_expires_at,
  created_at,
  updated_at
FROM public.calendar_connections;

-- Enable RLS on the view
ALTER VIEW public.calendar_connections_safe SET (security_invoker = on);

-- Drop the old SELECT policy that allowed reading tokens
DROP POLICY IF EXISTS "Users can view their own connections" ON public.calendar_connections;

-- Create a new restrictive SELECT policy that denies all client reads
-- Edge functions use service role which bypasses RLS
CREATE POLICY "Deny direct select for authenticated users"
ON public.calendar_connections
FOR SELECT
TO authenticated
USING (false);

-- Create policy for the safe view
CREATE POLICY "Users can view their own connections via safe view"
ON public.calendar_connections
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Grant access to the safe view for authenticated users
GRANT SELECT ON public.calendar_connections_safe TO authenticated;