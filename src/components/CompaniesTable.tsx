import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { t, formatDate } from "@/lib/sala_translations_is";
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
  kennitala: string | null;
  city: string | null;
  vsk_status: keyof typeof t.vskStatus;
  created_at: string;
};

export function CompaniesTable() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, kennitala, city, vsk_status, created_at")
        .eq("archived", false)
        .order("name", { ascending: true });

      if (cancelled) return;

      if (error) {
        setLoadError(t.status.somethingWentWrong);
        setLoading(false);
        return;
      }
      setCompanies((data ?? []) as CompanyRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("is");
    if (!q) return companies;
    return companies.filter((c) =>
      c.name.toLocaleLowerCase("is").includes(q),
    );
  }, [companies, search]);

  return (
    <div className="space-y-4">
      <Input
        type="search"
        placeholder={t.actions.search}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.company.name}</TableHead>
              <TableHead>{t.company.kennitala}</TableHead>
              <TableHead>{t.company.city}</TableHead>
              <TableHead>{t.company.vsk_status}</TableHead>
              <TableHead>{t.company.created_at}</TableHead>
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
                  onClick={() => console.log(company.id)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>{company.kennitala ?? ""}</TableCell>
                  <TableCell>{company.city ?? ""}</TableCell>
                  <TableCell>{t.vskStatus[company.vsk_status]}</TableCell>
                  <TableCell>{formatDate(company.created_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
