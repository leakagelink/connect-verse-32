
CREATE TYPE public.follow_status AS ENUM ('pending','accepted');

CREATE TABLE public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.follow_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view follows involving them"
ON public.follows FOR SELECT TO authenticated
USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE POLICY "users can request a follow"
ON public.follows FOR INSERT TO authenticated
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "target can update follow status"
ON public.follows FOR UPDATE TO authenticated
USING (auth.uid() = following_id OR auth.uid() = follower_id)
WITH CHECK (auth.uid() = following_id OR auth.uid() = follower_id);

CREATE POLICY "either side can delete follow"
ON public.follows FOR DELETE TO authenticated
USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE TRIGGER follows_set_updated_at
BEFORE UPDATE ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX follows_following_idx ON public.follows(following_id, status);
CREATE INDEX follows_follower_idx ON public.follows(follower_id, status);
