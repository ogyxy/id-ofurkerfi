// Shared helpers for the /yfirlit Pace section.

export function getQuarterRange(d: Date): { start: Date; end: Date; q: 1 | 2 | 3 | 4; year: number } {
  const q = (Math.floor(d.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  const start = new Date(d.getFullYear(), (q - 1) * 3, 1);
  const end = new Date(d.getFullYear(), q * 3, 0);
  return { start, end, q, year: d.getFullYear() };
}

export function getYearRange(d: Date): { start: Date; end: Date } {
  return { start: new Date(d.getFullYear(), 0, 1), end: new Date(d.getFullYear(), 11, 31) };
}

export function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export type PaceState = "ahead" | "ontrack" | "behind";

export function computePaceState(achieved: number, target: number, expectedPct: number): PaceState {
  if (target <= 0) return "ontrack";
  const fillPct = achieved / target;
  if (fillPct >= expectedPct) return "ahead";
  if (fillPct >= expectedPct - 0.1) return "ontrack";
  return "behind";
}

export function paceColor(state: PaceState): string {
  if (state === "ahead") return "#16a34a";
  if (state === "ontrack") return "#9ca3af";
  return "#f59e0b";
}

export function paceColorRed(state: PaceState, achieved: number, target: number, expectedPct: number): string {
  if (state === "behind" && target > 0 && achieved / target < expectedPct - 0.2) return "#dc2626";
  return paceColor(state);
}

export function formatIcelandicDate(d: Date, weekdays: readonly string[], months: readonly string[]): string {
  return `${weekdays[d.getDay()]}, ${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
}
