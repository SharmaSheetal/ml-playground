import { clsx } from "clsx";

const COLOR_MAP = {
  slate: "bg-slate-700/50 text-slate-400",
  emerald: "bg-emerald-500/10 text-emerald-400",
  blue: "bg-blue-500/10 text-blue-400",
  purple: "bg-purple-500/10 text-purple-400",
  amber: "bg-amber-500/10 text-amber-400",
  red: "bg-red-500/10 text-red-400",
  indigo: "bg-indigo-500/10 text-indigo-400",
} as const;

type BadgeColor = keyof typeof COLOR_MAP;

interface BadgeProps {
  color?: BadgeColor;
  children: React.ReactNode;
}

export function Badge({ color = "slate", children }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap",
        COLOR_MAP[color]
      )}
    >
      {children}
    </span>
  );
}
