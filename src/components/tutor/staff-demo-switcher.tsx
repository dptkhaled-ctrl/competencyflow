"use client";

import { Building2, HeartPulse, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store/app-store";
import { useCurrentUser } from "@/lib/store/hooks";

const DEMO_STAFF = [
  {
    userId: "user-snf-1",
    label: "SNF staff",
    sublabel: "Sam · Sunrise Skilled Nursing",
    icon: Building2,
  },
  {
    userId: "user-bh-1",
    label: "Behavioral health",
    sublabel: "Chris · Horizon BH",
    icon: HeartPulse,
  },
  {
    userId: "user-hh-1",
    label: "Home health",
    sublabel: "Jamie · Compassion HH",
    icon: Home,
  },
];

export function StaffDemoSwitcher() {
  const user = useCurrentUser();
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);

  if (user.role !== "staff") return null;

  return (
    <div className="mb-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-2">
      <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Switch test profile
      </p>
      <div className="grid grid-cols-3 gap-2">
        {DEMO_STAFF.map((demo) => {
          const active = user.id === demo.userId;
          const Icon = demo.icon;
          return (
            <button
              key={demo.userId}
              type="button"
              onClick={() => setCurrentUser(demo.userId)}
              className={cn(
                "flex items-start gap-2 rounded-xl border px-2 py-2 text-left transition-all",
                active
                  ? "border-indigo-400 bg-white shadow-sm ring-1 ring-indigo-200"
                  : "border-transparent bg-white/60 hover:bg-white hover:shadow-sm"
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  active ? "text-indigo-600" : "text-slate-400"
                )}
              />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-800">{demo.label}</p>
                <p className="truncate text-[9px] text-slate-500">{demo.sublabel}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}