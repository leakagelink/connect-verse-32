
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android','ios','web')),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (token)
);
CREATE INDEX IF NOT EXISTS device_tokens_user_idx ON public.device_tokens(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own tokens" ON public.device_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own tokens" ON public.device_tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own tokens" ON public.device_tokens FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own tokens" ON public.device_tokens FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Broadcast log (for admin auditing)
CREATE TABLE IF NOT EXISTS public.push_broadcasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT,
  deep_link TEXT,
  audience TEXT NOT NULL DEFAULT 'all',
  recipients_count INT NOT NULL DEFAULT 0,
  push_sent_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.push_broadcasts TO authenticated;
GRANT ALL ON public.push_broadcasts TO service_role;
ALTER TABLE public.push_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read broadcasts" ON public.push_broadcasts FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert broadcasts" ON public.push_broadcasts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
