
-- Phase 3: AI moderation events + strikes + CSAM escalations

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS strike_count INTEGER NOT NULL DEFAULT 0;

-- moderation_events: every AI/human moderation signal against a user
CREATE TABLE IF NOT EXISTS public.moderation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reporter_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  call_log_id UUID,
  kind TEXT NOT NULL CHECK (kind IN ('voice','video','text','image')),
  category TEXT NOT NULL,                  -- nudity | sexual | violence | harassment | hate | self_harm | csam_suspect | other
  severity SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 5),
  ai_label TEXT,
  ai_score NUMERIC(5,4),
  ai_model TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {snippet?, transcript?, frame_data_url? (small thumb only)}
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','confirmed','dismissed')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_events_user_idx ON public.moderation_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS moderation_events_status_idx ON public.moderation_events(status, created_at DESC);

GRANT SELECT, INSERT ON public.moderation_events TO authenticated;
GRANT ALL ON public.moderation_events TO service_role;
ALTER TABLE public.moderation_events ENABLE ROW LEVEL SECURITY;

-- Users may insert events that report someone else (reporter = self)
CREATE POLICY "Users can submit moderation samples"
  ON public.moderation_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_user_id OR auth.uid() = user_id);

-- Admins read/manage all (via service role through server functions); also allow direct admin SELECT
CREATE POLICY "Admins read all moderation events"
  ON public.moderation_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read their own moderation events"
  ON public.moderation_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3-strike auto-ban: when a confirmed event is inserted, bump profile counter
-- and ban at >= 3 confirmed strikes within 30 days.
CREATE OR REPLACE FUNCTION public.apply_moderation_strike()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_strikes INT;
BEGIN
  IF NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO recent_strikes
  FROM public.moderation_events
  WHERE user_id = NEW.user_id
    AND status = 'confirmed'
    AND created_at > now() - interval '30 days';

  UPDATE public.profiles
     SET strike_count = recent_strikes
   WHERE id = NEW.user_id;

  IF recent_strikes >= 3 THEN
    UPDATE public.profiles
       SET is_banned = TRUE,
           ban_reason = COALESCE(ban_reason, 'Auto-ban: 3 confirmed moderation strikes within 30 days')
     WHERE id = NEW.user_id AND is_banned = FALSE;

    INSERT INTO public.bans (user_id, reason, ban_type, is_active, expires_at)
    VALUES (NEW.user_id, 'Auto-ban: 3 confirmed moderation strikes', 'permanent', TRUE, NULL)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_moderation_strike ON public.moderation_events;
CREATE TRIGGER trg_apply_moderation_strike
AFTER INSERT OR UPDATE OF status ON public.moderation_events
FOR EACH ROW EXECUTE FUNCTION public.apply_moderation_strike();

-- CSAM escalations: special sealed workflow
CREATE TABLE IF NOT EXISTS public.csam_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_by_admin UUID NOT NULL REFERENCES auth.users(id),
  call_log_id UUID,
  evidence_hash TEXT,
  narrative TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','escalated','closed')),
  case_ref TEXT,
  escalated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.csam_reports TO authenticated;
GRANT ALL ON public.csam_reports TO service_role;
ALTER TABLE public.csam_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage csam reports"
  ON public.csam_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
