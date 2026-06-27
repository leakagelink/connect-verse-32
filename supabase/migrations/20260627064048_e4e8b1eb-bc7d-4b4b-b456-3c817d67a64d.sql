
-- Profile columns for streaks + referrals
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS streak_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_checkin_date DATE,
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_referral_code_idx ON public.profiles (referral_code);
CREATE INDEX IF NOT EXISTS profiles_referred_by_idx ON public.profiles (referred_by);

-- Random 8-char alphanumeric code generator (no ambiguous chars).
-- Plain SECURITY INVOKER. EXECUTE is restricted to service_role to avoid lint warnings.
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  i INTEGER;
  exists_count INTEGER;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    SELECT COUNT(*) INTO exists_count FROM public.profiles WHERE referral_code = code;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN code;
END;
$$;
REVOKE ALL ON FUNCTION public.generate_referral_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_referral_code() TO service_role;

-- Backfill referral codes for existing profiles
UPDATE public.profiles
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL;

-- Trigger to auto-assign on new profile insert
CREATE OR REPLACE FUNCTION public.profiles_set_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.profiles_set_referral_code() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_referral_code_trigger ON public.profiles;
CREATE TRIGGER profiles_referral_code_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_set_referral_code();

-- Daily check-in log
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  day_index INTEGER NOT NULL CHECK (day_index BETWEEN 1 AND 7),
  coins_awarded INTEGER NOT NULL CHECK (coins_awarded >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, checkin_date)
);
CREATE INDEX IF NOT EXISTS daily_checkins_user_idx ON public.daily_checkins (user_id, checkin_date DESC);

GRANT SELECT ON public.daily_checkins TO authenticated;
GRANT ALL ON public.daily_checkins TO service_role;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own checkins" ON public.daily_checkins
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code_used TEXT NOT NULL,
  signup_bonus_coins INTEGER NOT NULL DEFAULT 0,
  recharge_bonus_coins INTEGER NOT NULL DEFAULT 0,
  first_recharge_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals (referrer_id, created_at DESC);

GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read referrals they are part of" ON public.referrals
  FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

-- 7-day creator leaderboard view
CREATE OR REPLACE VIEW public.creator_leaderboard_7d
WITH (security_invoker = true)
AS
SELECT
  p.id            AS user_id,
  p.username,
  p.avatar_url,
  p.country,
  p.language,
  p.is_creator,
  COALESCE(SUM(g.coins_spent), 0)::INTEGER AS coins_received,
  COUNT(g.id)::INTEGER                     AS gifts_count
FROM public.profiles p
LEFT JOIN public.gift_sends g
  ON g.receiver_id = p.id
  AND g.created_at >= (now() - interval '7 days')
WHERE p.is_banned = false
GROUP BY p.id
HAVING COALESCE(SUM(g.coins_spent), 0) > 0
ORDER BY coins_received DESC
LIMIT 50;

GRANT SELECT ON public.creator_leaderboard_7d TO authenticated;
