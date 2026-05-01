import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PO_CURRENCIES } from "@/lib/poConstants";
import { logPoCreated } from "@/lib/poActivityLog";

type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];

interface DealOption {
  id: string;
  so_number: string;
  name: string;
  company_name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the deal field is hidden and the PO is linked to this deal */
  fixedDealId?: string;
  /** Profile id of the current user (for activity log) */
  currentProfileId: string | null;
  /** Called after successful save with the new PO id (parent decides nav/refresh) */
  onCreated?: (newPoId: string) => void;
  /** When true, navigate to /innkaup/:id automatically */
  navigateOnCreate?: boolean;
}

export function CreatePoDrawer({
  open,
  onOpenChange,
  fixedDealId,
  currentProfileId,
  onCreated,
  navigateOnCreate = true,
}: Props) {
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [currency, setCurrency] = useState<string>("EUR");
  const [linkedDealId, setLinkedDealId] = useState<string>("");
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [dealComboOpen, setDealComboOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Inline new supplier form
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierCurrency, setNewSupplierCurrency] = useState<string>("EUR");
  const [creatingSupplier, setCreatingSupplier] = useState(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("*")
        .eq("active", true)
        .order("name");
      setSuppliers((data ?? []) as Supplier[]);
    })();
  }, [open]);

  useEffect(() => {
    if (!open || fixedDealId) return;
    void (async () => {
      const { data } = await supabase
        .from("deals")
        .select(
          "id, so_number, name, company:companies(name)",
        )
        .eq("archived", false)
        .order("created_at", { ascending: false })
        .limit(500);
      const opts: DealOption[] = (data ?? []).map((d) => ({
        id: d.id,
        so_number: d.so_number,
        name: d.name,
        company_name: ((d as unknown as { company: { name: string } | null }).company?.name) ?? "",
      }));
      setDeals(opts);
    })();
  }, [open, fixedDealId]);

  // Reset on close
  useEffect(() => {
    if (open) return;
    setSupplierId("");
    setCurrency("EUR");
    setLinkedDealId("");
    setShowNewSupplier(false);
    setNewSupplierName("");
    setNewSupplierCurrency("EUR");
  }, [open]);

  // Auto-fill currency from supplier
  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === supplierId) ?? null,
    [supplierId, suppliers],
  );
  useEffect(() => {
    if (selectedSupplier?.default_currency) {
      setCurrency(selectedSupplier.default_currency);
    }
  }, [selectedSupplier]);

  const selectedDeal = deals.find((d) => d.id === linkedDealId);

  const createSupplierInline = async () => {
    const name = newSupplierName.trim();
    if (!name) return;
    setCreatingSupplier(true);
    const { data, error } = await supabase
      .from("suppliers")
      .insert({ name, default_currency: newSupplierCurrency })
      .select()
      .single();
    setCreatingSupplier(false);
    if (error || !data) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    setSuppliers((prev) => [...prev, data as Supplier].sort((a, b) => a.name.localeCompare(b.name)));
    setSupplierId(data.id);
    setCurrency(data.default_currency);
    setShowNewSupplier(false);
    setNewSupplierName("");
  };

  const handleSave = async () => {
    if (!supplierId) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) return;
    const dealIdToUse = fixedDealId ?? linkedDealId;
    if (!dealIdToUse) {
      toast.error(t.purchaseOrder.requireDealHelp);
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("purchase_orders")
      .insert({
        supplier_id: supplierId,
        supplier: supplier.name, // backward-compat text field
        currency,
        deal_id: dealIdToUse,
        status: "ordered",
        order_date: new Date().toISOString().split("T")[0],
        amount: 0,
        shipping_cost: 0,
      })
      .select()
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    toast.success(t.status.savedSuccessfully);
    await logPoCreated({
      dealId: dealIdToUse,
      poNumber: data.po_number,
      supplierName: supplier.name,
      createdBy: currentProfileId,
    });
    onOpenChange(false);
    onCreated?.(data.id);
    if (navigateOnCreate) {
      navigate({ to: "/innkaup/$id", params: { id: data.id } });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>{t.purchaseOrder.createTitle}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>{t.purchaseOrder.supplier}</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder={t.purchaseOrder.selectSupplier} />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!showNewSupplier && (
              <button
                type="button"
                onClick={() => setShowNewSupplier(true)}
                className="mt-1 text-xs text-ide-navy hover:underline"
              >
                {t.purchaseOrder.newSupplierInline}
              </button>
            )}
            {showNewSupplier && (
              <div className="mt-2 space-y-2 rounded-md border border-border bg-muted/30 p-3">
                <Input
                  placeholder={t.supplier.name}
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                />
                <Select
                  value={newSupplierCurrency}
                  onValueChange={setNewSupplierCurrency}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PO_CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowNewSupplier(false);
                      setNewSupplierName("");
                    }}
                  >
                    {t.actions.cancel}
                  </Button>
                  <Button
                    size="sm"
                    onClick={createSupplierInline}
                    disabled={!newSupplierName.trim() || creatingSupplier}
                    className="bg-ide-navy text-white hover:bg-ide-navy-hover"
                  >
                    {creatingSupplier ? t.status.saving : t.actions.save}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div>
            <Label>{t.purchaseOrder.currency}</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PO_CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!fixedDealId && (
            <div>
              <Label>
                {t.purchaseOrder.linked_deal} <span className="text-destructive">*</span>
              </Label>
              <Popover open={dealComboOpen} onOpenChange={setDealComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between font-normal"
                  >
                    {selectedDeal
                      ? `${selectedDeal.so_number} — ${selectedDeal.name}`
                      : t.purchaseOrder.selectDeal}
                    <Search className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t.actions.search} />
                    <CommandList>
                      <CommandEmpty>{t.status.noResults}</CommandEmpty>
                      <CommandGroup>
                        {deals.map((d) => (
                          <CommandItem
                            key={d.id}
                            value={`${d.so_number} ${d.name} ${d.company_name}`}
                            onSelect={() => {
                              setLinkedDealId(d.id);
                              setDealComboOpen(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="font-mono text-xs text-muted-foreground">
                                {d.so_number}
                              </span>
                              <span className="text-sm">{d.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {d.company_name}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.purchaseOrder.requireDealHelp}
              </p>
            </div>
          )}
        </div>

        <SheetFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t.actions.cancel}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !supplierId || (!fixedDealId && !linkedDealId)}
            className={cn("bg-ide-navy text-white hover:bg-ide-navy-hover")}
          >
            {saving ? t.status.saving : t.actions.create}
            {!saving && <Plus className="ml-1 h-4 w-4" />}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
