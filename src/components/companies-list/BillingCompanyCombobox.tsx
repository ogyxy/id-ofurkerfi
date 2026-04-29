import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/sala_translations_is";
import { Input } from "@/components/ui/input";

type Option = { id: string; name: string };

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  /** Exclude self when editing an existing company */
  excludeId?: string;
  placeholder?: string;
}

export function BillingCompanyCombobox({ value, onChange, excludeId, placeholder }: Props) {
  const [options, setOptions] = useState<Option[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .eq("archived", false)
        .order("name");
      if (!cancelled) setOptions((data ?? []) as Option[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return options
      .filter((o) => o.id !== excludeId)
      .filter((o) => (q ? o.name.toLowerCase().includes(q) : true))
      .slice(0, 50);
  }, [options, search, excludeId]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
        <span className="truncate text-sm font-medium">{selected.name}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="clear"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <Input
        placeholder={placeholder ?? t.newCompany.billedViaSearch}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">{t.status.noResults}</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id);
                  setSearch("");
                  setOpen(false);
                }}
                className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-muted"
              >
                {o.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
