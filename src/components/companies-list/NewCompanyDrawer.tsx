import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { PhoneInput } from "@/components/PhoneInput";
import { maskKennitalaInput, stripKennitala, isValidKennitala, stripPhone } from "@/lib/formatters";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type VskStatus = Database["public"]["Enums"]["vsk_status"];
const vskStatuses: VskStatus[] = ["standard", "reduced", "export_exempt", "none"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CompanyForm = {
  name: string;
  kennitala: string;
  vsk_number: string;
  vsk_status: VskStatus;
  email: string;
  phoneCountryCode: string;
  phoneLocal: string;
  website: string;
  address_line_1: string;
  address_line_2: string;
  postcode: string;
  city: string;
  country: string;
  preferred_currency: string;
  payment_terms_days: string;
  notes: string;
  billing_company_id: string | null;
};

type ContactForm = {
  first_name: string;
  last_name: string;
  title: string;
  email: string;
  phoneCountryCode: string;
  phoneLocal: string;
  notes: string;
};

const emptyCompany: CompanyForm = {
  name: "",
  kennitala: "",
  vsk_number: "",
  vsk_status: "standard",
  email: "",
  phoneCountryCode: "+354",
  phoneLocal: "",
  website: "",
  address_line_1: "",
  address_line_2: "",
  postcode: "",
  city: "",
  country: "Iceland",
  preferred_currency: "ISK",
  payment_terms_days: "14",
  notes: "",
  billing_company_id: null,
};

const emptyContact: ContactForm = {
  first_name: "",
  last_name: "",
  title: "",
  email: "",
  phoneCountryCode: "+354",
  phoneLocal: "",
  notes: "",
};

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-ide-navy/30 pb-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-ide-navy">
        {children}
      </h3>
    </div>
  );
}

