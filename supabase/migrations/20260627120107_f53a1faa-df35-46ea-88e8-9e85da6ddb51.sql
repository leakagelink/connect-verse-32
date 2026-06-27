
-- Replace handle_new_user to also auto-admin a designated owner email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, username) VALUES (NEW.id, NULL)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.wallets (user_id, coin_balance) VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT (COUNT(*) = 0) INTO is_first FROM public.user_roles WHERE role = 'admin';
  IF is_first OR lower(NEW.email) = 'hello@socilet.in' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- If the account already exists, promote it to admin right now
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE lower(email) = 'hello@socilet.in'
ON CONFLICT DO NOTHING;
