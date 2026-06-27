
CREATE TABLE IF NOT EXISTS public.kyc_doc_purge_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_request_id UUID NOT NULL,
  user_id UUID NOT NULL,
  kyc_status TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  doc_kind TEXT NOT NULL,
  cron_run_id UUID NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kyc_doc_purge_log_run_idx ON public.kyc_doc_purge_log (cron_run_id);
CREATE INDEX IF NOT EXISTS kyc_doc_purge_log_kyc_idx ON public.kyc_doc_purge_log (kyc_request_id);
CREATE INDEX IF NOT EXISTS kyc_doc_purge_log_deleted_at_idx ON public.kyc_doc_purge_log (deleted_at DESC);

GRANT SELECT ON public.kyc_doc_purge_log TO authenticated;
GRANT ALL ON public.kyc_doc_purge_log TO service_role;

ALTER TABLE public.kyc_doc_purge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read purge log"
  ON public.kyc_doc_purge_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
