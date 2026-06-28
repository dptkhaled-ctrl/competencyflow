import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface GradientStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  gradient: "indigo" | "violet" | "emerald" | "amber" | "rose" | "cyan";
}

const GRADIENTS = {
  indigo: "from-indigo-500/20 via-indigo-400/10 to-transparent border-indigo-200/60 text-indigo-700",
  violet: "from-violet-500/20 via-violet-400/10 to-transparent border-violet-200/60 text-violet-700",
  emerald: "from-emerald-500/20 via-emerald-400/10 to-transparent border-emerald-200/60 text-emerald-700",
  amber: "from-amber-500/20 via-amber-400/10 to-transparent border-amber-200/60 text-amber-700",
  rose: "from-rose-500/20 via-rose-400/10 to-transparent border-rose-200/60 text-rose-700",
  cyan: "from-cyan-500/20 via-cyan-400/10 to-transparent border-cyan-200/60 text-cyan-700",
};

const ICON_BG = {
  indigo: "bg-indigo-500 text-white",
  violet: "bg-violet-500 text-white",
  emerald: "bg-emerald-500 text-white",
  amber: "bg-amber-500 text-white",
  rose: "bg-rose-500 text-white",
  cyan: "bg-cyan-500 text-white",
};

export function GradientStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
}: GradientStatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-gradient-to-br p-4 shadow-sm",
        GRADIENTS[gradient]
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">
            {title}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && (
            <p className="mt-0.5 text-xs opacity-70">{subtitle}</p>
          )}
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm",
            ICON_BG[gradient]
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}