ALTER TABLE public.deals
  ADD COLUMN payday_currency_code text,
  ADD COLUMN payday_foreign_amount_excl_vsk numeric,
  ADD COLUMN payday_foreign_amount_incl_vsk numeric;