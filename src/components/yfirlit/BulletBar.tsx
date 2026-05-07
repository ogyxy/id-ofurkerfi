import { paceColor, type PaceState } from "./paceHelpers";

interface Props {
  achieved: number;
  target: number;
  expectedPct: number; // 0..1 elapsed of period
  state: PaceState;
  height?: "sm" | "md";
}

export function BulletBar({ achieved, target, expectedPct, state, height = "md" }: Props) {
  const fillPct = target > 0 ? Math.min((achieved / target) * 100, 130) : 0;
  const tickPct = Math.min(Math.max(expectedPct * 100, 0), 100);
  const h = height === "md" ? "h-3" : "h-1.5";
  return (
    <div className={`relative w-full ${h} rounded-full bg-muted overflow-visible`}>
      <div
        className={`absolute left-0 top-0 ${h} rounded-full transition-[width] duration-300 ease-out`}
        style={{ width: `${Math.min(fillPct, 100)}%`, background: paceColor(state) }}
      />
      {target > 0 && (
        <div
          className="absolute top-[-2px] bottom-[-2px] w-px bg-foreground/70"
          style={{ left: `${tickPct}%` }}
        />
      )}
    </div>
  );
}
