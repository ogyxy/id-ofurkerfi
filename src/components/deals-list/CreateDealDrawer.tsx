import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronDown, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/sala_translations_is";
import { rememberDealReturnPath } from "@/lib/dealReturn";
import { maskKennitalaInput, stripKennitala, isValidKennitala, stripPhone } from "@/lib/formatters";
import { PhoneInput } from "@/components/PhoneInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";

type DealStage = Database["public"]["Enums"]["deal_stage"];
type Company = { id: string; name: string; billing_company_id: string | null };
type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_id: string;
};
type Profile = { id: string; name: string | null; email: string };

const STAGES: DealStage[] = [
  "inquiry",
  "quote_in_progress",
  "quote_sent",
  "order_confirmed",
  "delivered",
  "defect_reorder",
  "cancelled",
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  currentUserId: string;
  profiles: Profile[];
}

export function CreateDealDrawer({
  open,
  onOpenChange,
  currentUserId,
  profiles,
}: Props) {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Combobox state
  const [companySearch, setCompanySearch] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  // New customer mini-form
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKennitala, setNewKennitala] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [newBillingCompanyId, setNewBillingCompanyId] = useState<string | null>(null);

  // Optional new contact for new company
  const [addContact, setAddContact] = useState(false);
  const [newContactFirst, setNewContactFirst] = useState("");
  const [newContactLast, setNewContactLast] = useState("");
  const [newContactTitle, setNewContactTitle] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactPhoneCountry, setNewContactPhoneCountry] = useState("+354");
  const [newContactPhoneLocal, setNewContactPhoneLocal] = useState("");

  const [contactId, setContactId] = useState("");
  const [name, setName] = useState("");
  const [ownerId, setOwnerId] = useState(currentUserId);
  const [stage, setStage] = useState<DealStage>("inquiry");
  const [markup, setMarkup] = useState("30");
  const [promisedDate, setPromisedDate] = useState("");
  const [firstNote, setFirstNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOwnerId(currentUserId);
    (async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name, billing_company_id")
        .eq("archived", false)
        .order("name");
      setCompanies((data ?? []) as Company[]);
    })();
  }, [open, currentUserId]);

  useEffect(() => {
    if (!companyId) {
      setContacts([]);
      setContactId("");
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, company_id")
        .eq("company_id", companyId);
      setContacts((data ?? []) as Contact[]);
    })();
  }, [companyId]);

  // Outside click for combobox
  useEffect(() => {
    if (!companyDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setCompanyDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [companyDropdownOpen]);

  const filteredCompanies = useMemo(() => {
    const s = companySearch.trim().toLowerCase();
    if (!s) return companies.slice(0, 50);
    return companies
      .filter((c) => c.name.toLowerCase().includes(s))
      .slice(0, 50);
  }, [companies, companySearch]);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === companyId) ?? null,
    [companies, companyId],
  );

  const reset = () => {
    setCompanyId("");
    setContactId("");
    setName("");
    setStage("inquiry");
    setMarkup("30");
    setPromisedDate("");
    setFirstNote("");
    setCompanySearch("");
    setCompanyDropdownOpen(false);
    setNewOpen(false);
    setNewName("");
    setNewKennitala("");
    setNewEmail("");
    setAddContact(false);
    setNewContactFirst("");
    setNewContactLast("");
    setNewContactTitle("");
    setNewContactEmail("");
    setNewContactPhoneCountry("+354");
    setNewContactPhoneLocal("");
  };

  const selectCompany = (c: Company) => {
    setCompanyId(c.id);
    setCompanySearch("");
    setCompanyDropdownOpen(false);
  };

  const clearCompany = () => {
    setCompanyId("");
    setCompanySearch("");
  };

  const createNewCompany = async () => {
    if (!newName.trim()) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    if (newKennitala.trim() && !isValidKennitala(newKennitala)) {
      toast.error("Kennitala verður að vera 10 tölustafir");
      return;
    }
    setCreatingCompany(true);
    const { data, error } = await supabase
      .from("companies")
      .insert({
        name: newName.trim(),
        kennitala: stripKennitala(newKennitala) || null,
        email: newEmail.trim() || null,
        country: "Iceland",
        preferred_currency: "ISK",
        billing_company_id: newBillingCompanyId,
      })
      .select("id, name, billing_company_id")
      .single();
    if (error || !data) {
      setCreatingCompany(false);
      toast.error(t.status.somethingWentWrong);
      return;
    }
    const newCompany = data as Company;
    setCompanies((prev) =>
      [newCompany, ...prev.filter((c) => c.id !== newCompany.id)].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );

    // Optional contact creation
    if (addContact && newContactFirst.trim()) {
      const { data: newContact } = await supabase
        .from("contacts")
        .insert({
          company_id: newCompany.id,
          first_name: newContactFirst.trim(),
          last_name: newContactLast.trim() || null,
          title: newContactTitle.trim() || null,
          email: newContactEmail.trim() || null,
          phone: stripPhone(newContactPhoneCountry, newContactPhoneLocal) || null,
          is_primary: true,
        })
        .select("id, first_name, last_name, company_id")
        .single();
      if (newContact) {
        setContacts([newContact as Contact]);
        setContactId(newContact.id);
      }
    }

    selectCompany(newCompany);
    setCreatingCompany(false);
    setNewOpen(false);
    setNewName("");
    setNewKennitala("");
    setNewEmail("");
    setAddContact(false);
    setNewContactFirst("");
    setNewContactLast("");
    setNewContactTitle("");
    setNewContactEmail("");
    setNewContactPhoneCountry("+354");
    setNewContactPhoneLocal("");
    setNewBillingCompanyId(null);
  };

  const handleSave = async () => {
    if (!companyId || !name.trim()) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("deals")
      .insert({
        company_id: companyId,
        contact_id: contactId || null,
        owner_id: ownerId || null,
        name: name.trim(),
        stage,
        default_markup_pct: Number(markup) || 30,
        promised_delivery_date: promisedDate || null,
      })
      .select("id, company_id")
      .single();
    if (error || !data) {
      setSaving(false);
      toast.error(t.status.somethingWentWrong);
      return;
    }

    // Optional: create first log note
    if (firstNote.trim()) {
      await supabase.from("activities").insert({
        deal_id: data.id,
        company_id: data.company_id,
        type: "note",
        body: firstNote.trim(),
        created_by: currentUserId,
      });
    }

    setSaving(false);
    reset();
    onOpenChange(false);
    rememberDealReturnPath("/deals");
    navigate({ to: "/deals/$id", params: { id: data.id } });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t.deal.createTitle}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Customer combobox */}
          <div ref={comboRef} className="relative">
            <div className="mb-1 flex items-center justify-between">
              <Label>
                {t.deal.selectCustomer}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <button
                type="button"
                onClick={() => setNewOpen((v) => !v)}
                className="text-xs font-medium text-ide-navy hover:underline"
              >
                {t.deal.newCustomer}
              </button>
            </div>

            {selectedCompany ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                <span className="truncate text-sm font-medium">
                  {selectedCompany.name}
                </span>
                <button
                  type="button"
                  onClick={clearCompany}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="clear"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  placeholder={t.deal.searchCustomerPlaceholder}
                  value={companySearch}
                  onChange={(e) => {
                    setCompanySearch(e.target.value);
                    setCompanyDropdownOpen(true);
                  }}
                  onFocus={() => setCompanyDropdownOpen(true)}
                />
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                {companyDropdownOpen && (
                  <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                    {filteredCompanies.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        {t.status.noResults}
                      </div>
                    ) : (
                      filteredCompanies.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectCompany(c)}
                          className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          {c.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Inline new customer mini-form */}
            {newOpen && (
              <div className="mt-3 space-y-2 rounded-md border border-dashed border-border bg-muted/20 p-3">
                <div>
                  <Label className="text-xs">
                    {t.company.name}{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-xs">{t.company.kennitala}</Label>
                  <Input
                    value={newKennitala}
                    onChange={(e) => setNewKennitala(maskKennitalaInput(e.target.value))}
                    placeholder="XXXXXX-XXXX"
                    inputMode="numeric"
                    maxLength={11}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t.company.email}</Label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>

                <div className="border-t border-border pt-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={addContact}
                      onChange={(e) => setAddContact(e.target.checked)}
                      className="h-3.5 w-3.5"
                    />
                    {t.deal.addContact}
                  </label>
                  {addContact && (
                    <div className="mt-2 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">{t.contact.first_name}</Label>
                          <Input
                            value={newContactFirst}
                            onChange={(e) => setNewContactFirst(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">{t.contact.last_name}</Label>
                          <Input
                            value={newContactLast}
                            onChange={(e) => setNewContactLast(e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">{t.contact.title}</Label>
                        <Input
                          value={newContactTitle}
                          onChange={(e) => setNewContactTitle(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t.contact.email}</Label>
                        <Input
                          type="email"
                          value={newContactEmail}
                          onChange={(e) => setNewContactEmail(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{t.contact.phone}</Label>
                        <PhoneInput
                          countryCode={newContactPhoneCountry}
                          localNumber={newContactPhoneLocal}
                          onCountryCodeChange={setNewContactPhoneCountry}
                          onLocalNumberChange={setNewContactPhoneLocal}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNewOpen(false);
                      setNewName("");
                      setNewKennitala("");
                      setNewEmail("");
                    }}
                  >
                    {t.actions.cancel}
                  </Button>
                  <Button
                    size="sm"
                    onClick={createNewCompany}
                    disabled={creatingCompany || !newName.trim()}
                    className="bg-ide-navy text-white hover:bg-ide-navy-hover"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {creatingCompany ? t.status.saving : t.actions.create}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div>
            <Label>{t.deal.name}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <Label>{t.nav.contactSingle}</Label>
            <Select
              value={contactId}
              onValueChange={setContactId}
              disabled={!companyId}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") ||
                      c.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t.deal.owner}</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name || p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t.deal.stage}</Label>
            <Select value={stage} onValueChange={(v) => setStage(v as DealStage)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t.dealStage[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t.deal.default_markup_pct}</Label>
            <Input
              type="number"
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
            />
          </div>

          <div>
            <Label>{t.deal.promised_delivery_date}</Label>
            <Input
              type="date"
              value={promisedDate}
              onChange={(e) => setPromisedDate(e.target.value)}
            />
          </div>

          <div>
            <Label>{t.deal.firstNoteLabel}</Label>
            <Textarea
              value={firstNote}
              onChange={(e) => setFirstNote(e.target.value)}
              rows={3}
              placeholder={t.deal.firstNotePlaceholder}
            />
          </div>
        </div>

        <SheetFooter className={cn("mt-6")}>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t.actions.cancel}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !companyId || !name.trim()}
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
          >
            {saving ? t.status.saving : t.actions.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
