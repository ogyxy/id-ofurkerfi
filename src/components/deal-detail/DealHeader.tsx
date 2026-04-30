import { Link } from "@tanstack/react-router";
import type { Database } from "@/integrations/supabase/types";
import { t, formatDate } from "@/lib/sala_translations_is";
import { rememberCompanyReturnPath } from "@/lib/dealReturn";
import { Button } from "@/components/ui/button";
import { formatPhone } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { TrackingNumbersInline } from "./TrackingNumbersInline";
import { CopySoButton } from "@/components/deals-list/DealsList";

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
  onEdit: () => void;
}

const invoiceColors: Record<
  Database["public"]["Enums"]["invoice_status"],
  string
> = {
  not_invoiced: "bg-gray-100 text-gray-700",
  partial: "bg-amber-100 text-amber-800",
  full: "bg-green-100 text-green-700",
};

const paymentColors: Record<
  Database["public"]["Enums"]["payment_status"],
  string
> = {
  unpaid: "bg-amber-100 text-amber-800",
  partial: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
};

function isOverdue(date: string | null, stage: Deal["stage"]) {
  if (!date) return false;
  if (stage === "delivered" || stage === "cancelled") return false;
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export function DealHeader({
  deal,
  company,
  contact,
  ownerName,
  onEdit,
}: Props) {
  const overdue = isOverdue(deal.promised_delivery_date, deal.stage);
  const contactName = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(" ")
    : "";

  return (
    <div className="rounded-md border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
            <span>{deal.so_number}</span>
            <CopySoButton soNumber={deal.so_number} companyName={company.name} />
          </div>
          <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
            {deal.name}
          </h1>
          <Link
            to="/companies/$id"
            params={{ id: company.id }}
            onClick={() => rememberCompanyReturnPath()}
            className="inline-block text-sm font-medium text-ide-navy hover:underline"
          >
            {company.name}
          </Link>
          {company.billing_company && (
            <div className="text-xs text-muted-foreground">
              {t.newCompany.invoiceTo}: {company.billing_company.name}
            </div>
          )}
          {contact && (
            <div className="text-xs text-muted-foreground">
              {contactName}
              {contact.email && <> · {contact.email}</>}
              {contact.phone && <> · {formatPhone(contact.phone)}</>}
            </div>
          )}
          <TrackingNumbersInline
            dealId={deal.id}
            initial={deal.tracking_numbers ?? []}
          />
          {ownerName && (
            <div className="text-xs text-muted-foreground">
              {t.deal.owner_id}: {ownerName}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <div className="text-sm">
            <span className="text-muted-foreground">
              {t.deal.promised_delivery_date}:{" "}
            </span>
            <span
              className={cn(
                "font-medium",
                overdue && "text-destructive",
              )}
            >
              {formatDate(deal.promised_delivery_date) || "—"}
            </span>
          </div>
          {deal.estimated_delivery_date && (
            <div className="text-sm">
              <span className="text-muted-foreground">
                {t.deal.estimated_delivery_date}:{" "}
              </span>
              <span className="font-medium">
                {formatDate(deal.estimated_delivery_date)}
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-2 md:justify-end">
            {deal.stage !== "delivered" && deal.stage !== "cancelled" && (
              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                {t.deal.notDelivered}
              </span>
            )}
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                invoiceColors[deal.invoice_status],
              )}
            >
              {t.invoiceStatus[deal.invoice_status]}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                paymentColors[deal.payment_status],
              )}
            >
              {t.paymentStatus[deal.payment_status]}
            </span>
          </div>
          <Button variant="outline" onClick={onEdit}>
            {t.actions.edit}
          </Button>
        </div>
      </div>
    </div>
  );
}