export function NewCompanyDrawer({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [companyForm, setCompanyForm] = useState<CompanyForm>(emptyCompany);
  const [contactForm, setContactForm] = useState<ContactForm>(emptyContact);
  const [isSkipped, setIsSkipped] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const updateCompany = <K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) => {
    setCompanyForm((prev) => {
      const next = { ...prev, [key]: value };
      // Auto currency when country changes
      if (key === "country") {
        next.preferred_currency = value === "Iceland" ? "ISK" : "EUR";
      }
      return next;
    });
  };
  const updateContact = <K extends keyof ContactForm>(key: K, value: ContactForm[K]) => {
    setContactForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetAll = () => {
    setCompanyForm(emptyCompany);
    setContactForm(emptyContact);
    setIsSkipped(false);
    setAdvancedOpen(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !saving) {
      resetAll();
    }
    onOpenChange(next);
  };

  const kennitalaError =
    companyForm.kennitala.trim().length > 0 && !isValidKennitala(companyForm.kennitala)
      ? "Kennitala verður að vera 10 tölustafir"
      : null;

  const performSave = async () => {
    setSaving(true);
    const terms = parseInt(companyForm.payment_terms_days, 10);
    const cleanKennitala = stripKennitala(companyForm.kennitala);

    const { data: newCompany, error: companyError } = await supabase
      .from("companies")
      .insert({
        name: companyForm.name.trim(),
        kennitala: cleanKennitala || null,
        vsk_number: companyForm.vsk_number.trim() || null,
        vsk_status: companyForm.vsk_status,
        email: companyForm.email.trim() || null,
        phone: stripPhone(companyForm.phoneCountryCode, companyForm.phoneLocal) || null,
        website: companyForm.website.trim() || null,
        address_line_1: companyForm.address_line_1.trim() || null,
        address_line_2: companyForm.address_line_2.trim() || null,
        postcode: companyForm.postcode.trim() || null,
        city: companyForm.city.trim() || null,
        country: companyForm.country.trim() || "Iceland",
        preferred_currency: companyForm.preferred_currency || "ISK",
        payment_terms_days: Number.isFinite(terms) ? terms : 14,
        notes: companyForm.notes.trim() || null,
        billing_company_id: companyForm.billing_company_id,
      })
      .select()
      .single();

    if (companyError || !newCompany) {
      setSaving(false);
      toast.error(t.status.somethingWentWrong);
      return;
    }

    const contactHasData = !isSkipped && contactForm.first_name.trim().length > 0;
    if (contactHasData) {
      const { error: contactError } = await supabase.from("contacts").insert({
        company_id: newCompany.id,
        first_name: contactForm.first_name.trim(),
        last_name: contactForm.last_name.trim() || null,
        title: contactForm.title.trim() || null,
        email: contactForm.email.trim() || null,
        phone: stripPhone(contactForm.phoneCountryCode, contactForm.phoneLocal) || null,
        notes: contactForm.notes.trim() || null,
        is_primary: true,
      });
      if (contactError) {
        toast.error(t.status.somethingWentWrong);
      }
    }

    setSaving(false);
    toast.success(t.status.savedSuccessfully);
    resetAll();
    onOpenChange(false);
    navigate({ to: "/companies/$id", params: { id: newCompany.id } });
  };

  const handleSave = async () => {
    if (!companyForm.name.trim()) {
      toast.error(t.newCompany.nameRequired);
      return;
    }
    if (kennitalaError) {
      toast.error(kennitalaError);
      return;
    }
    if (!isSkipped && contactForm.first_name.trim().length > 0) {
      // contact has data — proceed
      await performSave();
      return;
    }
    if (!isSkipped && contactForm.first_name.trim().length === 0) {
      // empty + not skipped → soft warning
      setConfirmOpen(true);
      return;
    }
    // skipped
    await performSave();
  };

  const contactDisabled = isSkipped;

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{t.newCompany.title}</SheetTitle>
          </SheetHeader>

          {/* Company section */}
          <div className="space-y-4 py-6">
            <SectionHeader>{t.newCompany.companySection}</SectionHeader>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>
                  {t.company.name} <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={companyForm.name}
                  onChange={(e) => updateCompany("name", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label>{t.company.kennitala}</Label>
                <Input
                  value={companyForm.kennitala}
                  onChange={(e) =>
                    updateCompany("kennitala", maskKennitalaInput(e.target.value))
                  }
                  placeholder="XXXXXX-XXXX"
                  inputMode="numeric"
                  maxLength={11}
                />
                {kennitalaError && (
                  <p className="mt-1 text-xs text-destructive">{kennitalaError}</p>
                )}
              </div>
              <div>
                <Label>{t.company.email}</Label>
                <Input
                  type="email"
                  value={companyForm.email}
                  onChange={(e) => updateCompany("email", e.target.value)}
                />
              </div>
              <div>
                <Label>{t.company.phone}</Label>
                <PhoneInput
                  countryCode={companyForm.phoneCountryCode}
                  localNumber={companyForm.phoneLocal}
                  onCountryCodeChange={(v) => updateCompany("phoneCountryCode", v)}
                  onLocalNumberChange={(v) => updateCompany("phoneLocal", v)}
                />
              </div>
              <div className="md:col-span-2">
                <Label>{t.company.website}</Label>
                <Input
                  value={companyForm.website}
                  onChange={(e) => updateCompany("website", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label>{t.company.address_line_1}</Label>
                <Input
                  value={companyForm.address_line_1}
                  onChange={(e) => updateCompany("address_line_1", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label>{t.company.address_line_2}</Label>
                <Input
                  value={companyForm.address_line_2}
                  onChange={(e) => updateCompany("address_line_2", e.target.value)}
                />
              </div>
              <div>
                <Label>{t.company.postcode}</Label>
                <Input
                  value={companyForm.postcode}
                  onChange={(e) => updateCompany("postcode", e.target.value)}
                />
              </div>
              <div>
                <Label>{t.company.city}</Label>
                <Input
                  value={companyForm.city}
                  onChange={(e) => updateCompany("city", e.target.value)}
                />
              </div>
              <div>
                <Label>{t.company.country}</Label>
                <CountrySelect
                  value={companyForm.country}
                  onValueChange={(v) => updateCompany("country", v)}
                />
              </div>
              <div>
                <Label>{t.company.preferred_currency}</Label>
                <CurrencySelect
                  value={companyForm.preferred_currency || "ISK"}
                  onValueChange={(v) => updateCompany("preferred_currency", v)}
                />
              </div>
              <div className="md:col-span-2">
                <Label>{t.company.payment_terms_days}</Label>
                <Input
                  type="number"
                  value={companyForm.payment_terms_days}
                  onChange={(e) => updateCompany("payment_terms_days", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label>{t.newCompany.billedVia}</Label>
                <BillingCompanyCombobox
                  value={companyForm.billing_company_id}
                  onChange={(v) => updateCompany("billing_company_id", v)}
                />
              </div>
              <div className="md:col-span-2">
                <Label>{t.company.notes}</Label>
                <Textarea
                  rows={3}
                  value={companyForm.notes}
                  onChange={(e) => updateCompany("notes", e.target.value)}
                />
              </div>

              {/* Advanced */}
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((v) => !v)}
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  {advancedOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {t.newCompany.advancedDetails}
                </button>
                {advancedOpen && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>{t.company.vsk_number}</Label>
                      <Input
                        value={companyForm.vsk_number}
                        onChange={(e) => updateCompany("vsk_number", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>{t.company.vsk_status}</Label>
                      <Select
                        value={companyForm.vsk_status}
                        onValueChange={(v) =>
                          updateCompany("vsk_status", v as VskStatus)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {vskStatuses.map((s) => (
                            <SelectItem key={s} value={s}>
                              {t.vskStatus[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="my-8 border-t border-border" />

          {/* Contact section */}
          <div className="space-y-4 pb-6">
            <SectionHeader>{t.newCompany.contactSection}</SectionHeader>
            <p className="text-sm italic text-muted-foreground">
              {t.newCompany.contactRecommended}
            </p>

            {isSkipped ? (
              <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                  {t.newCompany.contactSkipped}
                </p>
                <p className="mt-1">{t.newCompany.contactSkippedHint}</p>
                <button
                  type="button"
                  onClick={() => setIsSkipped(false)}
                  className="mt-3 text-sm font-medium text-ide-navy hover:underline"
                >
                  {t.newCompany.addContactAnyway}
                </button>
              </div>
            ) : (
              <>
                <div className={cn("grid gap-3 md:grid-cols-2", contactDisabled && "opacity-50")}>
                  <div>
                    <Label>
                      {t.contact.first_name} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={contactForm.first_name}
                      onChange={(e) => updateContact("first_name", e.target.value)}
                      disabled={contactDisabled}
                    />
                  </div>
                  <div>
                    <Label>{t.contact.last_name}</Label>
                    <Input
                      value={contactForm.last_name}
                      onChange={(e) => updateContact("last_name", e.target.value)}
                      disabled={contactDisabled}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>{t.contact.title}</Label>
                    <Input
                      value={contactForm.title}
                      onChange={(e) => updateContact("title", e.target.value)}
                      disabled={contactDisabled}
                      placeholder="Markaðsstjóri"
                    />
                  </div>
                  <div>
                    <Label>{t.contact.email}</Label>
                    <Input
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => updateContact("email", e.target.value)}
                      disabled={contactDisabled}
                    />
                  </div>
                  <div>
                    <Label>{t.contact.phone}</Label>
                    <PhoneInput
                      countryCode={contactForm.phoneCountryCode}
                      localNumber={contactForm.phoneLocal}
                      onCountryCodeChange={(v) => updateContact("phoneCountryCode", v)}
                      onLocalNumberChange={(v) => updateContact("phoneLocal", v)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>{t.contact.notes}</Label>
                    <Textarea
                      rows={3}
                      value={contactForm.notes}
                      onChange={(e) => updateContact("notes", e.target.value)}
                      disabled={contactDisabled}
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSkipped(true)}
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {t.newCompany.skipContact}
                  </button>
                </div>
              </>
            )}
          </div>

          <SheetFooter className="sticky bottom-0 -mx-6 border-t border-border bg-background px-6 py-3">
            <Button
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              {t.actions.cancel}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-ide-navy text-white hover:bg-ide-navy-hover"
            >
              {saving ? t.status.saving : t.actions.save}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.status.areYouSure}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.newCompany.warnNoContact}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirmOpen(false);
                await performSave();
              }}
              className="bg-ide-navy text-white hover:bg-ide-navy-hover"
            >
              {t.newCompany.saveAnyway}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
