ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS delivered_to_customer_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS delivered_to_customer_by uuid NULL REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_po_delivered_to_customer_at
  ON public.purchase_orders(delivered_to_customer_at);

CREATE OR REPLACE FUNCTION public.auto_advance_deal_on_po_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deal_id uuid;
  v_stage deal_stage;
  v_outstanding int;
  v_total_active int;
  v_last_delivered_at timestamptz;
BEGIN
  v_deal_id := COALESCE(NEW.deal_id, OLD.deal_id);
  IF v_deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT stage INTO v_stage FROM public.deals WHERE id = v_deal_id;
  IF v_stage IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_stage IN ('delivered', 'cancelled') THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE status <> 'cancelled'),
    COUNT(*) FILTER (WHERE status <> 'cancelled' AND delivered_to_customer_at IS NULL),
    MAX(delivered_to_customer_at) FILTER (WHERE status <> 'cancelled')
  INTO v_total_active, v_outstanding, v_last_delivered_at
  FROM public.purchase_orders
  WHERE deal_id = v_deal_id;

  IF v_total_active > 0 AND v_outstanding = 0 THEN
    UPDATE public.deals
       SET stage = 'delivered',
           delivered_at = COALESCE(v_last_delivered_at::date, CURRENT_DATE),
           updated_at = now()
     WHERE id = v_deal_id
       AND stage NOT IN ('delivered', 'cancelled');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_advance_deal_on_po_delivery ON public.purchase_orders;
CREATE TRIGGER trg_auto_advance_deal_on_po_delivery
AFTER INSERT OR UPDATE OF delivered_to_customer_at, status ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_advance_deal_on_po_delivery();