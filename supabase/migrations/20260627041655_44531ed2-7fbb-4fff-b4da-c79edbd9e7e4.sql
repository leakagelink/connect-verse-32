
ALTER TYPE public.txn_type ADD VALUE IF NOT EXISTS 'withdrawal_hold';
ALTER TYPE public.txn_type ADD VALUE IF NOT EXISTS 'withdrawal_refund';
ALTER TYPE public.txn_type ADD VALUE IF NOT EXISTS 'withdrawal_paid';
