ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_token text,
  ADD COLUMN IF NOT EXISTS push_platform text;