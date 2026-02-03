-- Add columns for token encryption (IV and auth tag)
ALTER TABLE public.calendar_connections 
  ADD COLUMN IF NOT EXISTS access_token_iv TEXT,
  ADD COLUMN IF NOT EXISTS access_token_tag TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_iv TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_tag TEXT;