
-- 1. calling_credentials table
CREATE TABLE public.calling_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('agora','100ms')),
  label text NOT NULL,
  priority int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy','degraded','exhausted','disabled')),
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  monthly_quota_minutes int,
  minutes_used_current_month int NOT NULL DEFAULT 0,
  quota_reset_at timestamptz NOT NULL DEFAULT date_trunc('month', now()) + interval '1 month',
  consecutive_failures int NOT NULL DEFAULT 0,
  last_error text,
  last_error_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Service role only (admin fns use supabaseAdmin). No anon/authenticated grants — credentials are sensitive.
GRANT ALL ON public.calling_credentials TO service_role;

ALTER TABLE public.calling_credentials ENABLE ROW LEVEL SECURITY;

-- No authenticated policies — table is reached only via privileged server fns.
CREATE POLICY "service_role full access" ON public.calling_credentials
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE TRIGGER calling_credentials_set_updated_at
  BEFORE UPDATE ON public.calling_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX calling_credentials_pool_idx
  ON public.calling_credentials (is_active, status, priority, last_used_at)
  WHERE is_active = true;

-- 2. call_logs columns for credential tracking
ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS credential_id uuid REFERENCES public.calling_credentials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS failover_chain jsonb DEFAULT '[]'::jsonb;

-- 3. Seed: if existing Agora creds are in app_settings, copy them into the pool as priority=1
DO $$
DECLARE
  v_app_id text;
  v_cert text;
BEGIN
  SELECT (value #>> '{}') INTO v_app_id FROM public.app_settings WHERE key = 'agora_app_id';
  SELECT (value #>> '{}') INTO v_cert FROM public.app_settings WHERE key = 'agora_app_certificate';
  IF v_app_id IS NOT NULL AND v_app_id <> '' AND v_cert IS NOT NULL AND v_cert <> '' THEN
    INSERT INTO public.calling_credentials (provider, label, priority, credentials)
    VALUES ('agora', 'Agora-Primary (migrated)', 1, jsonb_build_object('app_id', v_app_id, 'app_certificate', v_cert))
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 4. Selector function: returns the best healthy credential for a provider (or any provider if NULL)
CREATE OR REPLACE FUNCTION public.pick_calling_credential(_provider text DEFAULT NULL)
RETURNS public.calling_credentials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.calling_credentials;
BEGIN
  -- Prefer healthy
  SELECT * INTO c FROM public.calling_credentials
  WHERE is_active = true
    AND status = 'healthy'
    AND (_provider IS NULL OR provider = _provider)
  ORDER BY priority ASC, consecutive_failures ASC, last_used_at NULLS FIRST
  LIMIT 1;

  -- Fallback to degraded
  IF c.id IS NULL THEN
    SELECT * INTO c FROM public.calling_credentials
    WHERE is_active = true
      AND status = 'degraded'
      AND (_provider IS NULL OR provider = _provider)
    ORDER BY priority ASC, last_used_at NULLS FIRST
    LIMIT 1;
  END IF;

  IF c.id IS NOT NULL THEN
    UPDATE public.calling_credentials
       SET last_used_at = now()
     WHERE id = c.id;
  END IF;

  RETURN c;
END;
$$;

-- 5. Failure reporter
CREATE OR REPLACE FUNCTION public.report_credential_failure(_id uuid, _error text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.calling_credentials
     SET consecutive_failures = consecutive_failures + 1,
         last_error = _error,
         last_error_at = now(),
         status = CASE WHEN consecutive_failures + 1 >= 3 AND status = 'healthy' THEN 'degraded' ELSE status END
   WHERE id = _id;
END;
$$;

-- 6. Success reporter (resets failure counter)
CREATE OR REPLACE FUNCTION public.report_credential_success(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.calling_credentials
     SET consecutive_failures = 0,
         status = CASE WHEN status = 'degraded' THEN 'healthy' ELSE status END
   WHERE id = _id;
END;
$$;

-- 7. Minutes increment + auto-exhaust on quota
CREATE OR REPLACE FUNCTION public.add_credential_minutes(_id uuid, _minutes int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.calling_credentials
     SET minutes_used_current_month = minutes_used_current_month + GREATEST(_minutes, 0),
         status = CASE
           WHEN monthly_quota_minutes IS NOT NULL
            AND minutes_used_current_month + GREATEST(_minutes, 0) >= monthly_quota_minutes
            AND status <> 'disabled'
           THEN 'exhausted'
           ELSE status
         END
   WHERE id = _id;
END;
$$;
