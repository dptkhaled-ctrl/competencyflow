"use client";

import { Star, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useUserXp } from "@/lib/store/hooks";
import { xpProgressInLevel } from "@/lib/gamification/xp";

export function XpBar() {
  const xp = useUserXp();
  const { level, current, needed, percent } = xpProgressInLevel(xp.totalXp);
  const dailyPercent = Math.min(
    100,
    Math.round((xp.dailyXp / xp.dailyGoal) * 100)
  );

  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/10 via-background to-amber-500/5 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg shadow-md">
            {level}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Level {level}
            </p>
            <p className="text-sm font-semibold flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              {xp.totalXp} XP
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-primary mt-0.5">
            Daily goal: {xp.dailyXp}/{xp.dailyGoal} XP
          </p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Level progress</span>
            <span>
              {current}/{needed} XP
            </span>
          </div>
          <Progress value={percent} className="h-2.5" />
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 text-amber-500" />
              Today&apos;s goal
            </span>
            <span>{dailyPercent}%</span>
          </div>
          <Progress value={dailyPercent} className="h-2 bg-amber-100 [&>div]:bg-amber-500" />
        </div>
      </div>
    </div>
  );
}