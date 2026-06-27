
-- Add 'razorpay' as a transaction type if enum exists; safe-guard
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
    BEGIN
      ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'razorpay';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.razorpay_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.coin_plans(id),
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT,
  amount_paise BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created', -- created | paid | failed | credited
  coins_credited BIGINT,
  bonus_credited BIGINT,
  notes JSONB,
  webhook_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  credited_at TIMESTAMPTZ
);

GRANT SELECT ON public.razorpay_orders TO authenticated;
GRANT ALL ON public.razorpay_orders TO service_role;

ALTER TABLE public.razorpay_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own orders" ON public.razorpay_orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_razorpay_orders_user ON public.razorpay_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_razorpay_orders_status ON public.razorpay_orders(status);

CREATE TRIGGER set_razorpay_orders_updated_at
  BEFORE UPDATE ON public.razorpay_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Atomic credit function: idempotent on razorpay_order_id
CREATE OR REPLACE FUNCTION public.credit_razorpay_payment(
  _order_id TEXT,
  _payment_id TEXT,
  _payload JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o RECORD;
  w RECORD;
  base_coins BIGINT;
  bonus_pct NUMERIC;
  bonus_coins BIGINT;
  new_balance BIGINT;
  new_count INT;
BEGIN
  SELECT * INTO o FROM public.razorpay_orders WHERE razorpay_order_id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'order_not_found');
  END IF;
  IF o.status = 'credited' THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  SELECT coins, price_inr INTO base_coins, bonus_pct FROM public.coin_plans WHERE id = o.plan_id;
  IF base_coins IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'plan_missing');
  END IF;

  SELECT * INTO w FROM public.wallets WHERE user_id = o.user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wallet_missing');
  END IF;

  -- bonus tiers: 1st=50%, 2nd=40%, 3rd=30%, else 0
  bonus_pct := CASE w.deposit_count
    WHEN 0 THEN 0.50
    WHEN 1 THEN 0.40
    WHEN 2 THEN 0.30
    ELSE 0
  END;
  bonus_coins := FLOOR(base_coins * bonus_pct);
  new_balance := w.coin_balance + base_coins + bonus_coins;
  new_count := w.deposit_count + 1;

  UPDATE public.wallets
    SET coin_balance = new_balance,
        total_recharged_inr = w.total_recharged_inr + (o.amount_paise / 100.0),
        deposit_count = new_count,
        updated_at = now()
    WHERE user_id = o.user_id;

  UPDATE public.razorpay_orders
    SET status = 'credited',
        razorpay_payment_id = _payment_id,
        webhook_payload = _payload,
        coins_credited = base_coins,
        bonus_credited = bonus_coins,
        paid_at = COALESCE(paid_at, now()),
        credited_at = now()
    WHERE id = o.id;

  INSERT INTO public.transactions(user_id, type, coins_delta, inr_amount, plan_id, metadata)
  VALUES (o.user_id, 'recharge', base_coins, o.amount_paise / 100.0, o.plan_id,
          jsonb_build_object('razorpay_order_id', _order_id, 'razorpay_payment_id', _payment_id));

  IF bonus_coins > 0 THEN
    INSERT INTO public.transactions(user_id, type, coins_delta, inr_amount, plan_id, metadata)
    VALUES (o.user_id, 'bonus', bonus_coins, 0, o.plan_id,
            jsonb_build_object('bonus_pct', bonus_pct, 'deposit_no', new_count, 'razorpay_order_id', _order_id));
  END IF;

  RETURN jsonb_build_object('ok', true, 'coins', base_coins, 'bonus', bonus_coins, 'balance', new_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.credit_razorpay_payment(TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_razorpay_payment(TEXT, TEXT, JSONB) TO service_role;
