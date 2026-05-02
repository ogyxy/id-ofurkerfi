import * as React from "react";
import { cn } from "@/lib/utils";

export type PillTone =
  | "neutral"
  | "danger"
  | "warning"
  | "success"
  | "purple"
  | "info";

const TONE_CLASSES: Record<PillTone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  danger: "bg-red-100 text-red-800 border-red-200",
  warning: "bg-amber-100 text-amber-900 border-amber-200",
  success: "bg-green-100 text-green-800 border-green-200",
  purple: "bg-purple-100 text-purple-800 border-purple-200",
  info: "bg-blue-100 text-blue-800 border-blue-200",
};

interface LabeledPillProps {
  label?: string;
  value: React.ReactNode;
  tone?: PillTone;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * Unified pill used across the deal detail page (header + Innkaup PO rows).
 * Rounded-full, small (~11–12px), uppercase muted label prefix + value.
 */
export function LabeledPill({
  label,
  value,
  tone = "neutral",
  icon,
  className,
}: LabeledPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px]",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {icon}
      {label && (
        <span className="text-[10px] uppercase tracking-wide opacity-70">
          {label}:
        </span>
      )}
      <span className="tabular-nums font-medium">{value}</span>
    </span>
  );
}
