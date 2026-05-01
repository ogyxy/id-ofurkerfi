import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Search, Upload } from "lucide-react";
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
import { pathSafe } from "@/lib/formatters";
import { PO_CURRENCIES } from "@/lib/poConstants";
import { logPoCreated } from "@/lib/poActivityLog";

type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
type PO = Database["public"]["Tables"]["purchase_orders"]["Row"];

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
  /** Called after successful save with the PO id */
  onCreated?: (newPoId: string) => void;
  /** When true, navigate to /innkaup/:id automatically (create mode only) */
  navigateOnCreate?: boolean;
  /** When provided, the drawer operates in edit mode for that PO */
  editPo?: PO | null;
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

async function fetchExchangeRate(currency: string): Promise<number | null> {
  if (currency === "ISK") return 1;
  try {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=${currency}&symbols=ISK`,
    );
    const json = await res.json();
    return Number(json?.rates?.ISK) || null;
  } catch {
    return null;
  }
}

export function CreatePoDrawer({
  open,
  onOpenChange,
  fixedDealId,
  currentProfileId,
  onCreated,
  navigateOnCreate = true,
  editPo = null,
}: Props) {
  const isEdit = Boolean(editPo);
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [supplierRef, setSupplierRef] = useState<string>("");
  const [orderDate, setOrderDate] = useState<string>(todayIso());
  const [expectedDate, setExpectedDate] = useState<string>("");
  const [currency, setCurrency] = useState<string>("EUR");
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [shippingCost, setShippingCost] = useState<string>("0");
  const [linkedDealId, setLinkedDealId] = useState<string>("");
  const [orderConfirmFile, setOrderConfirmFile] = useState<File | null>(null);
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [dealComboOpen, setDealComboOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Inline new supplier form
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierCurrency, setNewSupplierCurrency] = useState<string>("EUR");
  const [creatingSupplier, setCreatingSupplier] = useState(false);

  // Load suppliers
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

  // Load deals (only when not in edit mode and no fixed deal)
  useEffect(() => {
    if (!open || fixedDealId || isEdit) return;
    void (async () => {
      const { data } = await supabase
        .from("deals")
        .select("id, so_number, name, company:companies(name)")
        .eq("archived", false)
        .order("created_at", { ascending: false })
        .limit(500);
      const opts: DealOption[] = (data ?? []).map((d) => ({
        id: d.id,
        so_number: d.so_number,
        name: d.name,
        company_name:
          (d as unknown as { company: { name: string } | null }).company?.name ?? "",
      }));
      setDeals(opts);
    })();
  }, [open, fixedDealId, isEdit]);

  // Reset / hydrate when opening
  useEffect(() => {
    if (!open) return;
    if (editPo) {
      setSupplierId(editPo.supplier_id ?? "");
      setSupplierRef(editPo.supplier_reference ?? "");
      setOrderDate(editPo.order_date ?? todayIso());
      setExpectedDate(editPo.expected_delivery_date ?? "");
      setCurrency(editPo.currency);
      setExchangeRate(editPo.exchange_rate != null ? String(editPo.exchange_rate) : "");
      setAmount(editPo.amount != null ? String(editPo.amount) : "");
      setShippingCost(editPo.shipping_cost != null ? String(editPo.shipping_cost) : "0");
      setLinkedDealId(editPo.deal_id ?? "");
      setOrderConfirmFile(null);
    } else {
      setSupplierId("");
      setSupplierRef("");
      setOrderDate(todayIso());
      setExpectedDate("");
      setCurrency("EUR");
      setExchangeRate("");
      setAmount("");
      setShippingCost("0");
      setLinkedDealId("");
      setOrderConfirmFile(null);
      setShowNewSupplier(false);
      setNewSupplierName("");
      setNewSupplierCurrency("EUR");
    }
    setCurrencyTouched(false);
  }, [open, editPo]);

  // Auto-fill currency from supplier (create mode only, only if user hasn't touched it)
  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === supplierId) ?? null,
    [supplierId, suppliers],
  );
  useEffect(() => {
    if (isEdit) return;
    if (currencyTouched) return;
    const next = selectedSupplier?.default_currency;
    if (next && next !== currency) {
      setCurrency(next);
      setExchangeRate(""); // refetch for new currency
    }
  }, [selectedSupplier, isEdit, currencyTouched, currency]);

  // Auto-fetch exchange rate when currency changes and field is empty
  useEffect(() => {
    if (!open) return;
    if (currency === "ISK") {
      setExchangeRate("1");
      return;
    }
    if (exchangeRate) return;
    void (async () => {
      const rate = await fetchExchangeRate(currency);
      if (rate) setExchangeRate(String(rate));
      else setExchangeRate("1");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, open]);

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
    setSuppliers((prev) =>
      [...prev, data as Supplier].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setSupplierId(data.id);
    setCurrency(data.default_currency);
    setShowNewSupplier(false);
    setNewSupplierName("");
  };

  const uploadOrderConfirmation = async (poId: string, poNumber: string, supplierName: string) => {
    if (!orderConfirmFile) return;
    const supplierSafe = pathSafe(supplierName || "unknown");
    const ts = Math.floor(Date.now() / 1000);
    const storagePath = `${supplierSafe}/${pathSafe(poNumber)}/${ts}-${pathSafe(orderConfirmFile.name)}`;
    const { error: upErr } = await supabase.storage
      .from("po_files")
      .upload(storagePath, orderConfirmFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: orderConfirmFile.type || "application/pdf",
      });
    if (upErr) {
      console.error(upErr);
      return;
    }
    await supabase.from("po_files").insert({
      po_id: poId,
      storage_path: storagePath,
      file_url: null,
      file_type: "order_confirmation",
      original_filename: orderConfirmFile.name,
      file_size_bytes: orderConfirmFile.size,
      uploaded_by: currentProfileId,
    });
  };

  const handleSave = async () => {
    if (!supplierId) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) return;
    const dealIdToUse = fixedDealId ?? linkedDealId ?? editPo?.deal_id ?? null;
    if (!isEdit && !dealIdToUse) {
      toast.error(t.purchaseOrder.requireDealHelp);
      return;
    }
    setSaving(true);

    const corePatch = {
      supplier_id: supplierId,
      supplier: supplier.name,
      supplier_reference: supplierRef.trim() || null,
      order_date: orderDate || null,
      expected_delivery_date: expectedDate || null,
      currency,
      exchange_rate: exchangeRate ? Number(exchangeRate) : null,
      amount: amount ? Number(amount) : 0,
      shipping_cost: shippingCost ? Number(shippingCost) : 0,
    };

    if (isEdit && editPo) {
      const { error } = await supabase
        .from("purchase_orders")
        .update(corePatch)
        .eq("id", editPo.id);
      setSaving(false);
      if (error) {
        toast.error(t.status.somethingWentWrong);
        return;
      }
      // Optional file replace
      if (orderConfirmFile) {
        await uploadOrderConfirmation(editPo.id, editPo.po_number, supplier.name);
      }
      // Sync expected_delivery_date → linked deal estimated_delivery_date
      if (editPo.deal_id) {
        await supabase
          .from("deals")
          .update({ estimated_delivery_date: expectedDate || null })
          .eq("id", editPo.deal_id);
      }
      toast.success(t.status.savedSuccessfully);
      onOpenChange(false);
      onCreated?.(editPo.id);
      return;
    }

    const { data, error } = await supabase
      .from("purchase_orders")
      .insert({
        ...corePatch,
        deal_id: dealIdToUse!,
        status: "ordered",
      })
      .select()
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    if (orderConfirmFile) {
      await uploadOrderConfirmation(data.id, data.po_number, supplier.name);
    }
    if (dealIdToUse && expectedDate) {
      await supabase
        .from("deals")
        .update({ estimated_delivery_date: expectedDate })
        .eq("id", dealIdToUse);
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

  const sectionDivider = "border-t border-border pt-4";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? t.purchaseOrder.coreFieldsEditTitle : t.purchaseOrder.createTitle}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Identity */}
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
            {!showNewSupplier && !isEdit && (
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

          {!fixedDealId && !isEdit && (
            <div>
              <Label>
                {t.purchaseOrder.linked_deal}{" "}
                <span className="text-destructive">*</span>
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

          <div>
            <Label>{t.purchaseOrder.supplier_reference}</Label>
            <Input
              value={supplierRef}
              onChange={(e) => setSupplierRef(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t.purchaseOrder.order_date}</Label>
              <Input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </div>
            <div>
              <Label>{t.purchaseOrder.expected_delivery_date}</Label>
              <Input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
          </div>

          {/* Financial */}
          <div className={sectionDivider}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t.purchaseOrder.currency}</Label>
                <Select
                  value={currency}
                  onValueChange={(v) => {
                    setCurrencyTouched(true);
                    setCurrency(v);
                    setExchangeRate(""); // trigger refetch
                  }}
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
              </div>
              <div>
                <Label>{t.purchaseOrder.exchange_rate}</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Label>
                  {t.purchaseOrder.amount} ({currency})
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <Label>
                  {t.purchaseOrder.shipping_cost} ({currency})
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Document */}
          <div className={sectionDivider}>
            <Label>
              {t.purchaseOrder.orderConfirmationUpload}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                ({t.purchaseOrder.orderConfirmationOptional})
              </span>
            </Label>
            <Input
              type="file"
              accept="application/pdf"
              onChange={(e) => setOrderConfirmFile(e.target.files?.[0] ?? null)}
              className="cursor-pointer"
            />
            {orderConfirmFile && (
              <p className="mt-1 text-xs text-muted-foreground">
                <Upload className="mr-1 inline h-3 w-3" />
                {orderConfirmFile.name}
              </p>
            )}
          </div>
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
            disabled={
              saving ||
              !supplierId ||
              (!isEdit && !fixedDealId && !linkedDealId)
            }
            className={cn("bg-ide-navy text-white hover:bg-ide-navy-hover")}
          >
            {saving
              ? t.status.saving
              : isEdit
                ? t.actions.save
                : t.actions.create}
            {!saving && !isEdit && <Plus className="ml-1 h-4 w-4" />}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
