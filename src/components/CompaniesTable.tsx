import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { t, formatIsk } from "@/lib/sala_translations_is";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CompanyRow = {
  id: string;
  name: string;
};

type DealRow = {
  company_id: string;
  stage: string;
  amount_isk: number | null;
  archived: boolean;
};

type CompanyWithStats = CompanyRow & {
  dealsInProgress: number;
  totalInProgressIsk: number;
  dealsDelivered: number;
  totalDeliveredIsk: number;
};

type SortKey =
  | "name"
  | "dealsInProgress"
  | "totalInProgressIsk"
  | "dealsDelivered"
  | "totalDeliveredIsk";
type SortDir = "asc" | "desc";

export function CompaniesTable() {
  const [rows, setRows] = useState<CompanyWithStats[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [companiesRes, dealsRes] = await Promise.all([
        supabase
          .from("companies")
          .select("id, name")
          .eq("archived", false)
          .order("name", { ascending: true }),
        supabase
          .from("deals")
          .select("company_id, stage, amount_isk, archived")
          .eq("archived", false),
      ]);

      if (cancelled) return;

      if (companiesRes.error || dealsRes.error) {
        setLoadError(t.status.somethingWentWrong);
        setLoading(false);
        return;
      }

      const companies = (companiesRes.data ?? []) as CompanyRow[];
      const deals = (dealsRes.data ?? []) as DealRow[];

      const statsByCompany = new Map<
        string,
        {
          dealsInProgress: number;
          totalInProgressIsk: number;
          dealsDelivered: number;
          totalDeliveredIsk: number;
        }
      >();

      for (const deal of deals) {
        if (!deal.company_id) continue;
        const stats = statsByCompany.get(deal.company_id) ?? {
          dealsInProgress: 0,
          totalInProgressIsk: 0,
          dealsDelivered: 0,
          totalDeliveredIsk: 0,
        };
        const amount = Number(deal.amount_isk ?? 0);
        if (deal.stage === "delivered") {
          stats.dealsDelivered += 1;
          stats.totalDeliveredIsk += amount;
        } else if (deal.stage !== "cancelled") {
          stats.dealsInProgress += 1;
          stats.totalInProgressIsk += amount;
        }
        statsByCompany.set(deal.company_id, stats);
      }

      const merged: CompanyWithStats[] = companies.map((c) => {
        const stats = statsByCompany.get(c.id) ?? {
          dealsInProgress: 0,
          totalInProgressIsk: 0,
          dealsDelivered: 0,
          totalDeliveredIsk: 0,
        };
        return { ...c, ...stats };
      });

      setRows(merged);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("is");
    if (!q) return rows;
    return rows.filter((c) => c.name.toLocaleLowerCase("is").includes(q));
  }, [rows, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      if (sortKey === "name") {
        return a.name.localeCompare(b.name, "is") * dir;
      }
      return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totals = useMemo(() => {
    return sorted.reduce(
      (acc, c) => {
        acc.dealsInProgress += c.dealsInProgress;
        acc.totalInProgressIsk += c.totalInProgressIsk;
        acc.dealsDelivered += c.dealsDelivered;
        acc.totalDeliveredIsk += c.totalDeliveredIsk;
        return acc;
      },
      {
        dealsInProgress: 0,
        totalInProgressIsk: 0,
        dealsDelivered: 0,
        totalDeliveredIsk: 0,
      },
    );
  }, [sorted]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) {
      return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 opacity-40" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 inline h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="ml-1 inline h-3.5 w-3.5" />
    );
  };

  const sortableHead = (
    label: string,
    key: SortKey,
    align: "left" | "right" = "left",
  ) => (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => handleSort(key)}
        className={cn(
          "inline-flex items-center gap-0.5 font-medium hover:text-foreground transition-colors",
          align === "right" && "ml-auto",
        )}
      >
        {label}
        <SortIcon column={key} />
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      <Input
        type="search"
        placeholder={t.actions.search}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Desktop / tablet table */}
      <div className="hidden rounded-md border border-border bg-card md:block">
        <div className="max-h-[calc(100vh-16rem)] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
              <TableRow>
                {sortableHead(t.company.name, "name", "left")}
                {sortableHead("Sölur í vinnslu", "dealsInProgress", "right")}
                {sortableHead("Upphæð í vinnslu", "totalInProgressIsk", "right")}
                {sortableHead("Sölur afhentar", "dealsDelivered", "right")}
                {sortableHead("Samtals sala", "totalDeliveredIsk", "right")}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    {t.status.loading}
                  </TableCell>
                </TableRow>
              ) : loadError ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-sm text-destructive"
                  >
                    {loadError}
                  </TableCell>
                </TableRow>
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    {t.status.noResults}
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((company) => (
                  <TableRow
                    key={company.id}
                    onClick={() =>
                      navigate({ to: "/companies/$id", params: { id: company.id } })
                    }
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {company.dealsInProgress}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatIsk(company.totalInProgressIsk)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {company.dealsDelivered}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatIsk(company.totalDeliveredIsk)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {!loading && !loadError && sorted.length > 0 && (
              <TableFooter className="sticky bottom-0 z-10 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
                <TableRow className="hover:bg-muted/95">
                  <TableCell className="font-semibold">
                    {"Samtals"} ({sorted.length})
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {totals.dealsInProgress}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatIsk(totals.totalInProgressIsk)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {totals.dealsDelivered}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatIsk(totals.totalDeliveredIsk)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </div>

      {/* Mobile list */}
      <div className="md:hidden">
        {loading ? (
          <div className="rounded-md border border-border bg-card py-10 text-center text-sm text-muted-foreground">
            {t.status.loading}
          </div>
        ) : loadError ? (
          <div className="rounded-md border border-border bg-card py-10 text-center text-sm text-destructive">
            {loadError}
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-md border border-border bg-card py-10 text-center text-sm text-muted-foreground">
            {t.status.noResults}
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
              {sorted.map((company) => (
                <li key={company.id}>
                  <button
                    type="button"
                    onClick={() =>
                      navigate({ to: "/companies/$id", params: { id: company.id } })
                    }
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50"
                  >
                    <span className="font-medium">{company.name}</span>
                    <span className="text-muted-foreground" aria-hidden>
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="sticky bottom-0 mt-2 rounded-md border border-border bg-muted/95 px-4 py-3 text-sm font-semibold backdrop-blur">
              {"Samtals"}: {sorted.length}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
