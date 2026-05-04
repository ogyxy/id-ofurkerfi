-- 1. Pin search_path on SECURITY DEFINER helpers
CREATE OR REPLACE FUNCTION public.is_sala_sales()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND active = true AND role IN ('admin', 'sales')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_sala_designer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND active = true AND role = 'designer'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_sala_readonly()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND active = true AND role = 'viewer'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_sala_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND active = true AND role IN ('admin', 'sales', 'designer', 'viewer')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_aal2()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'auth', 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.sessions
    WHERE id = (auth.jwt() ->> 'session_id')::uuid AND aal = 'aal2'
  );
$$;

-- 2. Pin search_path on remaining functions flagged by the linter
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.next_so_number()
RETURNS text LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
begin
  return 'SO-' || lpad(nextval('so_number_seq')::text, 6, '0');
end;
$$;

CREATE OR REPLACE FUNCTION public.next_po_number()
RETURNS text LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
begin
  return 'PO-' || lpad(nextval('po_number_seq')::text, 6, '0');
end;
$$;

-- 3. Explicit admin-only SELECT policy for payday_auth (defense-in-depth)
DROP POLICY IF EXISTS "admin read payday_auth" ON public.payday_auth;
CREATE POLICY "admin read payday_auth"
ON public.payday_auth FOR SELECT
USING (is_sala_admin());

-- 4. Tighten storage policies for deal_files bucket
DROP POLICY IF EXISTS "deal_files staff insert" ON storage.objects;
DROP POLICY IF EXISTS "deal_files staff update" ON storage.objects;
DROP POLICY IF EXISTS "deal_files staff delete" ON storage.objects;

CREATE POLICY "deal_files sales/designer insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'deal_files'
  AND (is_sala_sales() OR is_sala_designer())
  AND is_aal2()
);

CREATE POLICY "deal_files sales update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'deal_files'
  AND is_sala_sales()
  AND is_aal2()
);

CREATE POLICY "deal_files sales delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'deal_files'
  AND is_sala_sales()
  AND is_aal2()
);

-- 5. Tighten storage policies for po_files bucket
DROP POLICY IF EXISTS "po_files staff insert" ON storage.objects;
DROP POLICY IF EXISTS "po_files staff update" ON storage.objects;
DROP POLICY IF EXISTS "po_files staff delete" ON storage.objects;
DROP POLICY IF EXISTS "po_files staff read" ON storage.objects;

CREATE POLICY "po_files sales read"
ON storage.objects FOR SELECT
USING (bucket_id = 'po_files' AND is_sala_sales());

CREATE POLICY "po_files sales insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'po_files'
  AND is_sala_sales()
  AND is_aal2()
);

CREATE POLICY "po_files sales update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'po_files'
  AND is_sala_sales()
  AND is_aal2()
);

CREATE POLICY "po_files sales delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'po_files'
  AND is_sala_sales()
  AND is_aal2()
);