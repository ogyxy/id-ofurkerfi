import { Link } from "@tanstack/react-router";
import { CornerDownLeft } from "lucide-react";
import { t } from "@/lib/sala_translations_is";

interface Props {
  parentDeal: {
    id: string;
    so_number: string;
    name: string;
  };
}

export function ParentDealBanner({ parentDeal }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
      <CornerDownLeft className="h-4 w-4 flex-shrink-0" />
      <span>
        {t.deal.parent_deal}:{" "}
        <span className="font-medium text-foreground">
          {parentDeal.so_number}
        </span>{" "}
        — {parentDeal.name}
      </span>
      <Link
        to="/deals/$id"
        params={{ id: parentDeal.id }}
        className="ml-auto inline-flex items-center gap-1 font-medium text-foreground hover:underline"
      >
        → {t.actions.open.toLowerCase()}
      </Link>
    </div>
  );
}
