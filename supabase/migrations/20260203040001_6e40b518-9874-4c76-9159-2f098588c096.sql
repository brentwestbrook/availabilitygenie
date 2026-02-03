-- Add explicit deny policy for anonymous users to prevent any unauthenticated access
-- This ensures the calendar_connections table is completely inaccessible to anonymous users

-- Deny SELECT for anonymous users
CREATE POLICY "Deny anonymous select"
ON public.calendar_connections
FOR SELECT
TO anon
USING (false);

-- Deny INSERT for anonymous users  
CREATE POLICY "Deny anonymous insert"
ON public.calendar_connections
FOR INSERT
TO anon
WITH CHECK (false);

-- Deny UPDATE for anonymous users
CREATE POLICY "Deny anonymous update"
ON public.calendar_connections
FOR UPDATE
TO anon
USING (false);

-- Deny DELETE for anonymous users
CREATE POLICY "Deny anonymous delete"
ON public.calendar_connections
FOR DELETE
TO anon
USING (false);