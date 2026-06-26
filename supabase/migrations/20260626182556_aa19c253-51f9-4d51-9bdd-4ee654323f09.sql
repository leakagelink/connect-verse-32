
-- Catalog of available gifts
CREATE TABLE public.gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  emoji text NOT NULL,
  coin_cost integer NOT NULL CHECK (coin_cost > 0),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gifts TO authenticated, anon;
GRANT ALL ON public.gifts TO service_role;
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads active gifts" ON public.gifts FOR SELECT USING (is_active = true);

-- Sent gifts log
CREATE TABLE public.gift_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gift_id uuid NOT NULL REFERENCES public.gifts(id),
  call_log_id uuid REFERENCES public.call_logs(id) ON DELETE SET NULL,
  coins_spent integer NOT NULL CHECK (coins_spent >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gift_sends_call_idx ON public.gift_sends (call_log_id, created_at DESC);
CREATE INDEX gift_sends_sender_idx ON public.gift_sends (sender_id, created_at DESC);
CREATE INDEX gift_sends_receiver_idx ON public.gift_sends (receiver_id, created_at DESC);
GRANT SELECT, INSERT ON public.gift_sends TO authenticated;
GRANT ALL ON public.gift_sends TO service_role;
ALTER TABLE public.gift_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own gifts" ON public.gift_sends FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
-- inserts are performed by service role inside server function (no direct insert policy)

-- enable realtime so receiver sees gifts live
ALTER PUBLICATION supabase_realtime ADD TABLE public.gift_sends;

-- seed starter gift catalog
INSERT INTO public.gifts (code, name, emoji, coin_cost, sort_order) VALUES
  ('rose', 'Rose', '🌹', 10, 1),
  ('heart', 'Heart', '❤️', 20, 2),
  ('kiss', 'Kiss', '💋', 50, 3),
  ('teddy', 'Teddy', '🧸', 100, 4),
  ('cake', 'Cake', '🎂', 200, 5),
  ('diamond', 'Diamond', '💎', 500, 6),
  ('crown', 'Crown', '👑', 1000, 7),
  ('rocket', 'Rocket', '🚀', 2000, 8)
ON CONFLICT (code) DO NOTHING;
