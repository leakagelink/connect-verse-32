
-- KYC requests table
CREATE TABLE public.kyc_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  dob date NOT NULL,
  pan_number text NOT NULL,
  aadhaar_last4 text NOT NULL,
  pan_doc_path text NOT NULL,
  aadhaar_front_path text NOT NULL,
  aadhaar_back_path text NOT NULL,
  selfie_path text NOT NULL,
  payout_method text NOT NULL CHECK (payout_method IN ('bank','upi')),
  bank_account_name text,
  bank_account_number text,
  bank_ifsc text,
  upi_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kyc_requests_user_idx ON public.kyc_requests(user_id);
CREATE INDEX kyc_requests_status_idx ON public.kyc_requests(status);

GRANT SELECT, INSERT, UPDATE ON public.kyc_requests TO authenticated;
GRANT ALL ON public.kyc_requests TO service_role;
ALTER TABLE public.kyc_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own kyc" ON public.kyc_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users insert own kyc" ON public.kyc_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins update kyc" ON public.kyc_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER kyc_requests_updated BEFORE UPDATE ON public.kyc_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Withdrawals
CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coins integer NOT NULL CHECK (coins > 0),
  inr_amount numeric(10,2) NOT NULL CHECK (inr_amount > 0),
  payout_method text NOT NULL CHECK (payout_method IN ('bank','upi')),
  payout_snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','rejected')),
  admin_notes text,
  utr_reference text,
  processed_by uuid REFERENCES auth.users(id),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX withdrawals_user_idx ON public.withdrawals(user_id);
CREATE INDEX withdrawals_status_idx ON public.withdrawals(status);

GRANT SELECT, INSERT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own withdrawals" ON public.withdrawals FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users insert own withdrawals" ON public.withdrawals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins update withdrawals" ON public.withdrawals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER withdrawals_updated BEFORE UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Default settings
INSERT INTO public.app_settings(key, value) VALUES
  ('min_withdrawal_coins', '10000'),
  ('coin_to_inr_rate', '0.05')
ON CONFLICT (key) DO NOTHING;
