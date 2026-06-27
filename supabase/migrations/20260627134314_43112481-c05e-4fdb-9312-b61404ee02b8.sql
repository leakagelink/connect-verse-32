-- 1) Lock down SECURITY DEFINER functions exposed to anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.credit_razorpay_payment(text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_signal_banned(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mm_recalc_candidate_score() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_old_perf_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_ban_signals() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_moderation_strike() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pick_calling_credential(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_credential_minutes(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_credential_failure(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_credential_success(uuid) FROM PUBLIC, anon, authenticated;

-- 2) call_logs: writes only via server (service_role).
DROP POLICY IF EXISTS "Users can insert their own call logs" ON public.call_logs;
DROP POLICY IF EXISTS "Callers can update their own call logs" ON public.call_logs;
REVOKE INSERT, UPDATE ON public.call_logs FROM authenticated;

-- 3) moderation_events: stricter INSERT.
DROP POLICY IF EXISTS "Users can submit moderation samples" ON public.moderation_events;

CREATE POLICY "Reporters can submit moderation samples"
ON public.moderation_events
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = reporter_user_id
  AND reporter_user_id IS DISTINCT FROM user_id
  AND ai_label  IS NULL
  AND ai_score  IS NULL
  AND ai_model  IS NULL
  AND severity  IS NULL
  AND status    IS NOT DISTINCT FROM 'pending'
);

-- 4) profiles: own/admin only, plus safe public view.
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;

CREATE POLICY "profiles readable by self or admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT
  p.id,
  p.username,
  p.bio,
  p.avatar_url,
  p.ai_avatar_style,
  p.avatar_path,
  p.gender,
  p.country,
  p.state,
  p.language,
  p.is_creator,
  p.availability,
  p.last_seen_at,
  p.streak_days,
  p.referral_code,
  p.created_at
FROM public.profiles p
WHERE p.deleted_at IS NULL
  AND NOT public.has_role(p.id, 'admin'::app_role);

GRANT SELECT ON public.public_profiles TO authenticated, anon;