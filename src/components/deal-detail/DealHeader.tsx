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

type PoLite = Pick<
  Database["public"]["Tables"]["purchase_orders"]["Row"],
  "status" | "received_date" | "delivered_to_customer_at"
>;

interface Props {
  deal: Deal;
  company: Company;
  contact: Contact | null;
  ownerName: string | null;
  quoteValidUntil?: string | null;
  pos?: PoLite[];
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
  pos,
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

  // PO collective state
  const activePos = (pos ?? []).filter((p) => p.status !== "cancelled");
  const allReceived =
    activePos.length > 0 && activePos.every((p) => !!p.received_date);
  const allDelivered =
    activePos.length > 0 &&
    activePos.every((p) => !!p.delivered_to_customer_at);

  const lastReceivedDate = activePos
    .map((p) => p.received_date)
    .filter((d): d is string => !!d)
    .sort()
    .pop() ?? null;
  const lastDeliveredDate = activePos
    .map((p) => (p.delivered_to_customer_at ? p.delivered_to_customer_at.split("T")[0] : null))
    .filter((d): d is string => !!d)
    .sort()
    .pop() ?? null;

  const showAfhent = allDelivered && !!lastDeliveredDate;
  const showMottekid = allReceived && !showAfhent && !!lastReceivedDate;
  const showEstimated =
    isOrderStage && !!deal.estimated_delivery_date && !allReceived && !allDelivered;

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
    <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-[2.2fr_1fr]">
        {/* Left column */}
        <div className="flex flex-col gap-4 p-6">
          {/* Top: reference numbers */}
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

          {/* Identity + contact */}
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
        </div>

        {/* Right column: edit button (top) + pills + owner (bottom) */}
        <div className="flex flex-col justify-between gap-4 border-t-2 border-border p-6 md:border-l-2 md:border-t-0">
          <div className="flex flex-col items-start gap-1.5 md:items-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="h-7 px-3 text-[12px]"
            >
              {t.actions.edit}
            </Button>
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
            <div className="flex items-center gap-2 md:justify-end">
              <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-semibold text-amber-800">
                {getInitials(ownerName)}
              </span>
              <span className="text-sm font-medium text-foreground">{ownerName}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
