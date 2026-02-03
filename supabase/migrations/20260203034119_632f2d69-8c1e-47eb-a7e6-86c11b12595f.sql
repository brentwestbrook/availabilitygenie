-- Add unique constraint on user_id and provider for upsert operations
ALTER TABLE public.calendar_connections 
ADD CONSTRAINT calendar_connections_user_provider_unique UNIQUE (user_id, provider);