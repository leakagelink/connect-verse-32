
CREATE TABLE public.mystery_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_log_id UUID REFERENCES public.call_logs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  brief TEXT NOT NULL,
  setting TEXT,
  persons JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  culprit_id TEXT NOT NULL,
  solution_explanation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','solved','abandoned')),
  coins_spent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.mystery_cases TO authenticated;
GRANT ALL ON public.mystery_cases TO service_role;

ALTER TABLE public.mystery_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view their own cases"
  ON public.mystery_cases FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = partner_id);

CREATE POLICY "Creator can update status"
  ON public.mystery_cases FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

-- Inserts are performed by the server (service role) after charging coins, so no INSERT policy needed for clients.

CREATE TRIGGER mystery_cases_updated_at
  BEFORE UPDATE ON public.mystery_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX mystery_cases_created_by_idx ON public.mystery_cases (created_by, created_at DESC);
CREATE INDEX mystery_cases_partner_idx ON public.mystery_cases (partner_id, created_at DESC);

CREATE TABLE public.case_guesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.mystery_cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guessed_person_id TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_id, user_id)
);

GRANT SELECT, INSERT ON public.case_guesses TO authenticated;
GRANT ALL ON public.case_guesses TO service_role;

ALTER TABLE public.case_guesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view guesses on their cases"
  ON public.case_guesses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mystery_cases c
      WHERE c.id = case_id
        AND (c.created_by = auth.uid() OR c.partner_id = auth.uid())
    )
  );

CREATE POLICY "Players can submit their own guess"
  ON public.case_guesses FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.mystery_cases c
      WHERE c.id = case_id
        AND (c.created_by = auth.uid() OR c.partner_id = auth.uid())
    )
  );
