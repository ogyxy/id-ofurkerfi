import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { t } from "@/lib/sala_translations_is";

interface Props {
  label: string;
  onAdd: () => void;
}

export function EmptyState({ label, onAdd }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-border p-12 text-center">
      <p className="text-sm text-muted-foreground">{t.status.noDataYet}</p>
      <Button onClick={onAdd} className="bg-ide-navy text-white hover:bg-ide-navy-hover">
        <Plus className="mr-1 h-4 w-4" />
        {t.actions.add} {label}
      </Button>
    </div>
  );
}
