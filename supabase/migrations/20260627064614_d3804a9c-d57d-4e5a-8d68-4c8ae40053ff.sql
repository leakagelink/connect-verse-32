-- creator_availability
CREATE TABLE IF NOT EXISTS public.creator_availability (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  accepting_calls boolean NOT NULL DEFAULT true,
  slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  tz text NOT NULL DEFAULT 'Asia/Kolkata',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_availability TO authenticated;
GRANT SELECT ON public.creator_availability TO anon;
GRANT ALL ON public.creator_availability TO service_role;
ALTER TABLE public.creator_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads availability" ON public.creator_availability FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "owner inserts availability" ON public.creator_availability FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner updates availability" ON public.creator_availability FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner deletes availability" ON public.creator_availability FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- fan_clubs
CREATE TABLE IF NOT EXISTS public.fan_clubs (
  creator_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Fan Club',
  tagline text,
  perks jsonb NOT NULL DEFAULT '[]'::jsonb,
  monthly_coins integer NOT NULL DEFAULT 500 CHECK (monthly_coins >= 50),
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fan_clubs TO authenticated;
GRANT SELECT ON public.fan_clubs TO anon;
GRANT ALL ON public.fan_clubs TO service_role;
ALTER TABLE public.fan_clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads fan_clubs" ON public.fan_clubs FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "creator inserts own fan_club" ON public.fan_clubs FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "creator updates own fan_club" ON public.fan_clubs FOR UPDATE TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "creator deletes own fan_club" ON public.fan_clubs FOR DELETE TO authenticated USING (auth.uid() = creator_id);

-- fan_club_members
CREATE TABLE IF NOT EXISTS public.fan_club_members (
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fan_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  coins_paid integer NOT NULL CHECK (coins_paid >= 0),
  PRIMARY KEY (creator_id, fan_id)
);
CREATE INDEX IF NOT EXISTS fan_club_members_creator_idx ON public.fan_club_members (creator_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS fan_club_members_fan_idx ON public.fan_club_members (fan_id, expires_at DESC);
GRANT SELECT ON public.fan_club_members TO authenticated;
GRANT ALL ON public.fan_club_members TO service_role;
ALTER TABLE public.fan_club_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "involved reads membership" ON public.fan_club_members FOR SELECT TO authenticated USING (auth.uid() = fan_id OR auth.uid() = creator_id);

-- earnings views
CREATE OR REPLACE VIEW public.creator_earnings_30d
WITH (security_invoker = true) AS
SELECT
  p.id AS creator_id,
  COALESCE(g.gift_coins, 0)::int        AS gift_coins_30d,
  COALESCE(g.gift_count, 0)::int        AS gift_count_30d,
  COALESCE(g.unique_senders, 0)::int    AS unique_senders_30d,
  COALESCE(c.call_seconds, 0)::int      AS call_seconds_30d,
  COALESCE(c.call_count, 0)::int        AS call_count_30d,
  COALESCE(f.fan_income, 0)::int        AS fan_club_coins_30d,
  COALESCE(f.fan_count, 0)::int         AS fan_club_signups_30d,
  (COALESCE(g.gift_coins, 0) + COALESCE(f.fan_income, 0))::int AS total_coins_30d
FROM public.profiles p
LEFT JOIN (
  SELECT receiver_id,
         SUM(coins_spent) AS gift_coins,
         COUNT(*)         AS gift_count,
         COUNT(DISTINCT sender_id) AS unique_senders
  FROM public.gift_sends
  WHERE created_at >= now() - INTERVAL '30 days'
  GROUP BY receiver_id
) g ON g.receiver_id = p.id
LEFT JOIN (
  SELECT callee_id,
         SUM(duration_seconds) AS call_seconds,
         COUNT(*)              AS call_count
  FROM public.call_logs
  WHERE started_at >= now() - INTERVAL '30 days'
  GROUP BY callee_id
) c ON c.callee_id = p.id
LEFT JOIN (
  SELECT creator_id,
         SUM(coins_paid) AS fan_income,
         COUNT(*)        AS fan_count
  FROM public.fan_club_members
  WHERE joined_at >= now() - INTERVAL '30 days'
  GROUP BY creator_id
) f ON f.creator_id = p.id;

GRANT SELECT ON public.creator_earnings_30d TO authenticated;

CREATE OR REPLACE VIEW public.creator_earnings_daily
WITH (security_invoker = true) AS
SELECT
  receiver_id AS creator_id,
  date_trunc('day', created_at)::date AS day,
  SUM(coins_spent)::int               AS coins
FROM public.gift_sends
WHERE created_at >= now() - INTERVAL '30 days'
GROUP BY receiver_id, date_trunc('day', created_at)::date;

GRANT SELECT ON public.creator_earnings_daily TO authenticated;