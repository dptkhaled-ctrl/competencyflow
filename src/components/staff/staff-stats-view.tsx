"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  GraduationCap,
  XCircle,
} from "lucide-react";
import { StaffDemoSwitcher } from "@/components/tutor/staff-demo-switcher";
import { DomainProgressList } from "@/components/staff/domain-progress-list";
import { GradientStatCard } from "@/components/staff/gradient-stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getUserAvgMastery } from "@/lib/competency/mastery";
import { useAppStore } from "@/lib/store/app-store";
import { useCurrentOrg, useCurrentUser } from "@/lib/store/hooks";

export function StaffStatsView() {
  const user = useCurrentUser();
  const org = useCurrentOrg();
  const competencyDomains = useAppStore((s) => s.competencyDomains);
  const competencyRecords = useAppStore((s) => s.competencyRecords);
  const assessmentEvents = useAppStore((s) => s.assessmentEvents);

  const isHealthcare = true;
  const userEvents = assessmentEvents
    .filter((e) => e.userId === user.id)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const correct = userEvents.filter((e) => e.correct).length;
  const incorrect = userEvents.length - correct;
  const accuracy =
    userEvents.length > 0 ? Math.round((correct / userEvents.length) * 100) : 0;
  const avgMastery = getUserAvgMastery(
    competencyRecords,
    competencyDomains,
    user.id,
    user.orgId
  );

  const domainItems = competencyDomains
    .filter((d) => d.orgId === user.orgId)
    .map((d) => {
      const record = competencyRecords.find(
        (r) => r.userId === user.id && r.domainId === d.id
      );
      return {
        domainId: d.id,
        domainName: d.name,
        masteryPercent: record?.masteryPercent ?? 0,
        assessmentCount: record?.assessmentCount ?? 0,
      };
    });

  const domainNameById = Object.fromEntries(
    competencyDomains.map((d) => [d.id, d.name])
  );

  const last7Days = userEvents.filter((e) => {
    const days =
      (Date.now() - new Date(e.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return days <= 7;
  });

  return (
    <div className="space-y-5 pb-4">
      <StaffDemoSwitcher />

      <div className="flex items-center gap-3">
        <Link
          href="/staff"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "h-8 w-8 shrink-0"
          )}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Your stats
          </h1>
          <p className="text-sm text-muted-foreground">
            Topic breakdown and quiz history
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <GradientStatCard
          title="Topic mastery"
          value={`${avgMastery}%`}
          icon={BarChart3}
          gradient="violet"
        />
        <GradientStatCard
          title="Accuracy"
          value={userEvents.length > 0 ? `${accuracy}%` : "—"}
          subtitle={`${correct} correct · ${incorrect} missed`}
          icon={BarChart3}
          gradient="emerald"
        />
        <GradientStatCard
          title="This week"
          value={last7Days.length}
          subtitle="assessments"
          icon={BarChart3}
          gradient="indigo"
        />
        <GradientStatCard
          title="All time"
          value={userEvents.length}
          subtitle="total questions"
          icon={BarChart3}
          gradient="amber"
        />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">
          Topic mastery
        </h2>
        <DomainProgressList domains={domainItems} />
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Recent assessments</h2>
        {userEvents.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No quiz history yet.{" "}
            <Link href="/staff/learn" className="text-indigo-600 underline">
              Start a lesson
            </Link>
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {userEvents.slice(0, 20).map((e) => (
              <div
                key={e.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-sm",
                  e.correct
                    ? "border-emerald-100 bg-emerald-50/50"
                    : "border-rose-100 bg-rose-50/50"
                )}
              >
                {e.correct ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-medium text-slate-800">
                    {e.question}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {domainNameById[e.domainId] ?? "General"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(e.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}