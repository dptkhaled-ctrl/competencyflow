"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface DomainItem {
  domainId: string;
  domainName: string;
  masteryPercent: number;
  assessmentCount: number;
}

const BAR_COLORS = [
  "[&>div]:bg-indigo-500",
  "[&>div]:bg-violet-500",
  "[&>div]:bg-emerald-500",
  "[&>div]:bg-amber-500",
  "[&>div]:bg-rose-500",
  "[&>div]:bg-cyan-500",
];

export function DomainProgressList({ domains }: { domains: DomainItem[] }) {
  if (domains.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No competency data yet. Start learning to build your profile.
      </p>
    );
  }

  const sorted = [...domains].sort(
    (a, b) => b.masteryPercent - a.masteryPercent
  );

  return (
    <div className="space-y-3">
      {sorted.map((d, i) => (
        <div key={d.domainId} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium truncate">{d.domainName}</span>
            <span
              className={cn(
                "text-xs font-bold tabular-nums",
                d.masteryPercent >= 70
                  ? "text-emerald-600"
                  : d.masteryPercent >= 50
                    ? "text-amber-600"
                    : "text-rose-600"
              )}
            >
              {d.masteryPercent}%
            </span>
          </div>
          <Progress
            value={d.masteryPercent}
            className={cn("h-2", BAR_COLORS[i % BAR_COLORS.length])}
          />
          <p className="text-[10px] text-muted-foreground">
            {d.assessmentCount} assessment{d.assessmentCount !== 1 ? "s" : ""}
          </p>
        </div>
      ))}
    </div>
  );
}