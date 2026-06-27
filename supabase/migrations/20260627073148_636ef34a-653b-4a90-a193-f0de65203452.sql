
-- ============= Matchmaker Rooms =============
CREATE TABLE public.matchmaker_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  topic TEXT,
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live','ended')),
  agora_channel TEXT NOT NULL UNIQUE,
  winner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  listener_count INT NOT NULL DEFAULT 0,
  candidate_count INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mm_rooms_status ON public.matchmaker_rooms(status, started_at DESC);
CREATE INDEX idx_mm_rooms_host ON public.matchmaker_rooms(host_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.matchmaker_rooms TO authenticated;
GRANT ALL ON public.matchmaker_rooms TO service_role;
ALTER TABLE public.matchmaker_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authed can view live rooms"
  ON public.matchmaker_rooms FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Only female creators host rooms"
  ON public.matchmaker_rooms FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = host_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND gender = 'female' AND is_banned = false
    )
  );

CREATE POLICY "Host or admin can end room"
  ON public.matchmaker_rooms FOR UPDATE
  TO authenticated USING (
    auth.uid() = host_id OR public.has_role(auth.uid(), 'admin'::app_role)
  ) WITH CHECK (
    auth.uid() = host_id OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admin can delete"
  ON public.matchmaker_rooms FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============= Candidates =============
CREATE TABLE public.matchmaker_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.matchmaker_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seat INT NOT NULL CHECK (seat IN (1,2)),
  vote_score INT NOT NULL DEFAULT 0,
  gift_score INT NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, seat),
  UNIQUE(room_id, user_id)
);
CREATE INDEX idx_mm_cand_room ON public.matchmaker_candidates(room_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.matchmaker_candidates TO authenticated;
GRANT ALL ON public.matchmaker_candidates TO service_role;
ALTER TABLE public.matchmaker_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authed can view candidates"
  ON public.matchmaker_candidates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Only male users can join as candidate"
  ON public.matchmaker_candidates FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND gender = 'male' AND is_banned = false
    )
  );

CREATE POLICY "Candidate or host can update score"
  ON public.matchmaker_candidates FOR UPDATE
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.matchmaker_rooms r WHERE r.id = room_id AND r.host_id = auth.uid())
  );

CREATE POLICY "Candidate or host can leave/remove"
  ON public.matchmaker_candidates FOR DELETE
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.matchmaker_rooms r WHERE r.id = room_id AND r.host_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ============= Votes =============
CREATE TABLE public.matchmaker_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.matchmaker_rooms(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.matchmaker_candidates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, voter_id)
);
CREATE INDEX idx_mm_votes_room ON public.matchmaker_votes(room_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.matchmaker_votes TO authenticated;
GRANT ALL ON public.matchmaker_votes TO service_role;
ALTER TABLE public.matchmaker_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authed can view votes"
  ON public.matchmaker_votes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "User casts own vote"
  ON public.matchmaker_votes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = voter_id);

CREATE POLICY "User can change own vote"
  ON public.matchmaker_votes FOR UPDATE
  TO authenticated USING (auth.uid() = voter_id) WITH CHECK (auth.uid() = voter_id);

CREATE POLICY "User can retract own vote"
  ON public.matchmaker_votes FOR DELETE
  TO authenticated USING (auth.uid() = voter_id);

-- ============= Auto-update vote_score trigger =============
CREATE OR REPLACE FUNCTION public.mm_recalc_candidate_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_candidate UUID;
BEGIN
  target_candidate := COALESCE(NEW.candidate_id, OLD.candidate_id);
  UPDATE public.matchmaker_candidates
    SET vote_score = (
      SELECT COUNT(*)::INT FROM public.matchmaker_votes WHERE candidate_id = target_candidate
    )
    WHERE id = target_candidate;
  -- handle UPDATE (vote moved from one candidate to another)
  IF TG_OP = 'UPDATE' AND OLD.candidate_id IS DISTINCT FROM NEW.candidate_id THEN
    UPDATE public.matchmaker_candidates
      SET vote_score = (
        SELECT COUNT(*)::INT FROM public.matchmaker_votes WHERE candidate_id = OLD.candidate_id
      )
      WHERE id = OLD.candidate_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER mm_votes_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.matchmaker_votes
FOR EACH ROW EXECUTE FUNCTION public.mm_recalc_candidate_score();
