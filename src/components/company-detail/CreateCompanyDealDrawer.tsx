import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronDown, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/sala_translations_is";
import { rememberDealReturnPath } from "@/lib/dealReturn";
import { stripPhone } from "@/lib/formatters";
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

type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};
type Profile = { id: string; name: string | null; email: string };

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: string;
  currentUserId: string;
  profiles: Profile[];
  onSaved?: () => void;
}

function contactName(c: Contact): string {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.id;
}

export function CreateCompanyDealDrawer({
  open,
  onOpenChange,
  companyId,
  currentUserId,
  profiles,
  onSaved,
}: Props) {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Contact combobox
  const [contactSearch, setContactSearch] = useState("");
  const [contactId, setContactId] = useState("");
  const [contactDropdownOpen, setContactDropdownOpen] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  // New contact mini-form
  const [newOpen, setNewOpen] = useState(false);
  const [newContactFirst, setNewContactFirst] = useState("");
  const [newContactLast, setNewContactLast] = useState("");
  const [newContactTitle, setNewContactTitle] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactPhoneCountry, setNewContactPhoneCountry] = useState("+354");
  const [newContactPhoneLocal, setNewContactPhoneLocal] = useState("");
  const [creatingContact, setCreatingContact] = useState(false);

  const [name, setName] = useState("");
  const [ownerId, setOwnerId] = useState(currentUserId);
  const [markup, setMarkup] = useState("30");
  const [promisedDate, setPromisedDate] = useState("");
  const [firstNote, setFirstNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOwnerId(currentUserId);
    (async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name")
        .eq("company_id", companyId);
      setContacts((data ?? []) as Contact[]);
    })();
  }, [open, companyId, currentUserId]);

  useEffect(() => {
    if (!contactDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setContactDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contactDropdownOpen]);

  const filteredContacts = useMemo(() => {
    const s = contactSearch.trim().toLowerCase();
    if (!s) return contacts.slice(0, 50);
    return contacts
      .filter((c) => contactName(c).toLowerCase().includes(s))
      .slice(0, 50);
  }, [contacts, contactSearch]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === contactId) ?? null,
    [contacts, contactId],
  );

  const reset = () => {
    setContactId("");
    setName("");
    setMarkup("30");
    setPromisedDate("");
    setFirstNote("");
    setContactSearch("");
    setContactDropdownOpen(false);
    setNewOpen(false);
    setNewContactFirst("");
    setNewContactLast("");
    setNewContactTitle("");
    setNewContactEmail("");
    setNewContactPhoneCountry("+354");
    setNewContactPhoneLocal("");
  };

  const selectContact = (c: Contact) => {
    setContactId(c.id);
    setContactSearch("");
    setContactDropdownOpen(false);
  };

  const clearContact = () => {
    setContactId("");
    setContactSearch("");
  };

  const createNewContact = async () => {
    if (!newContactFirst.trim()) {
      toast.error(t.newCompany.firstNameRequired);
      return;
    }
    setCreatingContact(true);
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        company_id: companyId,
        first_name: newContactFirst.trim(),
        last_name: newContactLast.trim() || null,
        title: newContactTitle.trim() || null,
        email: newContactEmail.trim() || null,
        phone: stripPhone(newContactPhoneCountry, newContactPhoneLocal) || null,
      })
      .select("id, first_name, last_name")
      .single();
    if (error || !data) {
      setCreatingContact(false);
      toast.error(t.status.somethingWentWrong);
      return;
    }
    const created = data as Contact;
    setContacts((prev) => [created, ...prev]);
    selectContact(created);
    setCreatingContact(false);
    setNewOpen(false);
    setNewContactFirst("");
    setNewContactLast("");
    setNewContactTitle("");
    setNewContactEmail("");
    setNewContactPhoneCountry("+354");
    setNewContactPhoneLocal("");
  };

  const handleSave = async () => {
    if (!name.trim()) {
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
        stage: "quote_in_progress",
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
    onSaved?.();
    rememberDealReturnPath();
    navigate({ to: "/deals/$id", params: { id: data.id } });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t.deal.createTitle}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Contact combobox (top) */}
          <div ref={comboRef} className="relative">
            <div className="mb-1 flex items-center justify-between">
              <Label>{t.deal.selectContact}</Label>
              <button
                type="button"
                onClick={() => setNewOpen((v) => !v)}
                className="text-xs font-medium text-ide-navy hover:underline"
              >
                {t.deal.newContact}
              </button>
            </div>

            {selectedContact ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                <span className="truncate text-sm font-medium">
                  {contactName(selectedContact)}
                </span>
                <button
                  type="button"
                  onClick={clearContact}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="clear"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  placeholder={t.deal.searchContactPlaceholder}
                  value={contactSearch}
                  onChange={(e) => {
                    setContactSearch(e.target.value);
                    setContactDropdownOpen(true);
                  }}
                  onFocus={() => setContactDropdownOpen(true)}
                />
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                {contactDropdownOpen && (
                  <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                    {filteredContacts.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        {t.status.noResults}
                      </div>
                    ) : (
                      filteredContacts.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectContact(c)}
                          className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          {contactName(c)}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Inline new contact mini-form */}
            {newOpen && (
              <div className="mt-3 space-y-2 rounded-md border border-dashed border-border bg-muted/20 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">
                      {t.contact.first_name}{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={newContactFirst}
                      onChange={(e) => setNewContactFirst(e.target.value)}
                      autoFocus
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
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNewOpen(false);
                      setNewContactFirst("");
                      setNewContactLast("");
                      setNewContactTitle("");
                      setNewContactEmail("");
                    }}
                  >
                    {t.actions.cancel}
                  </Button>
                  <Button
                    size="sm"
                    onClick={createNewContact}
                    disabled={creatingContact || !newContactFirst.trim()}
                    className="bg-ide-navy text-white hover:bg-ide-navy-hover"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {creatingContact ? t.status.saving : t.actions.create}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div>
            <Label>
              {t.deal.name} <span className="text-destructive">*</span>
            </Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
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

          {/* Stage is hardcoded to "Tilboð í vinnslu" — not user-editable. */}

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
            disabled={saving || !name.trim()}
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
          >
            {saving ? t.status.saving : t.actions.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
