
CREATE TABLE public.perf_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('route_load','api_call','error')),
  route TEXT,
  label TEXT,
  duration_ms INTEGER,
  status INTEGER,
  ok BOOLEAN,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX perf_events_created_idx ON public.perf_events (created_at DESC);
CREATE INDEX perf_events_type_route_idx ON public.perf_events (event_type, route, created_at DESC);

GRANT SELECT, INSERT ON public.perf_events TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.perf_events_id_seq TO authenticated;
GRANT ALL ON public.perf_events TO service_role;
GRANT ALL ON SEQUENCE public.perf_events_id_seq TO service_role;

ALTER TABLE public.perf_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own perf"
  ON public.perf_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "admins read perf"
  ON public.perf_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Auto-purge events older than 7 days via a helper function (admin/cron callable)
CREATE OR REPLACE FUNCTION public.purge_old_perf_events()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  DELETE FROM public.perf_events WHERE created_at < now() - INTERVAL '7 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
