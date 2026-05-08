import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { t, formatIsk } from "@/lib/sala_translations_is";
import { filterVisibleProfiles } from "@/lib/hiddenUsers";

interface ProfileRow {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface TargetRow {
  id: string;
  owner_id: string;
  period_type: "quarter" | "year";
  period_start: string;
  period_end: string;
  target_isk: number;
}

type Edits = Record<string, { q1: string; q2: string; q3: string; q4: string; year: string }>;

const YEAR_OPTIONS = (() => {
  const now = new Date().getFullYear();
  return [now - 1, now, now + 1];
})();

function quarterRange(year: number, q: 1 | 2 | 3 | 4) {
  const startMonth = (q - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}
function yearRange(year: number) {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}
function parseNum(s: string): number {
  const cleaned = s.replace(/[^0-9-]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
function fmt(n: number): string {
  if (!n) return "";
  return formatIsk(n).replace(" kr.", "");
}

export function TargetsTab() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [edits, setEdits] = useState<Edits>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: profs }, { data: targets }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, name, email, role")
          .eq("active", true)
          .in("role", ["admin", "sales"])
          .order("name"),
        supabase
          .from("sales_targets")
          .select("id, owner_id, period_type, period_start, period_end, target_isk")
          .gte("period_start", `${year}-01-01`)
          .lte("period_start", `${year}-12-31`),
      ]);

      const ps = filterVisibleProfiles((profs ?? []) as ProfileRow[]);
      setProfiles(ps);

      const e: Edits = {};
      ps.forEach((p) => {
        e[p.id] = { q1: "", q2: "", q3: "", q4: "", year: "" };
      });
      ((targets ?? []) as TargetRow[]).forEach((t) => {
        if (!e[t.owner_id]) return;
        if (t.period_type === "year") {
          e[t.owner_id].year = fmt(t.target_isk);
        } else {
          const m = Number(t.period_start.slice(5, 7));
          const q = Math.floor((m - 1) / 3) + 1;
          e[t.owner_id][`q${q}` as "q1" | "q2" | "q3" | "q4"] = fmt(t.target_isk);
        }
      });
      setEdits(e);
      setLoading(false);
    })();
  }, [year]);

  const sums = useMemo(() => {
    const s: Record<string, { quarters: number; year: number; mismatch: boolean }> = {};
    for (const p of profiles) {
      const e = edits[p.id];
      if (!e) continue;
      const q = parseNum(e.q1) + parseNum(e.q2) + parseNum(e.q3) + parseNum(e.q4);
      const y = parseNum(e.year);
      s[p.id] = { quarters: q, year: y, mismatch: y > 0 && Math.abs(q - y) > 1 };
    }
    return s;
  }, [edits, profiles]);

  const updateField = (
    ownerId: string,
    field: "q1" | "q2" | "q3" | "q4" | "year",
    value: string,
  ) => {
    setEdits((prev) => ({ ...prev, [ownerId]: { ...prev[ownerId], [field]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const rows: Array<{
        owner_id: string;
        period_type: "quarter" | "year";
        period_start: string;
        period_end: string;
        target_isk: number;
      }> = [];
      for (const p of profiles) {
        const e = edits[p.id];
        if (!e) continue;
        for (const q of [1, 2, 3, 4] as const) {
          const v = parseNum(e[`q${q}`]);
          if (v > 0) {
            const r = quarterRange(year, q);
            rows.push({
              owner_id: p.id,
              period_type: "quarter",
              period_start: r.start,
              period_end: r.end,
              target_isk: v,
            });
          }
        }
        const y = parseNum(e.year);
        if (y > 0) {
          const r = yearRange(year);
          rows.push({
            owner_id: p.id,
            period_type: "year",
            period_start: r.start,
            period_end: r.end,
            target_isk: y,
          });
        }
      }
      if (rows.length > 0) {
        const { error } = await supabase
          .from("sales_targets")
          .upsert(rows, { onConflict: "owner_id,period_type,period_start" });
        if (error) throw error;
      }
      toast.success(t.settings.targets.savedToast);
    } catch (err: any) {
      toast.error(t.settings.targets.saveError + (err?.message ? `: ${err.message}` : ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <Label>{t.settings.targets.yearLabel}</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="max-w-md text-xs text-muted-foreground">
          {t.settings.targets.helper}
        </p>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">{t.settings.targets.nameCol}</th>
              <th className="px-3 py-2 text-right">{t.settings.targets.q1}</th>
              <th className="px-3 py-2 text-right">{t.settings.targets.q2}</th>
              <th className="px-3 py-2 text-right">{t.settings.targets.q3}</th>
              <th className="px-3 py-2 text-right">{t.settings.targets.q4}</th>
              <th className="px-3 py-2 text-right">{t.settings.targets.yearTarget}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  ...
                </td>
              </tr>
            ) : (
              profiles.map((p) => {
                const e = edits[p.id] ?? { q1: "", q2: "", q3: "", q4: "", year: "" };
                const s = sums[p.id];
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-foreground">{p.name || p.email}</div>
                      <div className="text-xs text-muted-foreground">{p.email}</div>
                    </td>
                    {(["q1", "q2", "q3", "q4"] as const).map((q) => (
                      <td key={q} className="px-2 py-2">
                        <Input
                          value={e[q]}
                          onChange={(ev) => updateField(p.id, q, ev.target.value)}
                          className="text-right tabular-nums"
                          inputMode="numeric"
                          placeholder="0"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2">
                      <Input
                        value={e.year}
                        onChange={(ev) => updateField(p.id, "year", ev.target.value)}
                        className="text-right tabular-nums"
                        inputMode="numeric"
                        placeholder="0"
                      />
                      {s?.mismatch && (
                        <p className="mt-1 text-[11px] text-amber-600">
                          {t.settings.targets.mismatchWarning}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || loading}
          className="bg-ide-navy text-white hover:bg-ide-navy-hover"
        >
          {saving ? t.settings.targets.saving : t.settings.targets.saveButton}
        </Button>
      </div>
    </div>
  );
}
