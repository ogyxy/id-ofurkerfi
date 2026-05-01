import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Upload } from "lucide-react";
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
import { pathSafe } from "@/lib/formatters";
import { logPoInvoiceRegistered } from "@/lib/poActivityLog";

type PO = Database["public"]["Tables"]["purchase_orders"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: PO;
  currentProfileId: string | null;
  onSaved: () => void | Promise<void>;
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

export function InvoiceDrawer({
  open,
  onOpenChange,
  po,
  currentProfileId,
  onSaved,
}: Props) {
  const isEdit = Boolean(po.invoice_received_date);
  const wasApproved = Boolean(po.invoice_approved_at);

  const [invoiceNumber, setInvoiceNumber] = useState(po.supplier_invoice_number ?? "");
  const [invoiceAmount, setInvoiceAmount] = useState<string>(
    po.supplier_invoice_amount != null ? String(po.supplier_invoice_amount) : "",
  );
  const [invoiceDate, setInvoiceDate] = useState<string>(
    po.invoice_received_date ?? todayIso(),
  );
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReapprove, setConfirmReapprove] = useState(false);

  useEffect(() => {
    if (!open) return;
    setInvoiceNumber(po.supplier_invoice_number ?? "");
    setInvoiceAmount(
      po.supplier_invoice_amount != null ? String(po.supplier_invoice_amount) : "",
    );
    setInvoiceDate(po.invoice_received_date ?? todayIso());
    setFile(null);
  }, [open, po]);

  const performSave = async (clearApproval: boolean) => {
    setSaving(true);
    try {
      // 1. Upload file if present
      if (file) {
        const supplierSafe = pathSafe(po.supplier || "unknown");
        const ts = Math.floor(Date.now() / 1000);
        const storagePath = `${supplierSafe}/${pathSafe(po.po_number)}/${ts}-${pathSafe(file.name)}`;
        const { error: upErr } = await supabase.storage
          .from("po_files")
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || "application/octet-stream",
          });
        if (upErr) throw new Error(upErr.message);
        const { error: insErr } = await supabase.from("po_files").insert({
          po_id: po.id,
          storage_path: storagePath,
          file_url: null,
          file_type: "invoice",
          original_filename: file.name,
          file_size_bytes: file.size,
          uploaded_by: currentProfileId,
        });
        if (insErr) throw new Error(insErr.message);
      }

      // 2. Update PO
      const patch: Partial<PO> = {
        supplier_invoice_number: invoiceNumber.trim() || null,
        supplier_invoice_amount: invoiceAmount ? Number(invoiceAmount) : null,
        invoice_received_date: invoiceDate || null,
      };
      if (!po.invoice_registered_by) {
        patch.invoice_registered_by = currentProfileId;
      }
      if (clearApproval) {
        patch.invoice_approved_at = null;
        patch.invoice_approved_by = null;
      }
      const { error: updErr } = await supabase
        .from("purchase_orders")
        .update(patch)
        .eq("id", po.id);
      if (updErr) throw new Error(updErr.message);

      if (!isEdit) {
        await logPoInvoiceRegistered({
          dealId: po.deal_id,
          poNumber: po.po_number,
          invoiceNumber: invoiceNumber.trim() || null,
          createdBy: currentProfileId,
        });
      }

      toast.success(t.status.savedSuccessfully);
      onOpenChange(false);
      await onSaved();
    } catch (err) {
      toast.error(t.status.somethingWentWrong);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClick = () => {
    if (isEdit && wasApproved) {
      setConfirmReapprove(true);
      return;
    }
    void performSave(false);
  };

  const canSave = invoiceDate && (invoiceAmount !== "" || invoiceNumber.trim() || file);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-[480px]">
          <SheetHeader>
            <SheetTitle>
              {isEdit
                ? t.purchaseOrder.invoiceDrawerEditTitle
                : t.purchaseOrder.invoiceDrawerTitle}
            </SheetTitle>
          </SheetHeader>

          {isEdit && wasApproved && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t.purchaseOrder.editInvoiceWarning}</span>
            </div>
          )}

          <div className="space-y-4 py-4">
            <div>
              <Label>{t.purchaseOrder.invoiceNumberLabel}</Label>
              <Input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>
            <div>
              <Label>
                {t.purchaseOrder.invoiceAmountInOriginal} ({po.currency})
              </Label>
              <Input
                type="number"
                step="0.01"
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>{t.purchaseOrder.invoiceReceivedDateLabel}</Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
            <div>
              <Label>{t.purchaseOrder.invoiceUploadFile}</Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="cursor-pointer"
                />
              </div>
              {file && (
                <p className="mt-1 text-xs text-muted-foreground">
                  <Upload className="mr-1 inline h-3 w-3" />
                  {file.name}
                </p>
              )}
            </div>
          </div>

          <SheetFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              {t.actions.cancel}
            </Button>
            <Button
              onClick={handleSaveClick}
              disabled={saving || !canSave}
              className={cn("bg-ide-navy text-white hover:bg-ide-navy-hover")}
            >
              {saving ? t.status.saving : t.actions.save}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmReapprove} onOpenChange={setConfirmReapprove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.status.areYouSure}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.purchaseOrder.editInvoiceWarning}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{t.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmReapprove(false);
                void performSave(true);
              }}
              disabled={saving}
              className="bg-ide-navy text-white hover:bg-ide-navy-hover"
            >
              {t.actions.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
