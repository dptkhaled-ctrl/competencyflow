"use client";

import { Sparkles, TrendingUp } from "lucide-react";
import type { TutorCard } from "@/lib/types";

export function ProgressChip({ card }: { card: TutorCard }) {
  const before = card.masteryBefore ?? 0;
  const after = card.masteryAfter ?? before;
  const delta = after - before;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-orange-200/60 bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-white">
        {delta > 0 ? <TrendingUp className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      </div>
      <div>
        <p className="text-xs font-semibold text-orange-700">
          {card.domainName ?? "Competency"} updated
        </p>
        <p className="text-sm text-slate-700">
          {before}% → <strong>{after}%</strong>
          {card.xpEarned ? (
            <span className="ml-2 text-orange-600">+{card.xpEarned} XP</span>
          ) : null}
        </p>
      </div>
    </div>
  );
}