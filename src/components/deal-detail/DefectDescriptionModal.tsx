import { useEffect, useState } from "react";
import { t } from "@/lib/sala_translations_is";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (description: string) => Promise<void> | void;
  busy?: boolean;
}

export function DefectDescriptionModal({
  open,
  onOpenChange,
  onConfirm,
  busy = false,
}: Props) {
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) setDescription("");
  }, [open]);

  const trimmed = description.trim();
  const canConfirm = trimmed.length > 0 && !busy;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.deal.defectModal.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Textarea
            autoFocus
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.deal.defectModal.placeholder}
          />
          {!trimmed && (
            <p className="text-xs text-muted-foreground">
              {t.deal.defectModal.required}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {t.deal.defectModal.cancel}
          </Button>
          <Button
            onClick={() => canConfirm && onConfirm(trimmed)}
            disabled={!canConfirm}
            className="bg-ide-navy text-white hover:bg-ide-navy-hover"
          >
            {t.deal.defectModal.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
