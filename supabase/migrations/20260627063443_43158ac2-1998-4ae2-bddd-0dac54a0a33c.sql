
INSERT INTO public.app_settings (key, value) VALUES
  ('calling_provider', '"mock"'::jsonb),
  ('agora_app_id', '""'::jsonb),
  ('agora_app_certificate', '""'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS channel_name TEXT,
  ADD COLUMN IF NOT EXISTS quality_avg NUMERIC,
  ADD COLUMN IF NOT EXISTS disconnects INT NOT NULL DEFAULT 0;
