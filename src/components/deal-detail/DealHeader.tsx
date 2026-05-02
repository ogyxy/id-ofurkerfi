import { Link } from "@tanstack/react-router";
import { Mail, Phone, User } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { t, formatDate } from "@/lib/sala_translations_is";
import { rememberCompanyReturnPath } from "@/lib/dealReturn";
import { Button } from "@/components/ui/button";
import { formatPhone } from "@/lib/formatters";
import { LabeledPill, type PillTone } from "@/components/deal-detail/LabeledPill";

import { CopySoButton, CopyTextButton } from "@/components/deals-list/DealsList";

type Deal = Database["public"]["Tables"]["deals"]["Row"];
type Company = Pick<
  Database["public"]["Tables"]["companies"]["Row"],
  "id" | "name" | "vsk_status" | "payment_terms_days"
> & {
  billing_company?: { id: string; name: string } | null;
};
type Contact = Pick<
  Database["public"]["Tables"]["contacts"]["Row"],
  "id" | "first_name" | "last_name" | "email" | "phone"
>;

interface Props {
  deal: Deal;
  company: Company;
  contact: Contact | null;
  ownerName: string | null;
  quoteValidUntil?: string | null;
  onEdit: () => void;
}

function startOfToday(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const today = startOfToday();
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export function DealHeader({
  deal,
  company,
  contact,
  ownerName,
  quoteValidUntil,
  onEdit,
}: Props) {
  const contactName = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(" ")
    : "";

  // ---- Stage-aware timing pills ----
  const stage = deal.stage;
  const isOrderStage = stage === "order_confirmed" || stage === "ready_for_pickup";
  const showDeadline = stage !== "delivered" && stage !== "cancelled";
  const showQuoteExpiry = stage === "quote_sent" && !!quoteValidUntil;
  const showEstimated =
    isOrderStage && !!deal.estimated_delivery_date;

  // Tone calculations
  const deadlineDays = daysUntil(deal.promised_delivery_date);
  const deadlineTone: PillTone =
    deadlineDays != null && deadlineDays < 0 && stage !== "delivered" && stage !== "cancelled"
      ? "danger"
      : "neutral";

  const quoteDays = daysUntil(quoteValidUntil ?? null);
  const quoteTone: PillTone =
    quoteDays == null
      ? "neutral"
      : quoteDays <= 0
        ? "danger"
        : quoteDays <= 2
          ? "warning"
          : "neutral";

  const estimatedTone: PillTone = (() => {
    if (!deal.estimated_delivery_date || !deal.promised_delivery_date) return "neutral";
    const est = new Date(deal.estimated_delivery_date);
    const prom = new Date(deal.promised_delivery_date);
    return est > prom ? "warning" : "neutral";
  })();

  return (
    <div className="rounded-md border border-border bg-card p-6 shadow-sm">
      {/* Top row: reference numbers + edit button */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span>{deal.so_number}</span>
            <CopySoButton soNumber={deal.so_number} companyName={company.name} />
          </span>
          {deal.payday_invoice_number && (
            <>
              <span className="opacity-50">·</span>
              <span className="inline-flex items-center gap-1">
                <span>Payday #{deal.payday_invoice_number}</span>
                <CopyTextButton text={deal.payday_invoice_number} label="Payday-reikningsnúmer" />
              </span>
            </>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="h-7 px-3 text-[12px]"
        >
          {t.actions.edit}
        </Button>
      </div>

      {/* Two-column grid */}
      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-[2.2fr_1fr] md:gap-8">
        {/* Left column: identity + contact */}
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-medium leading-tight text-foreground md:text-[26px]">
            {deal.name}
          </h1>

          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-semibold text-blue-800">
              {getInitials(company.name)}
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <Link
                to="/companies/$id"
                params={{ id: company.id }}
                onClick={() => rememberCompanyReturnPath()}
                className="font-medium text-ide-navy hover:underline"
              >
                {company.name}
              </Link>
              {company.billing_company && (
                <span className="text-xs text-muted-foreground">
                  {t.newCompany.invoiceTo}: {company.billing_company.name}
                </span>
              )}
            </div>
          </div>

          {contact && (
            <div className="space-y-0.5 text-xs text-muted-foreground">
              {contactName && (
                <div className="inline-flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  <span>{contactName}</span>
                </div>
              )}
              {contact.email && (
                <div>
                  <a
                    href={`mailto:${contact.email}`}
                    className="inline-flex items-center gap-1.5 text-ide-navy hover:underline"
                  >
                    <Mail className="h-4 w-4" />
                    {contact.email}
                  </a>
                </div>
              )}
              {contact.phone && (
                <div className="inline-flex items-center gap-1.5">
                  <Phone className="h-4 w-4" />
                  {formatPhone(contact.phone)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column: timing pills (top) + söluaðili (bottom) */}
        <div className="flex flex-col justify-between gap-4 border-t border-border pt-4 md:border-t-0 md:border-l-2 md:border-border md:pl-6 md:pt-0">
          <div className="flex flex-col items-start gap-1.5 md:items-end">
            {showDeadline && deal.promised_delivery_date && (
              <LabeledPill
                label="Deadline"
                value={formatDate(deal.promised_delivery_date)}
                tone={deadlineTone}
              />
            )}
            {showQuoteExpiry && (
              <LabeledPill
                label="Tilboð rennur út"
                value={formatDate(quoteValidUntil!)}
                tone={quoteTone}
              />
            )}
            {showEstimated && (
              <LabeledPill
                label="Áætluð móttaka"
                value={formatDate(deal.estimated_delivery_date)}
                tone={estimatedTone}
              />
            )}
          </div>

          {ownerName && (
            <div className="flex flex-col gap-1 md:items-end">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t.deal.owner_id}
              </span>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-semibold text-amber-800">
                  {getInitials(ownerName)}
                </span>
                <span className="text-sm font-medium text-foreground">{ownerName}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
