import { cn } from "@/lib/utils";

interface Props {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
  title?: string;
}

function computeInitials(name?: string | null, email?: string | null): string {
  const src = (name && name.trim()) || email || "";
  if (!src) return "?";
  const parts = src.split(/[\s@.]+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function UserAvatar({
  name,
  email,
  avatarUrl,
  size = 28,
  className,
  title,
}: Props) {
  const initials = computeInitials(name, email);
  const tooltip = title ?? name ?? email ?? undefined;
  const fontSize = size <= 24 ? 10 : size <= 32 ? 11 : 13;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={tooltip ?? ""}
        title={tooltip}
        className={cn("flex-shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      title={tooltip}
      className={cn(
        "inline-flex flex-shrink-0 items-center justify-center rounded-full bg-ide-navy font-medium text-white",
        className,
      )}
      style={{ width: size, height: size, fontSize }}
    >
      {initials}
    </span>
  );
}
