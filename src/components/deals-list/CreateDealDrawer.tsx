import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/sala_translations_is";
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

type DealStage = Database["public"]["Enums"]["deal_stage"];
type Company = { id: string; name: string };
type Contact = { id: string; first_name: string | null; last_name: string | null; company_id: string };
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

export function CreateDealDrawer({ open, onOpenChange, currentUserId, profiles }: Props) {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companySearch, setCompanySearch] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [name, setName] = useState("");
  const [ownerId, setOwnerId] = useState(currentUserId);
  const [stage, setStage] = useState<DealStage>("inquiry");
  const [markup, setMarkup] = useState("30");
  const [estDate, setEstDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOwnerId(currentUserId);
    (async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name")
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

  const filteredCompanies = useMemo(() => {
    const s = companySearch.trim().toLowerCase();
    if (!s) return companies.slice(0, 50);
    return companies.filter((c) => c.name.toLowerCase().includes(s)).slice(0, 50);
  }, [companies, companySearch]);

  const reset = () => {
    setCompanyId("");
    setContactId("");
    setName("");
    setStage("inquiry");
    setMarkup("30");
    setEstDate("");
    setNotes("");
    setCompanySearch("");
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
        estimated_delivery_date: estDate || null,
        notes: notes || null,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    reset();
    onOpenChange(false);
    navigate({ to: "/deals/$id", params: { id: data.id } });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t.deal.createTitle}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div>
            <Label>{t.nav.companies}</Label>
            <Input
              placeholder={t.actions.search}
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              className="mb-2"
            />
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder={t.actions.search} />
              </SelectTrigger>
              <SelectContent>
                {filteredCompanies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t.deal.name}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <Label>{t.nav.contactSingle}</Label>
            <Select value={contactId} onValueChange={setContactId} disabled={!companyId}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") || c.id}
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
            <Label>{t.deal.estimated_delivery_date}</Label>
            <Input
              type="date"
              value={estDate}
              onChange={(e) => setEstDate(e.target.value)}
            />
          </div>

          <div>
            <Label>{t.deal.notes}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t.actions.cancel}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !companyId || !name.trim()}
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
          >
            {t.actions.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
