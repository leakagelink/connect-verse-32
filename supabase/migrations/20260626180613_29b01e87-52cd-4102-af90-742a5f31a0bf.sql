
CREATE TABLE public.call_usage_flushes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_log_id uuid NOT NULL REFERENCES public.call_logs(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  total_free_seconds integer NOT NULL DEFAULT 0,
  total_coins integer NOT NULL DEFAULT 0,
  elapsed_seconds integer NOT NULL DEFAULT 0,
  applied_free_delta integer NOT NULL DEFAULT 0,
  applied_coins_delta integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (call_log_id, idempotency_key)
);

GRANT ALL ON public.call_usage_flushes TO service_role;

ALTER TABLE public.call_usage_flushes ENABLE ROW LEVEL SECURITY;

CREATE INDEX call_usage_flushes_call_log_idx
  ON public.call_usage_flushes (call_log_id, created_at DESC);
