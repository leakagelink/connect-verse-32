
ALTER TABLE public.perf_events ADD COLUMN IF NOT EXISTS trace_id TEXT;
CREATE INDEX IF NOT EXISTS perf_events_trace_idx ON public.perf_events (trace_id, created_at);

ALTER TABLE public.perf_events DROP CONSTRAINT IF EXISTS perf_events_event_type_check;
ALTER TABLE public.perf_events ADD CONSTRAINT perf_events_event_type_check
  CHECK (event_type IN ('route_load','api_call','error','component'));
