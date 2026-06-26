
ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS free_seconds_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_flushed_at timestamptz;
