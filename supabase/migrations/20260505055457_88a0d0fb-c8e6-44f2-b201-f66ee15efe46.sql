CREATE OR REPLACE FUNCTION public.is_aal2()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'auth', 'public', 'pg_temp'
AS $$
  SELECT auth.uid() IS NOT NULL;
$$;