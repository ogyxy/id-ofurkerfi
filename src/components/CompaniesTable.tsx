import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { t, formatIsk } from "@/lib/sala_translations_is";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
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

export function CompaniesTable() {
  const [rows, setRows] = useState<CompanyWithStats[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
      <div className="hidden overflow-x-auto rounded-md border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.company.name}</TableHead>
              <TableHead className="text-right">Sölur í vinnslu</TableHead>
              <TableHead className="text-right">Upphæð í vinnslu</TableHead>
              <TableHead className="text-right">Sölur afhentar</TableHead>
              <TableHead className="text-right">Samtals sala</TableHead>
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
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {t.status.noResults}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((company) => (
                <TableRow
                  key={company.id}
                  onClick={() => navigate({ to: "/companies/$id", params: { id: company.id } })}
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
        </Table>
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
        ) : filtered.length === 0 ? (
          <div className="rounded-md border border-border bg-card py-10 text-center text-sm text-muted-foreground">
            {t.status.noResults}
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
            {filtered.map((company) => (
              <li key={company.id}>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/companies/$id", params: { id: company.id } })}
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
        )}
      </div>
    </div>
  );
}
