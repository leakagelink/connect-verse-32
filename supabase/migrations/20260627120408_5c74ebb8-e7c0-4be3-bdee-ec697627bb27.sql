-- Hide admin accounts from regular users everywhere
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;

CREATE POLICY "profiles readable by authenticated"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR NOT has_role(id, 'admin'::app_role)
);