"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Lightbulb } from "lucide-react";
import { TeamMemberRow } from "@/components/manager/team-member-row";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { buildDomainCoverage } from "@/lib/competency/mastery";
import {
  buildRecommendations,
  buildTeamMemberStatuses,
} from "@/lib/analytics/team";
import {
  getCategoriesForOrgType,
  getRefresherIntervalDays,
  isRefresherRotationEnabled,
} from "@/lib/competency/domains";
import { useAppStore } from "@/lib/store/app-store";
import { useCurrentUser, useOrgStaff } from "@/lib/store/hooks";
import type { User } from "@/lib/types";

export default function ManagerDashboardPage() {
  const user = useCurrentUser();
  const staff = useOrgStaff();
  const assignments = useAppStore((s) => s.assignments);
  const progress = useAppStore((s) => s.progress);
  const streaks = useAppStore((s) => s.streaks);
  const lessons = useAppStore((s) => s.lessons);
  const competencyDomains = useAppStore((s) => s.competencyDomains);
  const competencyRecords = useAppStore((s) => s.competencyRecords);
  const chatMessages = useAppStore((s) => s.chatMessages);
  const storeOrgs = useAppStore((s) => s.organizations);
  const storeTeams = useAppStore((s) => s.teams);

  const org = storeOrgs.find((o) => o.id === user.orgId) || storeOrgs[0];
  const team =
    storeTeams.find((t) => t.id === user.teamId) ||
    storeTeams.find((t) => t.orgId === user.orgId) ||
    { name: "Main Team" };
  const orgLessons = lessons.filter((l) => l.orgId === user.orgId);

  const teamStatuses = buildTeamMemberStatuses(
    staff,
    assignments,
    progress,
    streaks,
    lessons,
    competencyRecords,
    competencyDomains
  );
  const domainCoverage = buildDomainCoverage(
    staff,
    competencyDomains,
    competencyRecords,
    user.orgId
  );
  const rotationEnabled = isRefresherRotationEnabled(org);
  const atRisk = teamStatuses.filter((m) => m.atRisk);

  const recommendations = buildRecommendations(teamStatuses, orgLessons);

  const getRefresherCycle = (staffUser: User) => {
    const prio = staffUser.priorityCategories || [];
    if (prio.length === 0)
      return { pct: 100, colorClass: "bg-green-500", daysSince: 0, interval: 90 };
    let totalFresh = 0;
    let maxDays = 0;
    let usedInt = 90;
    prio.forEach((cat) => {
      const intv = getRefresherIntervalDays(cat, {
        user: staffUser,
        domains: competencyDomains,
        orgId: staffUser.orgId,
      });
      usedInt = intv;
      const relL = lessons.filter(
        (l) => l.category === cat && l.orgId === staffUser.orgId
      );
      const relP = progress.filter(
        (p) =>
          p.userId === staffUser.id &&
          p.status === "completed" &&
          relL.some((rl) => rl.id === p.lessonId)
      );
      const lastTs =
        relP.length > 0
          ? Math.max(...relP.map((p) => new Date(p.completedAt || 0).getTime()))
          : 0;
      const dSince =
        lastTs > 0
          ? Math.floor((Date.now() - lastTs) / (1000 * 60 * 60 * 24))
          : 999;
      const overdue = Math.min(100, Math.max(0, (dSince / intv) * 100));
      totalFresh += 100 - overdue;
      if (dSince > maxDays) maxDays = dSince;
    });
    const avgFresh = Math.round(totalFresh / prio.length);
    let colorClass = "bg-green-500";
    if (avgFresh < 25) colorClass = "bg-red-500";
    else if (avgFresh < 50) colorClass = "bg-orange-500";
    else if (avgFresh < 75) colorClass = "bg-yellow-500";
    return { pct: avgFresh, colorClass, daysSince: maxDays, interval: usedInt };
  };

  const orgType = org?.orgType || "snf";
  const requiredCategories = getCategoriesForOrgType(orgType);
  const surveyReadiness = requiredCategories.map((cat) => {
    const dom = domainCoverage.find((d) => d.domainName === cat);
    const hasLesson = orgLessons.some((l) => l.category === cat);
    const staffWithCoverage =
      staff.length > 0
        ? Math.round(((dom?.staffAssessed || 0) / staff.length) * 100)
        : 0;
    const ready = hasLesson && (dom?.avgMastery || 0) >= 70;
    return {
      category: cat,
      hasLesson,
      avgMastery: dom?.avgMastery || 0,
      staffAssessedPct: staffWithCoverage,
      ready,
    };
  });
  const surveyReadyCount = surveyReadiness.filter((r) => r.ready).length;
  const surveyGapCount = surveyReadiness.filter((r) => !r.ready).length;
  const gapsNeedingLessons = surveyReadiness.filter((r) => !r.hasLesson).length;

  const [painPoints, setPainPoints] = useState<
    Array<{
      title: string;
      count: number;
      examples: string[];
      recommendation: string;
    }> | null
  >(null);
  const [analyzing, setAnalyzing] = useState(false);

  const collectStaffQuestions = () => {
    const qs: string[] = [];
    staff.forEach((s) => {
      const msgs = chatMessages[s.id] ?? [];
      msgs.forEach((m) => {
        if (m.role === "user" && m.content) qs.push(m.content);
      });
    });
    return qs.slice(-25);
  };

  const handleAnalyzePainPoints = async () => {
    const questions = collectStaffQuestions();
    if (questions.length === 0) {
      setPainPoints([]);
      return;
    }
    setAnalyzing(true);
    try {
      const res = await fetch("/api/manager/pain-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: user.orgId,
          orgName: org.name,
          questions,
        }),
      });
      const data = await res.json();
      setPainPoints(data.painPoints || []);
    } catch {
      setPainPoints([]);
    } finally {
      setAnalyzing(false);
    }
  };

  const buildRefresherLink = (pp: {
    title: string;
    recommendation: string;
    examples?: string[];
  }) => {
    const incident = [
      pp.title,
      pp.examples?.[0],
      pp.recommendation,
    ]
      .filter(Boolean)
      .join(" — ");
    const params = new URLSearchParams({
      incident,
    });
    return `/manager/training?${params.toString()}#assign-refresher`;
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">
          {org.name} · {team.name}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Team health, survey readiness, and where to focus.
        </p>
      </div>

      <Card className="border-emerald-200 bg-emerald-50/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">
                Survey readiness —{" "}
                {orgType === "snf"
                  ? "CDPH"
                  : orgType === "behavioral_health"
                    ? "Joint Commission"
                    : "Home Health"}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {surveyGapCount} gaps · {gapsNeedingLessons} areas need lessons
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-semibold text-emerald-700">
                {surveyReadyCount}/{requiredCategories.length}
              </div>
              <div className="text-[10px] text-emerald-600">areas ready</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            {surveyReadiness.map((item) => (
              <div
                key={item.category}
                className={`rounded-lg border p-2.5 ${
                  item.ready
                    ? "bg-emerald-100/60 border-emerald-200"
                    : "bg-white border-amber-200"
                }`}
              >
                <div className="font-medium text-xs leading-tight mb-1">
                  {item.category}
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span
                    className={
                      item.hasLesson ? "text-emerald-700" : "text-amber-600"
                    }
                  >
                    {item.hasLesson ? "✓ Has lesson" : "⚠ Needs lesson"}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {item.staffAssessedPct}% staff
                  </span>
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  Mastery: {Math.round(item.avgMastery)}%
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {rotationEnabled && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Team refresher status</CardTitle>
            <p className="text-xs text-muted-foreground">
              Who is caught up on the rotation. Green = good, red = behind.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {staff.length === 0 ? (
              <p className="text-sm text-muted-foreground">No staff yet.</p>
            ) : (
              staff.map((s) => {
                const c = getRefresherCycle(s);
                return (
                  <div key={s.id} className="flex items-center gap-3 text-sm">
                    <div className="w-32 truncate font-medium">{s.name}</div>
                    <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-3 rounded-full ${c.colorClass}`}
                        style={{ width: `${c.pct}%` }}
                      />
                    </div>
                    <div className="w-20 text-right text-xs text-muted-foreground">
                      {c.pct}%
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-indigo-100">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-indigo-600" />
              Staff questions
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              What your team is asking Ask Policy about
            </p>
          </div>
          <Button
            onClick={handleAnalyzePainPoints}
            disabled={analyzing}
            size="sm"
            variant="outline"
          >
            {analyzing ? "Analyzing…" : "Analyze"}
          </Button>
        </CardHeader>
        <CardContent>
          {!painPoints && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Run analysis to see common confusion topics from staff questions.
            </p>
          )}
          {painPoints && painPoints.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No recent staff questions yet.
            </p>
          )}
          {painPoints && painPoints.length > 0 && (
            <div className="space-y-3">
              {painPoints.slice(0, 3).map((pp, idx) => (
                <div key={idx} className="rounded-lg border p-3 text-sm">
                  <div className="font-medium flex items-center gap-2">
                    {pp.title}
                    <Badge variant="secondary" className="text-[10px]">
                      {pp.count}×
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {pp.recommendation}
                  </p>
                  <Link
                    href={buildRefresherLink(pp)}
                    className={cn(
                      buttonVariants({ variant: "link", size: "sm" }),
                      "h-auto p-0 mt-1 text-xs"
                    )}
                  >
                    Assign refresher <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recommended actions</CardTitle>
            <Badge variant="secondary">{recommendations.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.map((rec, index) => (
              <div
                key={`${rec.id}-${index}`}
                className="rounded-lg border p-4 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      rec.priority === "high"
                        ? "destructive"
                        : rec.priority === "medium"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {rec.priority}
                  </Badge>
                  <span className="font-medium text-sm">{rec.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">{rec.description}</p>
                <Link
                  href={rec.actionHref}
                  className={cn(
                    buttonVariants({ variant: "link", size: "sm" }),
                    "h-auto p-0"
                  )}
                >
                  {rec.actionLabel} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">At-risk staff</CardTitle>
            <Link
              href="/manager/team"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {atRisk.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No at-risk staff — great job!
              </p>
            ) : (
              atRisk.slice(0, 3).map((m) => (
                <div key={m.user.id} className="space-y-1">
                  <TeamMemberRow member={m} />
                  {m.competencyGaps && m.competencyGaps.length > 0 && (
                    <p className="text-xs text-muted-foreground pl-2">
                      Gaps:{" "}
                      {m.competencyGaps
                        .map((g) => `${g.domainName} (${g.masteryPercent}%)`)
                        .join(", ")}
                    </p>
                  )}
                </div>
              ))
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs mt-2"
              onClick={() => {
                const csv = [
                  "Name,Email,Completion %,At Risk,Gap Areas",
                  ...teamStatuses.map((m) =>
                    [
                      m.user.name,
                      m.user.email,
                      m.completionRate,
                      m.atRisk ? "Yes" : "No",
                      (m.gapAreas || []).join("; "),
                    ].join(",")
                  ),
                ].join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `competency-report-${org.name.replace(/\s+/g, "-")}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export report (CSV)
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}