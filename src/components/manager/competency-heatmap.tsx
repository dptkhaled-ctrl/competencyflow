"use client";

import { cn } from "@/lib/utils";
import type { DomainCoverage } from "@/lib/types";

function masteryColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-500";
  if (pct >= 60) return "bg-amber-400";
  if (pct > 0) return "bg-orange-500";
  return "bg-slate-200";
}

export function CompetencyHeatmap({ coverage }: { coverage: DomainCoverage[] }) {
  if (coverage.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Upload training material to see competency coverage.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {coverage.map((d) => (
        <div key={d.domainId} className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{d.domainName}</span>
            <span className="text-xs text-muted-foreground">
              {d.avgMastery}% avg · {d.staffAssessed}/{d.totalStaff} assessed
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn("h-full rounded-full transition-all", masteryColor(d.avgMastery))}
              style={{ width: `${Math.max(d.avgMastery, d.coveragePercent > 0 ? 8 : 0)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}