
-- 1. extend txn_type enum
ALTER TYPE public.txn_type ADD VALUE IF NOT EXISTS 'gift_spend';
ALTER TYPE public.txn_type ADD VALUE IF NOT EXISTS 'gift_received';
