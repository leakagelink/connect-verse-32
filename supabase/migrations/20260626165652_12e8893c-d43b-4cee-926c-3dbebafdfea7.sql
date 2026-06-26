
-- presence
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS profiles_last_seen_idx ON public.profiles(last_seen_at DESC);

-- room kinds
DO $$ BEGIN
  CREATE TYPE public.room_kind AS ENUM ('voice','video','game','live');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- rooms
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  topic TEXT,
  kind public.room_kind NOT NULL DEFAULT 'voice',
  max_seats INT NOT NULL DEFAULT 8,
  is_active BOOLEAN NOT NULL DEFAULT true,
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "active rooms visible to authed" ON public.rooms;
CREATE POLICY "active rooms visible to authed" ON public.rooms
  FOR SELECT TO authenticated USING (is_active = true OR host_id = auth.uid());

DROP POLICY IF EXISTS "host can insert room" ON public.rooms;
CREATE POLICY "host can insert room" ON public.rooms
  FOR INSERT TO authenticated WITH CHECK (host_id = auth.uid());

DROP POLICY IF EXISTS "host can update room" ON public.rooms;
CREATE POLICY "host can update room" ON public.rooms
  FOR UPDATE TO authenticated USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());

DROP POLICY IF EXISTS "host can delete room" ON public.rooms;
CREATE POLICY "host can delete room" ON public.rooms
  FOR DELETE TO authenticated USING (host_id = auth.uid());

CREATE INDEX IF NOT EXISTS rooms_active_idx ON public.rooms(is_active, created_at DESC);

DROP TRIGGER IF EXISTS rooms_updated_at ON public.rooms;
CREATE TRIGGER rooms_updated_at BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- room participants
CREATE TABLE IF NOT EXISTS public.room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_participants TO authenticated;
GRANT ALL ON public.room_participants TO service_role;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authed can view participants" ON public.room_participants;
CREATE POLICY "authed can view participants" ON public.room_participants
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "user joins themselves" ON public.room_participants;
CREATE POLICY "user joins themselves" ON public.room_participants
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user leaves themselves" ON public.room_participants;
CREATE POLICY "user leaves themselves" ON public.room_participants
  FOR DELETE TO authenticated USING (user_id = auth.uid());
