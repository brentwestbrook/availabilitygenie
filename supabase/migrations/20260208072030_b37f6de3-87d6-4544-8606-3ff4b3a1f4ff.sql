-- Drop the OLD unique constraint that blocks multiple accounts per provider
-- The previous migration tried to drop 'calendar_connections_user_id_provider_key' 
-- but the actual constraint name is 'calendar_connections_user_provider_unique'
ALTER TABLE public.calendar_connections 
DROP CONSTRAINT IF EXISTS calendar_connections_user_provider_unique;