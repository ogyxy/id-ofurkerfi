## Goal

Add a second row of filter pills on `/deals` that filters by **Payday-derived status** (the same chips users already see on a deal: Ekki rukkað / Rukkað / Greitt / Ógreitt). This is independent from the existing stage stepper row, so users can combine e.g. "Afhent" + "Ógreitt" to find delivered deals that haven't been paid yet.

## UX

A new pill row appears directly under the existing stage row, with the label **"Reikningsstaða"** (so it's visually distinct from the stage row). Pills:

```text
Stages:    [Fyrirspurn] [Tilboð] [Pöntun] [Afhent] [Galli/Vesen] [Hætt við]
Payday:    [Ekki rukkað] [Rukkað að hluta] [Rukkað] · [Ógreitt] [Greitt að hluta] [Greitt]
```

Behaviour rules:

- **Single select per group** (mirrors stage row). Click an active pill to clear it. Both groups share the same row but are separated by a thin vertical divider (`·`).
- **Counts in parentheses** like the stage pills, computed from the current dataset *after* search/year/owner filters but *before* Payday filters — so counts show "what would I see if I clicked this".
- **Combines additively** with stage filter, owner filter, year, and search. E.g. Afhent + Ógreitt narrows the list further.
- **Collapse-on-active** (mirrors stage row): when a Payday pill is active, only that pill stays visible with an `X` to clear, matching the existing pattern in `DealsTab.tsx` and the stage row.
- Visible only on `/deals` list (not company detail tab) for v1; can be added to `DealsTab.tsx` later if useful.

## Why two pills (invoice + payment) instead of one combined "Payday status"

The deal has two independent Payday-derived enums:
- `invoice_status`: `not_invoiced | partial | full`
- `payment_status`: `unpaid | partial | paid`

Combining them into one list (e.g. "Rukkað og greitt", "Rukkað og ógreitt", "Rukkað að hluta og greitt að hluta", …) explodes into 9 combinations and hides the dimension the user actually cares about. Keeping them as two pill subgroups in one row is cleaner and matches how the data already renders on the deal card.

## Filter semantics (edge cases)

- "Ekki rukkað" = `invoice_status = 'not_invoiced'` AND `payday_invoice_id IS NULL`. (A deal with `payday_invoice_id` set should never be in this bucket; current data model already guarantees this via the link flow.)
- "Rukkað" pill = `invoice_status = 'full'`. "Rukkað að hluta" = `'partial'`.
- Payment pills filter purely on `payment_status`.
- A deal that is `not_invoiced` is still allowed to match a payment pill of `unpaid` — but in practice "Ógreitt + Ekki rukkað" is the default state, so the row would be huge. To avoid noise, when a payment pill is active **without** an invoice pill active, we additionally require `payday_invoice_id IS NOT NULL` (i.e. payment status only matters once an invoice is linked). This matches user intent.

## Technical changes

All client-side; the data is already on `DealRow` (`invoice_status`, `payment_status`, `payday_invoice_id`). No DB or edge function changes.

**`src/components/deals-list/DealsList.tsx`**

1. Add state:
   ```ts
   const [activeInvoiceStatus, setActiveInvoiceStatus] = useState<InvoiceStatus | null>(null);
   const [activePaymentStatus, setActivePaymentStatus] = useState<PaymentStatus | null>(null);
   ```
2. Extend `visibleDeals` `useMemo` with the filter rules above (apply after stage/owner filters).
3. Add `paydayCounts` `useMemo` that counts each enum value across the dataset already narrowed by stage+owner+year+search but **before** Payday filters, so counts are meaningful.
4. Render the new pill row right below the existing stage pill row. Reuse the same pill markup/classNames already used by `STEP_PILLS` for visual consistency. Insert a small `·` divider span between the invoice subgroup and the payment subgroup.
5. Update `clearAll()` to also reset `activeInvoiceStatus` and `activePaymentStatus`.
6. Strings: use existing `t.invoiceStatus.*` and `t.paymentStatus.*`. Add one new label `t.deal.filterPaydayRowLabel = 'Reikningsstaða'` (or just render the pills without a row label — TBD, see Q1 below).

**`src/lib/sala_translations_is.ts`** — add the row label key if we go with a label.

No changes to: edge functions, DB schema, `PaydayInvoiceCard`, `EditDealDrawer`, deal detail route, `DealsTab.tsx` (company detail) for v1.

## Out of scope

- Persisting Payday filter selection in URL search params (could add later alongside `?stage=`).
- Adding the same row to the company detail Deals tab.
- Filtering by Payday currency (ISK vs foreign) or by overdue invoices — separate feature.

## Open question for you

1. Do you want a small **row label** ("Reikningsstaða:") on the left of the Payday pill row to distinguish it from the stage row, or should the row stand on its own (relying on the divider + pill text alone)?