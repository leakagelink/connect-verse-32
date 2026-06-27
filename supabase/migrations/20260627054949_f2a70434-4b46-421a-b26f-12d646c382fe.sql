
-- Phase 2: Female safety & anti-abuse
-- 1) Creator DND / Busy + Country/State blocks
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS blocked_countries text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS blocked_states text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS device_fp text,
  ADD COLUMN IF NOT EXISTS ip_hash text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_availability_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_availability_check
  CHECK (availability IN ('online','busy','dnd'));

-- 2) Ladies Lounge rooms
ALTER TABLE public.rooms 
  ADD COLUMN IF NOT EXISTS gender_gate text NOT NULL DEFAULT 'all';
ALTER TABLE public.rooms
  DROP CONSTRAINT IF EXISTS rooms_gender_gate_check;
ALTER TABLE public.rooms
  ADD CONSTRAINT rooms_gender_gate_check
  CHECK (gender_gate IN ('all','ladies_lounge'));

-- 3) Ban signals (repeat-offender shadow list)
CREATE TABLE IF NOT EXISTS public.ban_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type text NOT NULL CHECK (signal_type IN ('device','ip_hash')),
  signal_value text NOT NULL,
  source_user_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ban_signals_unique 
  ON public.ban_signals(signal_type, signal_value);
CREATE INDEX IF NOT EXISTS ban_signals_source_idx 
  ON public.ban_signals(source_user_id);

GRANT SELECT ON public.ban_signals TO authenticated;
GRANT ALL ON public.ban_signals TO service_role;
ALTER TABLE public.ban_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read ban signals" ON public.ban_signals;
CREATE POLICY "Admins read ban signals" 
  ON public.ban_signals FOR SELECT 
  USING (public.has_role(auth.uid(), 'admin'));

-- helper: check if a signal matches the shadow list
CREATE OR REPLACE FUNCTION public.is_signal_banned(_type text, _value text)
RETURNS boolean 
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ban_signals 
    WHERE signal_type=_type AND signal_value=_value
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_signal_banned(text,text) TO authenticated;

-- trigger: when a profile is banned, persist its device_fp / ip_hash so 
-- future signups from the same signal can be auto-flagged.
CREATE OR REPLACE FUNCTION public.record_ban_signals()
RETURNS TRIGGER 
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.is_banned = TRUE AND (OLD.is_banned IS DISTINCT FROM NEW.is_banned) THEN
    IF NEW.device_fp IS NOT NULL THEN
      INSERT INTO public.ban_signals(signal_type, signal_value, source_user_id, reason)
      VALUES ('device', NEW.device_fp, NEW.id, NEW.ban_reason)
      ON CONFLICT (signal_type, signal_value) DO NOTHING;
    END IF;
    IF NEW.ip_hash IS NOT NULL THEN
      INSERT INTO public.ban_signals(signal_type, signal_value, source_user_id, reason)
      VALUES ('ip_hash', NEW.ip_hash, NEW.id, NEW.ban_reason)
      ON CONFLICT (signal_type, signal_value) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_record_ban_signals ON public.profiles;
CREATE TRIGGER profiles_record_ban_signals
AFTER UPDATE OF is_banned ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.record_ban_signals();
