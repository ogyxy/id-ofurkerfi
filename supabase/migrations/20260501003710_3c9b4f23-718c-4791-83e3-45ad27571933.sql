
-- Add invoice approval workflow columns to purchase_orders
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS invoice_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_approved_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS invoice_registered_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Enforce that every PO is linked to a deal (verified zero orphans).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.purchase_orders WHERE deal_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce NOT NULL on purchase_orders.deal_id: orphan rows exist';
  END IF;
END $$;

ALTER TABLE public.purchase_orders
  ALTER COLUMN deal_id SET NOT NULL;
