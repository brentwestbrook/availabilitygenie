-- Drop the existing unique constraint on (user_id, provider)
-- and create a new one on (user_id, provider, email) to allow multiple connections per provider
ALTER TABLE public.calendar_connections 
DROP CONSTRAINT IF EXISTS calendar_connections_user_id_provider_key;

-- Add new unique constraint that includes email
ALTER TABLE public.calendar_connections
ADD CONSTRAINT calendar_connections_user_id_provider_email_key 
UNIQUE (user_id, provider, email);

-- Make email NOT NULL for new connections (required for uniqueness)
-- First update any existing NULL emails to a placeholder (shouldn't exist, but safety)
UPDATE public.calendar_connections 
SET email = 'unknown@unknown.com' 
WHERE email IS NULL;

-- Now make email required
ALTER TABLE public.calendar_connections 
ALTER COLUMN email SET NOT NULL;