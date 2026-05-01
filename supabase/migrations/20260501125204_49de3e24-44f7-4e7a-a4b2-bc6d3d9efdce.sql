-- Singleton table holding the active Payday bearer token.
CREATE TABLE public.payday_auth (
  id          int PRIMARY KEY DEFAULT 1,
  access_token text NOT NULL,
  expires_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payday_auth_singleton CHECK (id = 1)
);

ALTER TABLE public.payday_auth ENABLE ROW LEVEL SECURITY;
-- No policies created on purpose -> only service role can access.

-- New columns on deals for Payday integration.
ALTER TABLE public.deals
  ADD COLUMN payday_invoice_id            text,
  ADD COLUMN payday_synced_at             timestamptz,
  ADD COLUMN amount_invoiced_with_vsk_isk numeric;

-- Drop 'partial' from invoice_status enum.
UPDATE public.deals SET invoice_status = 'full' WHERE invoice_status = 'partial';

ALTER TYPE invoice_status RENAME TO invoice_status_old;
CREATE TYPE invoice_status AS ENUM ('not_invoiced', 'full');

ALTER TABLE public.deals
  ALTER COLUMN invoice_status DROP DEFAULT,
  ALTER COLUMN invoice_status TYPE invoice_status
    USING invoice_status::text::invoice_status,
  ALTER COLUMN invoice_status SET DEFAULT 'not_invoiced';

DROP TYPE invoice_status_old;