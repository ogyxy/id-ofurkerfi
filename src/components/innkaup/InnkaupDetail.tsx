import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Download, MoreHorizontal, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { FileThumbnail } from "@/components/FileThumbnail";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { t, formatDate, formatIsk, formatNumber } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { pathSafe, formatFileSize } from "@/lib/formatters";
import { consumeDealReturnPath } from "@/lib/dealReturn";
import {
  HAPPY_PATH_PO_STATUSES,
  PO_CURRENCIES,
  PO_FILE_TYPES,
  poFileTypeLabel,
  type POStatus,
  type PoFileType,
} from "@/lib/poConstants";
import {
  logPoCreated,
  logPoPaid,
  logPoReceived,
  logPoStatusChanged,
} from "@/lib/poActivityLog";

type PO = Database["public"]["Tables"]["purchase_orders"]["Row"];
type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
type PoFile = Database["public"]["Tables"]["po_files"]["Row"] & {
  signedUrl?: string | null;
  signedUrlDownload?: string | null;
};
type Activity = {
  id: string;
  type: string;
  body: string | null;
  created_at: string;
  profile: { id: string; name: string | null } | null;
};

const NAVY = "#1a2540";

interface Props {
  poId: string;
  currentProfileId: string;
}

export function InnkaupDetail({ poId, currentProfileId }: Props) {
  const navigate = useNavigate();
  const [po, setPo] = useState<PO | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [linkedDeal, setLinkedDeal] = useState<{
    id: string;
    so_number: string;
    name: string;
    company: { id: string; name: string } | null;
  } | null>(null);
  const [files, setFiles] = useState<PoFile[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<POStatus | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [logText, setLogText] = useState("");

  const load = useCallback(async () => {
    const [poRes, filesRes] = await Promise.all([
      supabase
        .from("purchase_orders")
        .select(
          `*,
           supplier_record:suppliers(*),
           deal:deals(id, so_number, name, company:companies(id, name))`,
        )
        .eq("id", poId)
        .maybeSingle(),
      supabase
        .from("po_files")
        .select("*")
        .eq("po_id", poId)
        .order("uploaded_at", { ascending: false }),
    ]);
    if (!poRes.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data = poRes.data as PO & {
      supplier_record: Supplier | null;
      deal: typeof linkedDeal;
    };
    setPo(data);
    setSupplier(data.supplier_record);
    setLinkedDeal(data.deal ?? null);
    const rawFiles = (filesRes.data ?? []) as PoFile[];
    const filesWithUrls = await Promise.all(
      rawFiles.map(async (f) => {
        if (!f.storage_path) {
          return { ...f, signedUrl: f.file_url ?? null, signedUrlDownload: f.file_url ?? null };
        }
        const [view, dl] = await Promise.all([
          supabase.storage.from("po_files").createSignedUrl(f.storage_path, 3600),
          supabase.storage
            .from("po_files")
            .createSignedUrl(f.storage_path, 3600, {
              download: f.original_filename ?? true,
            }),
        ]);
        return {
          ...f,
          signedUrl: view.data?.signedUrl ?? null,
          signedUrlDownload: dl.data?.signedUrl ?? null,
        };
      }),
    );
    setFiles(filesWithUrls);

    if (data.deal_id) {
      const { data: acts } = await supabase
        .from("activities")
        .select(
          "id, type, body, created_at, profile:profiles!activities_created_by_fkey(id, name)",
        )
        .eq("deal_id", data.deal_id)
        .like("body", `${data.po_number}%`)
        .order("created_at", { ascending: false });
      setActivities((acts ?? []) as unknown as Activity[]);
    } else {
      setActivities([]);
    }
    setLoading(false);
  }, [poId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const updatePo = async (patch: Partial<PO>) => {
    if (!po) return;
    const { error } = await supabase
      .from("purchase_orders")
      .update(patch)
      .eq("id", po.id);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    await load();
  };

  const fetchExchangeRate = async (currency: string) => {
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
  };

  const handleStatusChange = async (next: POStatus) => {
    if (!po) return;
    const today = new Date().toISOString().split("T")[0];
    const patch: Partial<PO> = { status: next };
    if (next === "received" && !po.received_date) patch.received_date = today;
    if (next === "paid" && !po.paid_date) patch.paid_date = today;
    await updatePo(patch);
    await logPoStatusChanged({
      dealId: po.deal_id,
      poNumber: po.po_number,
      newStatus: next,
      createdBy: currentProfileId,
    });
    if (next === "received" && !po.received_date) {
      await logPoReceived({
        dealId: po.deal_id,
        poNumber: po.po_number,
        receivedDate: today,
        createdBy: currentProfileId,
      });
    }
    if (next === "paid" && !po.paid_date) {
      await logPoPaid({
        dealId: po.deal_id,
        poNumber: po.po_number,
        paidDate: today,
        createdBy: currentProfileId,
      });
    }
    setConfirmStatus(null);
  };

  const handleCancel = async () => {
    await updatePo({ status: "cancelled" });
    if (po) {
      await logPoStatusChanged({
        dealId: po.deal_id,
        poNumber: po.po_number,
        newStatus: "cancelled",
        createdBy: currentProfileId,
      });
    }
  };

  const handleReactivate = async () => {
    await updatePo({ status: "ordered" });
    if (po) {
      await logPoStatusChanged({
        dealId: po.deal_id,
        poNumber: po.po_number,
        newStatus: "ordered",
        createdBy: currentProfileId,
      });
    }
  };

  const submitLog = async () => {
    const body = logText.trim();
    if (!body || !po?.deal_id) return;
    await supabase.from("activities").insert({
      deal_id: po.deal_id,
      type: "note",
      body: `${po.po_number}: ${body}`,
      created_by: currentProfileId,
    });
    setLogText("");
    await load();
  };

  if (loading) {
    return <div className="py-20 text-center text-sm text-muted-foreground">{t.status.loading}</div>;
  }
  if (notFound || !po) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-muted-foreground">{t.status.noResults}</p>
      </div>
    );
  }

  const supplierName = supplier?.name ?? po.supplier;
  const totalOriginal = Number(po.amount ?? 0) + Number(po.shipping_cost ?? 0);
  const exchangeRate = po.exchange_rate ? Number(po.exchange_rate) : null;
  const amountIsk = exchangeRate ? Number(po.amount ?? 0) * exchangeRate : null;
  const shippingIsk = exchangeRate ? Number(po.shipping_cost ?? 0) * exchangeRate : null;
  const totalIsk = exchangeRate ? totalOriginal * exchangeRate : null;

  const filesByType = new Map<PoFileType, PoFile[]>();
  PO_FILE_TYPES.forEach((ft) => filesByType.set(ft, []));
  files.forEach((f) => {
    const ft = (f.file_type as PoFileType) ?? "other";
    if (!filesByType.has(ft)) filesByType.set(ft, []);
    filesByType.get(ft)!.push(f);
  });

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => {
          const ret = consumeDealReturnPath();
          navigate({ to: ret || "/innkaup" });
        }}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.actions.back}
      </button>

      {/* Stepper */}
      <PoStepper
        status={po.status}
        onChange={(next) => setConfirmStatus(next)}
        onCancel={handleCancel}
        onReactivate={handleReactivate}
      />

      {/* Header card */}
      <div className="rounded-md border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1 min-w-0">
            <div className="font-mono text-xs text-muted-foreground">{po.po_number}</div>
            <h1 className="text-2xl font-semibold md:text-3xl">{supplierName}</h1>
            {po.supplier_reference && (
              <div className="text-sm text-muted-foreground">
                {t.purchaseOrder.supplier_reference}: {po.supplier_reference}
              </div>
            )}
            <div className="pt-1">
              <span className="text-xs text-muted-foreground">{t.purchaseOrder.linked_deal}: </span>
              {linkedDeal ? (
                <Link
                  to="/deals/$id"
                  params={{ id: linkedDeal.id }}
                  className="text-sm font-medium text-ide-navy hover:underline"
                >
                  {linkedDeal.so_number} — {linkedDeal.name}
                  {linkedDeal.company && (
                    <span className="text-muted-foreground"> · {linkedDeal.company.name}</span>
                  )}
                </Link>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
          </div>

          <div className="space-y-2 md:text-right">
            <DateField
              label={t.purchaseOrder.order_date}
              value={po.order_date}
              onChange={(v) => void updatePo({ order_date: v })}
            />
            <DateField
              label={t.purchaseOrder.expected_delivery_date}
              value={po.expected_delivery_date}
              onChange={(v) => void updatePo({ expected_delivery_date: v })}
            />
            {(po.status === "received" || po.status === "invoiced" || po.status === "paid") && (
              <DateField
                label={t.purchaseOrder.received_date}
                value={po.received_date}
                onChange={(v) => void updatePo({ received_date: v })}
              />
            )}
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1 h-3.5 w-3.5" />
              {t.actions.edit}
            </Button>
          </div>
        </div>
      </div>

      {/* Amounts */}
      <div className="rounded-md border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">{t.purchaseOrder.total_amount}</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div>
              <Label>{t.purchaseOrder.currency}</Label>
              <Select
                value={po.currency}
                onValueChange={async (v) => {
                  const rate = await fetchExchangeRate(v);
                  await updatePo({ currency: v, exchange_rate: rate ?? po.exchange_rate });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PO_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t.purchaseOrder.exchange_rate}</Label>
              <Input
                type="number"
                step="0.0001"
                defaultValue={po.exchange_rate ?? ""}
                onBlur={(e) => void updatePo({ exchange_rate: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
            <div>
              <Label>{t.purchaseOrder.amount} ({po.currency})</Label>
              <Input
                type="number"
                step="0.01"
                defaultValue={po.amount ?? ""}
                key={`amt-${po.id}-${po.amount}`}
                onBlur={(e) => void updatePo({ amount: Number(e.target.value || 0) })}
              />
            </div>
            <div>
              <Label>{t.purchaseOrder.shipping_cost} ({po.currency})</Label>
              <Input
                type="number"
                step="0.01"
                defaultValue={po.shipping_cost ?? ""}
                key={`ship-${po.id}-${po.shipping_cost}`}
                onBlur={(e) => void updatePo({ shipping_cost: Number(e.target.value || 0) })}
              />
            </div>
          </div>
          <div className="space-y-2 rounded-md bg-muted/40 p-4">
            <Row label={t.purchaseOrder.amount_isk} value={amountIsk !== null ? formatIsk(amountIsk) : "—"} />
            <Row label={t.purchaseOrder.shipping_cost_isk} value={shippingIsk !== null ? formatIsk(shippingIsk) : "—"} />
            <div className="border-t border-border pt-2">
              <Row
                label={t.purchaseOrder.total_amount}
                value={totalIsk !== null ? formatIsk(totalIsk) : "—"}
                bold
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {po.currency} {formatNumber(totalOriginal, 2)}
            </div>
          </div>
        </div>
      </div>

      {/* Invoice section */}
      <div
        className={cn(
          "rounded-md border bg-card p-6",
          po.paid_date
            ? "border-l-4 border-l-green-500"
            : po.invoice_received_date
              ? "border-l-4 border-l-blue-500"
              : "border-border",
        )}
      >
        <h2 className="mb-4 text-lg font-semibold">{t.purchaseOrder.invoiceSection}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>{t.purchaseOrder.supplier_invoice_number}</Label>
            <Input
              defaultValue={po.supplier_invoice_number ?? ""}
              key={`inv-${po.id}-${po.supplier_invoice_number}`}
              onBlur={(e) => void updatePo({ supplier_invoice_number: e.target.value || null })}
            />
          </div>
          <div>
            <Label>{t.purchaseOrder.supplier_invoice_amount} ({po.currency})</Label>
            <Input
              type="number"
              step="0.01"
              defaultValue={po.supplier_invoice_amount ?? ""}
              key={`invamt-${po.id}-${po.supplier_invoice_amount}`}
              onBlur={(e) =>
                void updatePo({ supplier_invoice_amount: e.target.value ? Number(e.target.value) : null })
              }
            />
          </div>
          <div>
            <Label>{t.purchaseOrder.invoice_received_date}</Label>
            <Input
              type="date"
              defaultValue={po.invoice_received_date ?? ""}
              key={`invd-${po.id}-${po.invoice_received_date}`}
              onBlur={(e) => void updatePo({ invoice_received_date: e.target.value || null })}
            />
          </div>
          <div>
            <Label>{t.purchaseOrder.paid_date}</Label>
            <Input
              type="date"
              defaultValue={po.paid_date ?? ""}
              key={`paid-${po.id}-${po.paid_date}`}
              onBlur={(e) => void updatePo({ paid_date: e.target.value || null })}
            />
          </div>
        </div>
      </div>

      {/* Files */}
      <div className="rounded-md border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t.purchaseOrder.filesSection} ({files.length})
          </h2>
          <Button onClick={() => setUploadOpen(true)} className="bg-ide-navy text-white hover:bg-ide-navy-hover">
            <Upload className="mr-1 h-4 w-4" />
            {t.purchaseOrder.uploadFile}
          </Button>
        </div>
        {files.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t.purchaseOrder.noFiles}
          </div>
        ) : (
          <div className="space-y-5">
            {PO_FILE_TYPES.map((ft) => {
              const arr = filesByType.get(ft) ?? [];
              if (arr.length === 0) return null;
              return (
                <div key={ft}>
                  <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    {poFileTypeLabel(t, ft)}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {arr.map((f) => (
                      <FileCard
                        key={f.id}
                        file={f}
                        typeLabel={poFileTypeLabel(t, ft)}
                        onDeleted={() => void load()}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Log</h2>
        {po.deal_id ? (
          <div className="rounded-md border border-border bg-card p-3">
            <Textarea
              rows={2}
              value={logText}
              onChange={(e) => setLogText(e.target.value)}
              placeholder={t.log.placeholder}
              className="resize-none"
            />
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                disabled={!logText.trim()}
                onClick={() => void submitLog()}
                className="bg-ide-navy text-white hover:bg-ide-navy-hover"
              >
                {t.log.send}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
            {t.purchaseOrder.noDeal}
          </div>
        )}
        {activities.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t.log.noEntries}
          </div>
        ) : (
          <ul className="space-y-2">
            {activities.map((a) => (
              <li key={a.id} className="rounded-md border border-border bg-card p-3 text-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{a.profile?.name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(a.created_at)}</span>
                </div>
                {a.body && <p className="mt-1 whitespace-pre-wrap text-foreground">{a.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Confirm status change */}
      <AlertDialog open={!!confirmStatus} onOpenChange={(o) => !o && setConfirmStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.status.areYouSure}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmStatus && <>Færa í <span className="font-semibold">{t.poStatus[confirmStatus]}</span>?</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmStatus && void handleStatusChange(confirmStatus)}
              className="bg-ide-navy text-white hover:bg-ide-navy-hover"
            >
              {t.actions.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditPoDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        po={po}
        linkedDeal={linkedDeal}
        onSaved={() => void load()}
      />

      <MultiFileUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title={t.upload.title}
        fileTypes={PO_FILE_TYPES.map((ft) => ({ value: ft, label: poFileTypeLabel(t, ft) }))}
        smartGuess={smartGuessPoFileType}
        uploadOne={async (file, fileType) => {
          const supplierSafe = pathSafe(supplierName || "unknown");
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
            file_type: fileType,
            original_filename: file.name,
            file_size_bytes: file.size,
            uploaded_by: currentProfileId,
          });
          if (insErr) throw new Error(insErr.message);
        }}
        onAnySuccess={() => void load()}
        onBatchComplete={async (result) => {
          if (result.successful > 0 && po.deal_id) {
            const body =
              result.successful === 1
                ? `${po.po_number}: Skjali hlaðið upp`
                : `${po.po_number}: ${result.successful} skjölum hlaðið upp`;
            await supabase.from("activities").insert({
              deal_id: po.deal_id,
              type: "note",
              body,
              created_by: currentProfileId,
            });
          }
        }}
      />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", bold && "font-bold text-foreground")}>{value}</span>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="text-sm md:flex md:items-center md:justify-end md:gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <Input
        type="date"
        defaultValue={value ?? ""}
        key={`${label}-${value}`}
        onBlur={(e) => onChange(e.target.value || null)}
        className="h-8 w-auto"
      />
    </div>
  );
}

interface StepperProps {
  status: POStatus;
  onChange: (next: POStatus) => void;
  onCancel: () => void;
  onReactivate: () => void;
}

function PoStepper({ status, onChange, onCancel, onReactivate }: StepperProps) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center justify-between rounded-md border border-red-300 bg-red-100 p-4 text-red-800">
        <div className="font-semibold">{t.poStatus.cancelled}</div>
        <Button variant="outline" onClick={onReactivate} className="bg-white">
          {t.purchaseOrder.reactivatePO}
        </Button>
      </div>
    );
  }
  const idx = HAPPY_PATH_PO_STATUSES.indexOf(status);
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <ol className="flex flex-1 items-center">
          {HAPPY_PATH_PO_STATUSES.map((s, i) => {
            const completed = i < idx;
            const current = i === idx;
            const next = i === idx + 1;
            const future = i > idx;
            const sizeClass = current ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";
            const baseCircle =
              "relative flex items-center justify-center rounded-full font-semibold transition-all";
            let style: React.CSSProperties = {};
            if (completed) style = { backgroundColor: NAVY, color: "white" };
            else if (current)
              style = {
                backgroundColor: NAVY,
                color: "white",
                boxShadow: `0 0 0 2px white, 0 0 0 4px ${NAVY}`,
              };
            else if (future)
              style = { backgroundColor: "white", color: "#9ca3af", border: "1px solid #d1d5db" };
            const content = completed ? <Check className="h-4 w-4" /> : <span>{i + 1}</span>;

            const labelClass = current
              ? "text-xs font-bold"
              : "text-xs text-muted-foreground";
            const labelStyle = current ? { color: NAVY } : undefined;

            return (
              <li
                key={s}
                className={cn("flex flex-1 items-center", i === HAPPY_PATH_PO_STATUSES.length - 1 && "flex-none")}
              >
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    disabled={!next}
                    onClick={() => next && onChange(s)}
                    className={cn(baseCircle, sizeClass, next && "cursor-pointer hover:opacity-80")}
                    style={style}
                  >
                    {content}
                  </button>
                  <span className={labelClass} style={labelStyle}>{t.poStatus[s]}</span>
                </div>
                {i < HAPPY_PATH_PO_STATUSES.length - 1 && (
                  <div
                    className={cn("mx-2 -mt-6 h-0.5 flex-1", i >= idx && "border-t-2 border-dashed bg-transparent")}
                    style={i < idx ? { backgroundColor: NAVY } : { borderColor: "#d1d5db" }}
                  />
                )}
              </li>
            );
          })}
        </ol>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onCancel} className="text-red-600">
              {t.purchaseOrder.cancelPO}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function guessPoFileType(name: string): PoFileType {
  const n = name.toLowerCase();
  if (n.includes("proof")) return "proof";
  if (n.includes("confirmation") || n.includes("staðfesting") || n.includes("stadfesting"))
    return "order_confirmation";
  if (n.includes("invoice") || n.includes("reikningur")) return "invoice";
  if (n.includes("artwork") || n.includes("design") || n.includes("hönnun") || n.includes("honnun"))
    return "artwork";
  return "other";
}

function FileCard({
  file,
  typeLabel,
  onDeleted,
}: {
  file: PoFile;
  typeLabel: string;
  onDeleted: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const resolvePath = (): string | null => {
    if (file.storage_path) return file.storage_path;
    const url = file.file_url;
    if (!url) return null;
    const marker = "/po_files/";
    const idx = url.indexOf(marker);
    if (idx < 0) return null;
    return url.slice(idx + marker.length).split("?")[0];
  };

  const handleDelete = async () => {
    const path = resolvePath();
    if (path) {
      await supabase.storage.from("po_files").remove([path]);
    }
    await supabase.from("po_files").delete().eq("id", file.id);
    setConfirmDelete(false);
    onDeleted();
  };

  const viewHref = file.signedUrl ?? file.file_url ?? "#";
  const downloadHref = file.signedUrlDownload ?? file.file_url ?? "#";
  const signedUrlForThumb = file.signedUrl ?? file.file_url ?? null;

  return (
    <div className="group relative overflow-hidden rounded-md border border-border bg-card transition-colors hover:bg-muted/40">
      <a
        href={viewHref}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full text-left"
        title={file.original_filename ?? ""}
      >
        <FileThumbnail
          filename={file.original_filename}
          signedUrl={signedUrlForThumb}
          className="h-28"
        />
        <div className="space-y-1 p-3">
          <div
            className="truncate text-sm font-medium"
            title={file.original_filename ?? ""}
          >
            {file.original_filename ?? "—"}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
              {typeLabel}
            </span>
            <span className="text-muted-foreground">
              {formatFileSize(file.file_size_bytes)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {formatDate(file.uploaded_at)}
          </div>
        </div>
      </a>

      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <a
          href={downloadHref}
          download={file.original_filename ?? ""}
          onClick={(e) => e.stopPropagation()}
          className="rounded-md bg-background/90 p-1.5 text-muted-foreground shadow-sm hover:text-foreground"
          aria-label={t.actions.download}
        >
          <Download className="h-4 w-4" />
        </a>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setConfirmDelete(true);
          }}
          className="rounded-md bg-background/90 p-1.5 text-muted-foreground shadow-sm hover:text-red-600"
          aria-label={t.actions.delete}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.purchaseOrder.deleteFileConfirm}</AlertDialogTitle>
            <AlertDialogDescription>{t.status.cannotBeUndone}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.actions.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()} className="bg-red-600 text-white">
              {t.actions.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UploadFileDialog({
  open,
  onOpenChange,
  poId,
  poNumber,
  supplierName,
  currentProfileId,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  poId: string;
  poNumber: string;
  supplierName: string;
  currentProfileId: string;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<PoFileType>("other");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setType("other");
      setUploading(false);
      setDragOver(false);
    }
  }, [open]);

  const handleFile = (f: File | null) => {
    setFile(f);
    if (f) setType(guessPoFileType(f.name));
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const supplierSafe = pathSafe(supplierName || "unknown");
    const ts = Math.floor(Date.now() / 1000);
    const storagePath = `${supplierSafe}/${pathSafe(poNumber)}/${ts}-${pathSafe(file.name)}`;
    const { error: upErr } = await supabase.storage
      .from("po_files")
      .upload(storagePath, file, { upsert: false });
    if (upErr) {
      toast.error(t.status.somethingWentWrong);
      setUploading(false);
      return;
    }
    await supabase.from("po_files").insert({
      po_id: poId,
      storage_path: storagePath,
      file_url: null,
      file_type: type,
      original_filename: file.name,
      file_size_bytes: file.size,
      uploaded_by: currentProfileId,
    });
    setUploading(false);
    onOpenChange(false);
    onUploaded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.purchaseOrder.uploadFile}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0] ?? null;
              handleFile(f);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center text-sm transition-colors",
              dragOver ? "border-ide-navy bg-muted/40" : "border-border",
            )}
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <div className="text-muted-foreground">{t.purchaseOrder.dropHere}</div>
            {file && (
              <div className="font-medium text-foreground">
                {file.name}{" "}
                <span className="text-xs text-muted-foreground">
                  ({formatFileSize(file.size)})
                </span>
              </div>
            )}
            <Input
              type="file"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {file && (
            <div>
              <Label className="mb-2 block">{t.purchaseOrder.fileType}</Label>
              <RadioGroup
                value={type}
                onValueChange={(v) => setType(v as PoFileType)}
                className="grid grid-cols-2 gap-2"
              >
                {PO_FILE_TYPES.map((ft) => (
                  <label key={ft} className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value={ft} />
                    {poFileTypeLabel(t, ft)}
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t.actions.cancel}</Button>
          <Button
            onClick={() => void handleUpload()}
            disabled={!file || uploading}
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
          >
            {uploading ? t.status.saving : t.actions.upload}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditPoDrawer({
  open,
  onOpenChange,
  po,
  linkedDeal,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  po: PO;
  linkedDeal: { id: string; so_number: string; name: string } | null;
  onSaved: () => void;
}) {
  const [supplierId, setSupplierId] = useState(po.supplier_id ?? "");
  const [supplierRef, setSupplierRef] = useState(po.supplier_reference ?? "");
  const [dealId, setDealId] = useState(po.deal_id ?? "");
  const [notes, setNotes] = useState(po.notes ?? "");
  const [orderDate, setOrderDate] = useState(po.order_date ?? "");
  const [expectedDate, setExpectedDate] = useState(po.expected_delivery_date ?? "");
  const [receivedDate, setReceivedDate] = useState(po.received_date ?? "");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [deals, setDeals] = useState<Array<{ id: string; so_number: string; name: string }>>([]);
  const [dealComboOpen, setDealComboOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSupplierId(po.supplier_id ?? "");
    setSupplierRef(po.supplier_reference ?? "");
    setDealId(po.deal_id ?? "");
    setNotes(po.notes ?? "");
    setOrderDate(po.order_date ?? "");
    setExpectedDate(po.expected_delivery_date ?? "");
    setReceivedDate(po.received_date ?? "");
    void (async () => {
      const [sRes, dRes] = await Promise.all([
        supabase.from("suppliers").select("*").eq("active", true).order("name"),
        supabase.from("deals").select("id, so_number, name").eq("archived", false).order("created_at", { ascending: false }).limit(500),
      ]);
      setSuppliers((sRes.data ?? []) as Supplier[]);
      setDeals((dRes.data ?? []) as Array<{ id: string; so_number: string; name: string }>);
    })();
  }, [open, po]);

  const handleSave = async () => {
    setSaving(true);
    const supplierName = suppliers.find((s) => s.id === supplierId)?.name ?? po.supplier;
    const { error } = await supabase
      .from("purchase_orders")
      .update({
        supplier_id: supplierId || null,
        supplier: supplierName,
        supplier_reference: supplierRef.trim() || null,
        deal_id: dealId || null,
        notes: notes.trim() || null,
        order_date: orderDate || null,
        expected_delivery_date: expectedDate || null,
        received_date: receivedDate || null,
      })
      .eq("id", po.id);
    setSaving(false);
    if (error) {
      toast.error(t.status.somethingWentWrong);
      return;
    }
    toast.success(t.status.savedSuccessfully);
    onOpenChange(false);
    onSaved();
  };

  const selectedDeal = deals.find((d) => d.id === dealId) ?? linkedDeal;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>{t.actions.edit}</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 py-4">
          <div>
            <Label>{t.purchaseOrder.supplier}</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t.purchaseOrder.supplier_reference}</Label>
            <Input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} />
          </div>
          <div>
            <Label>{t.purchaseOrder.linked_deal}</Label>
            <Popover open={dealComboOpen} onOpenChange={setDealComboOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  {selectedDeal ? `${selectedDeal.so_number} — ${selectedDeal.name}` : t.purchaseOrder.selectDeal}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0">
                <Command>
                  <CommandInput placeholder={t.actions.search} />
                  <CommandList>
                    <CommandEmpty>{t.status.noResults}</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="__none__" onSelect={() => { setDealId(""); setDealComboOpen(false); }}>
                        — {t.purchaseOrder.noDeal}
                      </CommandItem>
                      {deals.map((d) => (
                        <CommandItem
                          key={d.id}
                          value={`${d.so_number} ${d.name}`}
                          onSelect={() => { setDealId(d.id); setDealComboOpen(false); }}
                        >
                          <span className="font-mono text-xs text-muted-foreground mr-2">{d.so_number}</span>
                          {d.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>{t.purchaseOrder.order_date}</Label>
              <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </div>
            <div>
              <Label>{t.purchaseOrder.expected_delivery_date}</Label>
              <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
            <div>
              <Label>{t.purchaseOrder.received_date}</Label>
              <Input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>{t.purchaseOrder.notes}</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <SheetFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>{t.actions.cancel}</Button>
          <Button onClick={() => void handleSave()} disabled={saving} className="bg-ide-navy text-white hover:bg-ide-navy-hover">
            {saving ? t.status.saving : t.actions.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
