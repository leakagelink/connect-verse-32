
INSERT INTO public.app_settings(key, value) VALUES
  ('payment_mode', '"test"'::jsonb),
  ('razorpay_key_id', '""'::jsonb),
  ('razorpay_key_secret', '""'::jsonb),
  ('razorpay_webhook_secret', '""'::jsonb)
ON CONFLICT (key) DO NOTHING;
