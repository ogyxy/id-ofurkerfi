import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Upload, Eye } from "lucide-react";
import { PdfPreviewOverlay } from "@/components/PdfPreviewOverlay";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t } from "@/lib/sala_translations_is";
import {
  hasViewedPoInvoice,
  markPoInvoiceViewed,
  subscribePoInvoiceViewed,
} from "@/lib/poInvoiceViewed";
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
  logPoDeleted,
} from "@/lib/poActivityLog";

type PORow = Database["public"]["Tables"]["purchase_orders"]["Row"];


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
  const [mismatchOpen, setMismatchOpen] = useState(false);

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
    setMismatchOpen(false);
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [viewed, setViewed] = useState(() => hasViewedPoInvoice(po.id));

  useEffect(() => {
    setViewed(hasViewedPoInvoice(po.id));
    return subscribePoInvoiceViewed(() => {
      setViewed(hasViewedPoInvoice(po.id));
    });
  }, [po.id, open]);

  const openInvoicePreview = async () => {
    onOpenChange(false);
    if (loadingPreview) return;
    setLoadingPreview(true);
    const { data: files, error } = await supabase
      .from("po_files")
      .select("*")
      .eq("po_id", po.id)
      .eq("file_type", "invoice")
      .order("uploaded_at", { ascending: false })
      .limit(1);
    if (error || !files || files.length === 0) {
      toast.error(t.status.somethingWentWrong);
      setLoadingPreview(false);
      return;
    }
    const f = files[0];
    let url: string | null = null;
    if (f.storage_path) {
      const { data, error: sErr } = await supabase.storage
        .from("po_files")
        .createSignedUrl(f.storage_path, 60);
      if (sErr || !data?.signedUrl) {
        toast.error(t.status.somethingWentWrong);
        setLoadingPreview(false);
        return;
      }
      url = data.signedUrl;
    } else {
      url = f.file_url ?? null;
    }
    setLoadingPreview(false);
    if (!url) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    setPreviewUrl(url);
    setPreviewName(f.original_filename ?? null);
    markPoInvoiceViewed(po.id);
  };

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
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.purchaseOrder.actionApproveInvoice}</AlertDialogTitle>
            <AlertDialogDescription>
              {po.po_number} · {po.supplier_invoice_number ?? "—"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {!viewed && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t.purchaseOrder.invoiceNotViewedWarning}
            </div>
          )}
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={openInvoicePreview}
              disabled={loadingPreview}
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              {t.purchaseOrder.actionViewInvoice}
            </Button>
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
      {previewUrl && (
        <PdfPreviewOverlay
          open={true}
          url={previewUrl}
          title={`${t.purchaseOrder.fileLabelInvoice}${previewName ? ` · ${previewName}` : ""}`}
          filename={previewName ?? undefined}
          onClose={() => {
            setPreviewUrl(null);
            setPreviewName(null);
            onOpenChange(true);
          }}
        />
      )}
    </>
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
