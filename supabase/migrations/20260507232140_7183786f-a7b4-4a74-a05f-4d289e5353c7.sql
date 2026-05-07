-- Sales targets per user, per period (quarter or year)
CREATE TABLE public.sales_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_type text NOT NULL CHECK (period_type IN ('quarter','year')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  target_isk numeric NOT NULL CHECK (target_isk >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, period_type, period_start)
);

CREATE INDEX idx_sales_targets_owner_period
  ON public.sales_targets (owner_id, period_start DESC);

ALTER TABLE public.sales_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "all users read sales_targets"
  ON public.sales_targets
  FOR SELECT
  USING (is_sala_user());

CREATE POLICY "admin insert sales_targets"
  ON public.sales_targets
  FOR INSERT
  WITH CHECK (is_sala_admin() AND is_aal2());

CREATE POLICY "admin update sales_targets"
  ON public.sales_targets
  FOR UPDATE
  USING (is_sala_admin() AND is_aal2());

CREATE POLICY "admin delete sales_targets"
  ON public.sales_targets
  FOR DELETE
  USING (is_sala_admin() AND is_aal2());

CREATE TRIGGER set_sales_targets_updated_at
  BEFORE UPDATE ON public.sales_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();