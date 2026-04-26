import { Mail, Phone, Globe, MapPin, CreditCard, Coins } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";

type Company = Database["public"]["Tables"]["companies"]["Row"];

interface Props {
  company: Company;
  onEdit: () => void;
}

export function CompanyHeader({ company, onEdit }: Props) {
  const addressParts = [company.address_line_1, company.city, company.postcode]
    .filter((p) => p && p.trim().length > 0)
    .join(", ");

  return (
    <div className="rounded-md border border-border bg-card p-6 shadow-sm">
      {/* Row 1: identity */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
            {company.name}
          </h1>
          <div className="flex flex-wrap gap-2">
            {company.kennitala && (
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                {t.company.kennitala}: {company.kennitala}
              </span>
            )}
            {company.vsk_number && (
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                {t.company.vsk_number}: {company.vsk_number}
              </span>
            )}
          
          </div>
        </div>
        <Button variant="outline" onClick={onEdit}>
          {t.actions.edit}
        </Button>
      </div>

      {/* Row 2: contact strip */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        {company.email && (
          <a
            href={`mailto:${company.email}`}
            className="inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <Mail className="h-4 w-4" />
            {company.email}
          </a>
        )}
        {company.phone && (
          <a
            href={`tel:${company.phone}`}
            className="inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <Phone className="h-4 w-4" />
            {company.phone}
          </a>
        )}
        {company.website && (
          <a
            href={company.website.startsWith("http") ? company.website : `https://${company.website}`}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 hover:text-foreground"
          >
            <Globe className="h-4 w-4" />
            {company.website}
          </a>
        )}
        {addressParts && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            {addressParts}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <CreditCard className="h-4 w-4" />
          {t.company.payment_terms_days}: {company.payment_terms_days} dagar
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Coins className="h-4 w-4" />
          {t.company.preferred_currency}: {company.preferred_currency}
        </span>
      </div>

      {/* Notes sticky */}
      {company.notes && company.notes.trim().length > 0 && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 whitespace-pre-wrap">
          {company.notes}
        </div>
      )}
    </div>
  );
}
