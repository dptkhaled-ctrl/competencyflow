"use client";

import { Target } from "lucide-react";
import { useAppStore } from "@/lib/store/app-store";
import { useCurrentOrg, useCurrentUser, useUserXp } from "@/lib/store/hooks";
// old seed removed


interface TutorTopBarProps {
  avgMastery: number;
}

export function TutorTopBar({ avgMastery }: TutorTopBarProps) {
  const user = useCurrentUser();
  const xp = useUserXp();
  // Streaks deprioritized/removed from UI for v0.1
  const org = useCurrentOrg();
  const label = "Training";

  const circumference = 2 * Math.PI * 18;
  const offset = circumference - ((avgMastery || 0) / 100) * circumference;

  return (
    <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-indigo-100/80 bg-white/80 px-4 py-3 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-indigo-500">
            {org?.name}
          </p>
          <p className="text-sm font-semibold text-slate-800">
            Hi, {user.name.split(" ")[0]}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex h-11 w-11 items-center justify-center">
            <svg className="h-11 w-11 -rotate-90" viewBox="0 0 44 44">
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-indigo-100"
              />
              <circle
                cx="22"
                cy="22"
                r="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="text-indigo-600 transition-all duration-700"
              />
            </svg>
            <span className="absolute text-[10px] font-bold text-indigo-700">
              {avgMastery}%
            </span>
          </div>
        </div>
      </div>
      <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
        <Target className="h-3 w-3" />
        {label} · Level {xp.level} · {xp.dailyXp}/{xp.dailyGoal} XP today
      </div>
    </div>
  );
}