
-- Add retention tracking columns
ALTER TABLE public.kyc_requests
  ADD COLUMN IF NOT EXISTS docs_retention_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS docs_deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS kyc_requests_retention_idx
  ON public.kyc_requests (docs_retention_until)
  WHERE docs_deleted_at IS NULL AND docs_retention_until IS NOT NULL;

-- Trigger: when status moves to approved/rejected, set retention deadline
CREATE OR REPLACE FUNCTION public.kyc_set_retention()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('approved','rejected')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.docs_retention_until IS NULL
     AND NEW.docs_deleted_at IS NULL THEN
    IF NEW.status = 'approved' THEN
      NEW.docs_retention_until := now() + INTERVAL '7 days';
    ELSE
      NEW.docs_retention_until := now() + INTERVAL '30 days';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kyc_requests_set_retention ON public.kyc_requests;
CREATE TRIGGER kyc_requests_set_retention
  BEFORE UPDATE ON public.kyc_requests
  FOR EACH ROW EXECUTE FUNCTION public.kyc_set_retention();

-- Backfill existing approved/rejected rows with retention deadlines
UPDATE public.kyc_requests
SET docs_retention_until = COALESCE(reviewed_at, updated_at)
                           + CASE WHEN status = 'approved'
                                  THEN INTERVAL '7 days'
                                  ELSE INTERVAL '30 days' END
WHERE status IN ('approved','rejected')
  AND docs_retention_until IS NULL
  AND docs_deleted_at IS NULL;
