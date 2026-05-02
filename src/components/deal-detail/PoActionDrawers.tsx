import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t, formatNumber } from "@/lib/sala_translations_is";
import { pathSafe } from "@/lib/formatters";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  logPoInvoiceRegistered,
  logPoInvoiceEdited,
  logPoInvoiceApproved,
  logPoPaid,
  logPoLinesEdited,
  logPoExchangeRateEdited,
  logPoDeleted,
} from "@/lib/poActivityLog";

type PORow = Database["public"]["Tables"]["purchase_orders"]["Row"];
type POLine = Database["public"]["Tables"]["po_lines"]["Row"];

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// Register / edit supplier invoice
// ---------------------------------------------------------------------------

interface InvoiceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: PORow;
  dealId: string;
  currentProfileId: string | null;
  /** When true, we're editing an already-registered invoice. */
  editMode: boolean;
  onSaved: () => void | Promise<void>;
}

export function InvoiceDrawer({
  open,
  onOpenChange,
  po,
  dealId,
  currentProfileId,
  editMode,
  onSaved,
}: InvoiceDrawerProps) {
  const [number, setNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editMode) {
      setNumber(po.supplier_invoice_number ?? "");
      setAmount(
        po.supplier_invoice_amount != null
          ? String(po.supplier_invoice_amount)
          : String(po.amount ?? ""),
      );
      setDate(po.invoice_received_date ?? todayIso());
    } else {
      setNumber("");
      setAmount(po.amount != null ? String(po.amount) : "");
      setDate(todayIso());
    }
    setFile(null);
  }, [open, editMode, po]);

  const save = async () => {
    if (saving) return;
    if (!number.trim() || !amount) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    // PDF required only on initial registration (not when editing)
    if (!editMode && !file) {
      toast.error(t.purchaseOrder.invoiceFileRequired);
      return;
    }
    setSaving(true);

    const patch: Partial<PORow> = {
      supplier_invoice_number: number.trim(),
      supplier_invoice_amount: Number(amount),
      invoice_received_date: date || null,
    };
    if (!editMode) {
      patch.status = "invoiced";
      patch.invoice_registered_by = currentProfileId;
    }

    const { error } = await supabase
      .from("purchase_orders")
      .update(patch)
      .eq("id", po.id);
    if (error) {
      console.error(error);
      toast.error(t.status.somethingWentWrong);
      setSaving(false);
      return;
    }

    if (file) {
      const ts = Math.floor(Date.now() / 1000);
      const storagePath = `${pathSafe(po.supplier)}/${pathSafe(po.po_number)}/invoice-${ts}-${pathSafe(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from("po_files")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "application/pdf",
        });
      if (!upErr) {
        await supabase.from("po_files").insert({
          po_id: po.id,
          storage_path: storagePath,
          file_url: null,
          file_type: "invoice",
          original_filename: file.name,
          file_size_bytes: file.size,
          uploaded_by: currentProfileId,
        });
      } else {
        console.error(upErr);
      }
    }

    if (editMode) {
      await logPoInvoiceEdited({
        dealId,
        poNumber: po.po_number,
        createdBy: currentProfileId,
      });
    } else {
      await logPoInvoiceRegistered({
        dealId,
        poNumber: po.po_number,
        invoiceNumber: number.trim(),
        createdBy: currentProfileId,
      });
    }

    toast.success(t.status.savedSuccessfully);
    setSaving(false);
    onOpenChange(false);
    await onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[440px]">
        <SheetHeader>
          <SheetTitle>
            {editMode
              ? t.purchaseOrder.invoiceDrawerEditTitle
              : t.purchaseOrder.invoiceDrawerTitle}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>{t.purchaseOrder.invoiceNumberLabel}</Label>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div>
            <Label>
              {t.purchaseOrder.invoiceAmountInOriginal} ({po.currency})
            </Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label>{t.purchaseOrder.invoiceReceivedDateLabel}</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label>
              {t.purchaseOrder.invoiceUploadFile}
              {!editMode && <span className="text-destructive"> *</span>}
            </Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <Upload className="h-4 w-4 text-muted-foreground" />
            </div>
            {editMode && (
              <p className="mt-1 text-xs text-muted-foreground">
                Aðeins valið ef skipt er um skjal.
              </p>
            )}
          </div>
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t.actions.cancel}
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
          >
            {saving ? t.status.saving : t.actions.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Approve invoice (single-click confirm)
// ---------------------------------------------------------------------------

interface ApproveInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: PORow;
  dealId: string;
  currentProfileId: string | null;
  onSaved: () => void | Promise<void>;
}

export function ApproveInvoiceDialog({
  open,
  onOpenChange,
  po,
  dealId,
  currentProfileId,
  onSaved,
}: ApproveInvoiceDialogProps) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase
      .from("purchase_orders")
      .update({
        invoice_approved_at: new Date().toISOString(),
        invoice_approved_by: currentProfileId,
      })
      .eq("id", po.id);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      setBusy(false);
      return;
    }
    await logPoInvoiceApproved({
      dealId,
      poNumber: po.po_number,
      createdBy: currentProfileId,
    });
    toast.success(t.status.savedSuccessfully);
    setBusy(false);
    onOpenChange(false);
    await onSaved();
  };
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.purchaseOrder.actionApproveInvoice}</AlertDialogTitle>
          <AlertDialogDescription>
            {po.po_number} · {po.supplier_invoice_number ?? "—"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            disabled={busy}
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
          >
            {t.actions.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Mark as paid
// ---------------------------------------------------------------------------

interface MarkPaidDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: PORow;
  dealId: string;
  currentProfileId: string | null;
  onSaved: () => void | Promise<void>;
}

export function MarkPaidDrawer({
  open,
  onOpenChange,
  po,
  dealId,
  currentProfileId,
  onSaved,
}: MarkPaidDrawerProps) {
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setDate(po.paid_date ?? todayIso());
  }, [open, po.paid_date]);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const { error } = await supabase
      .from("purchase_orders")
      .update({ status: "paid", paid_date: date || todayIso() })
      .eq("id", po.id);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      setBusy(false);
      return;
    }
    await logPoPaid({
      dealId,
      poNumber: po.po_number,
      paidDate: date || todayIso(),
      createdBy: currentProfileId,
    });
    toast.success(t.status.savedSuccessfully);
    setBusy(false);
    onOpenChange(false);
    await onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle>{t.purchaseOrder.confirmMarkPaid}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>{t.purchaseOrder.pickPaymentDate}</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t.actions.cancel}
          </Button>
          <Button
            onClick={save}
            disabled={busy}
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
          >
            {busy ? t.status.saving : t.actions.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Edit exchange rate
// ---------------------------------------------------------------------------

interface EditExchangeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: PORow;
  dealId: string;
  currentProfileId: string | null;
  onSaved: () => void | Promise<void>;
}

export function EditExchangeDrawer({
  open,
  onOpenChange,
  po,
  dealId,
  currentProfileId,
  onSaved,
}: EditExchangeDrawerProps) {
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setRate(po.exchange_rate != null ? String(po.exchange_rate) : "");
  }, [open, po.exchange_rate]);

  const save = async () => {
    if (busy) return;
    const n = Number(rate);
    if (!n || n <= 0) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("purchase_orders")
      .update({ exchange_rate: n })
      .eq("id", po.id);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      setBusy(false);
      return;
    }
    await logPoExchangeRateEdited({
      dealId,
      poNumber: po.po_number,
      newRate: n,
      createdBy: currentProfileId,
    });
    toast.success(t.status.savedSuccessfully);
    setBusy(false);
    onOpenChange(false);
    await onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle>{t.purchaseOrder.editExchangeTitle}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>
              {t.purchaseOrder.exchange_rate} (1 {po.currency} = ? ISK)
            </Label>
            <Input
              type="number"
              step="0.0001"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t.actions.cancel}
          </Button>
          <Button
            onClick={save}
            disabled={busy}
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
          >
            {busy ? t.status.saving : t.actions.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Edit PO lines
// ---------------------------------------------------------------------------

interface EditLinesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: PORow;
  dealId: string;
  currentProfileId: string | null;
  onSaved: () => void | Promise<void>;
}

interface EditableLine {
  id: string | null;
  description: string;
  quantity: string;
  unit_cost: string;
  supplier_sku: string;
  line_order: number;
}

export function EditLinesDrawer({
  open,
  onOpenChange,
  po,
  dealId,
  currentProfileId,
  onSaved,
}: EditLinesDrawerProps) {
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data } = await supabase
        .from("po_lines")
        .select("*")
        .eq("purchase_order_id", po.id)
        .order("line_order");
      const rows = (data ?? []) as POLine[];
      if (rows.length === 0) {
        setLines([
          {
            id: null,
            description: "",
            quantity: "1",
            unit_cost: "0",
            supplier_sku: "",
            line_order: 1,
          },
        ]);
      } else {
        setLines(
          rows.map((l) => ({
            id: l.id,
            description: l.description,
            quantity: String(l.quantity),
            unit_cost: String(l.unit_cost),
            supplier_sku: l.supplier_sku ?? "",
            line_order: l.line_order,
          })),
        );
      }
    })();
  }, [open, po.id]);

  const updateLine = (idx: number, patch: Partial<EditableLine>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };
  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: null,
        description: "",
        quantity: "1",
        unit_cost: "0",
        supplier_sku: "",
        line_order: prev.length + 1,
      },
    ]);
  };
  const removeLine = (idx: number) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);

    // Strategy: delete-all-then-insert-all (matches old editor behavior, simple & atomic-ish)
    const { error: delErr } = await supabase
      .from("po_lines")
      .delete()
      .eq("purchase_order_id", po.id);
    if (delErr) {
      toast.error(t.status.somethingWentWrong);
      setBusy(false);
      return;
    }
    const toInsert = lines
      .filter((l) => l.description.trim().length > 0)
      .map((l, i) => {
        const qty = Number(l.quantity) || 1;
        const cost = Number(l.unit_cost) || 0;
        return {
          purchase_order_id: po.id,
          description: l.description.trim(),
          quantity: qty,
          unit_cost: cost,
          line_total: qty * cost,
          supplier_sku: l.supplier_sku.trim() || null,
          line_order: i + 1,
        };
      });
    if (toInsert.length > 0) {
      const { error: insErr } = await supabase.from("po_lines").insert(toInsert);
      if (insErr) {
        toast.error(t.status.somethingWentWrong);
        setBusy(false);
        return;
      }
    }
    await logPoLinesEdited({
      dealId,
      poNumber: po.po_number,
      createdBy: currentProfileId,
    });
    toast.success(t.status.savedSuccessfully);
    setBusy(false);
    onOpenChange(false);
    await onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[640px]">
        <SheetHeader>
          <SheetTitle>{t.purchaseOrder.editLinesTitle}</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 py-4">
          {lines.map((l, i) => {
            const lineTotal = (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0);
            return (
              <div
                key={i}
                className="space-y-2 rounded-md border border-border bg-muted/30 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    #{i + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeLine(i)}
                    aria-label={t.purchaseOrder.deleteLine}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div>
                  <Label className="text-xs">
                    {t.purchaseOrder.lineDescription}
                  </Label>
                  <Input
                    value={l.description}
                    onChange={(e) =>
                      updateLine(i, { description: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">{t.purchaseOrder.lineQuantity}</Label>
                    <Input
                      type="number"
                      value={l.quantity}
                      onChange={(e) => updateLine(i, { quantity: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">
                      {t.purchaseOrder.lineUnitCost} ({po.currency})
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={l.unit_cost}
                      onChange={(e) =>
                        updateLine(i, { unit_cost: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t.purchaseOrder.lineSku}</Label>
                    <Input
                      value={l.supplier_sku}
                      onChange={(e) =>
                        updateLine(i, { supplier_sku: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground tabular-nums">
                  {po.currency} {formatNumber(lineTotal, 2)}
                </div>
              </div>
            );
          })}
          <Button variant="outline" size="sm" onClick={addLine} className="w-full">
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t.purchaseOrder.addLine}
          </Button>
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t.actions.cancel}
          </Button>
          <Button
            onClick={save}
            disabled={busy}
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
          >
            {busy ? t.status.saving : t.actions.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Delete PO
// ---------------------------------------------------------------------------

interface DeletePoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: PORow;
  dealId: string;
  currentProfileId: string | null;
  onSaved: () => void | Promise<void>;
}

export function DeletePoDialog({
  open,
  onOpenChange,
  po,
  dealId,
  currentProfileId,
  onSaved,
}: DeletePoDialogProps) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    // Lines first (no FK cascade guarantee), then files, then PO
    await supabase.from("po_lines").delete().eq("purchase_order_id", po.id);
    await supabase.from("po_files").delete().eq("po_id", po.id);
    const { error } = await supabase
      .from("purchase_orders")
      .delete()
      .eq("id", po.id);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      setBusy(false);
      return;
    }
    await logPoDeleted({
      dealId,
      poNumber: po.po_number,
      createdBy: currentProfileId,
    });
    toast.success(t.status.savedSuccessfully);
    setBusy(false);
    onOpenChange(false);
    await onSaved();
  };
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.purchaseOrder.deletePoConfirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {t.purchaseOrder.deletePoConfirmBody}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t.purchaseOrder.deletePoConfirmYes}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
