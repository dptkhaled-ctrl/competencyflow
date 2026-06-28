"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Loader2, RotateCcw, Sparkles } from "lucide-react";
import {
  getRecipientLabel,
  StaffRecipientPicker,
  type RecipientMode,
} from "@/components/manager/staff-recipient-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getCategoriesForOrgType,
  isRefresherRotationEnabled,
  REFRESHER_INTERVAL_OPTIONS,
} from "@/lib/competency/domains";
import type { RefresherRecommendation } from "@/lib/ai/refresher-recommender";
import { useAppStore } from "@/lib/store/app-store";
import { useCurrentOrg, useCurrentUser, useOrgStaff } from "@/lib/store/hooks";
import { cn } from "@/lib/utils";
import type { Lesson, LessonAssignment, User } from "@/lib/types";

export interface RefresherPrefill {
  title?: string;
  description?: string;
  category?: string;
  mode?: "pick" | "incident";
}

interface ManagerAssignRefresherProps {
  prefill?: RefresherPrefill | null;
}

type AssignMode = "pick" | "incident";

export function ManagerAssignRefresher({ prefill }: ManagerAssignRefresherProps) {
  const user = useCurrentUser();
  const org = useCurrentOrg();
  const staff = useOrgStaff();
  const lessons = useAppStore((s) => s.lessons);
  const mergePlatformData = useAppStore((s) => s.mergePlatformData);
  const orgType = org?.orgType || "snf";
  const rotationEnabled = isRefresherRotationEnabled(org);
  const categories = getCategoriesForOrgType(orgType);

  const [mode, setMode] = useState<AssignMode>(prefill?.mode ?? "pick");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [incidentText, setIncidentText] = useState("");
  const [recommendSummary, setRecommendSummary] = useState("");
  const [recommendations, setRecommendations] = useState<RefresherRecommendation[]>(
    []
  );
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("everybody");
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [refresherInterval, setRefresherInterval] = useState("30");

  const defaultsSet = useRef(false);
  useEffect(() => {
    if (!defaultsSet.current && staff.length > 0) {
      setSelectedStaffIds(staff.map((s) => s.id));
      defaultsSet.current = true;
    }
  }, [staff]);

  useEffect(() => {
    if (!prefill) return;
    if (prefill.mode) setMode(prefill.mode);
    if (prefill.description || prefill.title) {
      setMode("incident");
      setIncidentText(
        [prefill.title, prefill.description].filter(Boolean).join("\n\n")
      );
    }
    if (prefill.category) setCategoryFilter(prefill.category);
    if (staff.length > 0) {
      setRecipientMode("everybody");
      setSelectedStaffIds(staff.map((s) => s.id));
    }
  }, [prefill, staff]);

  const recipientLabel = getRecipientLabel(staff, selectedStaffIds, recipientMode);

  const orgLessons = useMemo(
    () =>
      lessons
        .filter((l) => l.orgId === user.orgId)
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)),
    [lessons, user.orgId]
  );

  const filteredLessons = useMemo(() => {
    if (categoryFilter === "all") return orgLessons;
    return orgLessons.filter((l) => l.category === categoryFilter);
  }, [orgLessons, categoryFilter]);

  const syncAssignmentResult = (data: {
    lesson?: Lesson;
    assignments?: LessonAssignment[];
    users?: User[];
  }) => {
    const patch: Parameters<typeof mergePlatformData>[0] = {};
    if (data.lesson) {
      const current = useAppStore.getState().lessons;
      const exists = current.some((l) => l.id === data.lesson!.id);
      patch.lessons = exists
        ? current.map((l) => (l.id === data.lesson!.id ? { ...l, ...data.lesson } : l))
        : [...current, data.lesson];
    }
    if (data.assignments?.length) {
      patch.assignments = [
        ...useAppStore.getState().assignments,
        ...data.assignments,
      ];
    }
    if (data.users?.length) {
      const byId = new Map(useAppStore.getState().users.map((u) => [u.id, u]));
      for (const u of data.users) byId.set(u.id, u);
      patch.users = [...byId.values()];
    }
    if (Object.keys(patch).length) mergePlatformData(patch);
  };

  const assignRefresher = async (opts: {
    assignMode: "existing" | "custom";
    lessonId?: string;
    title: string;
    category: string;
    keyPoints?: string;
    recKey: string;
  }) => {
    if (selectedStaffIds.length === 0) return;
    setAssigningId(opts.recKey);
    setSuccessMsg("");

    try {
      const res = await fetch("/api/manager/assign-refresher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: user.orgId,
          teamId: user.teamId,
          managerId: user.id,
          mode: opts.assignMode,
          lessonId: opts.lessonId,
          userIds: selectedStaffIds,
          incidentText: incidentText.trim() || undefined,
          category: opts.category,
          categoryIntervalDays: rotationEnabled
            ? parseInt(refresherInterval, 10)
            : undefined,
          customLesson:
            opts.assignMode === "custom"
              ? {
                  title: opts.title,
                  category: opts.category,
                  keyPoints: opts.keyPoints || incidentText.trim(),
                }
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Could not assign refresher.");
        return;
      }

      syncAssignmentResult(data);
      setSuccessMsg(
        `"${opts.title}" assigned to ${data.assignedCount ?? selectedStaffIds.length} staff.`
      );
    } catch {
      alert("Network error — could not assign refresher.");
    } finally {
      setAssigningId(null);
    }
  };

  const handleGetRecommendations = async () => {
    const text = incidentText.trim();
    if (!text) return;

    setLoadingRecs(true);
    setRecommendations([]);
    setRecommendSummary("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/manager/refresher-recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: user.orgId,
          orgType,
          orgName: org?.name,
          incident: text,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Could not get recommendations.");
        return;
      }
      setRecommendSummary(data.summary || "");
      setRecommendations(data.recommendations || []);
      if (data.primaryCategory) setCategoryFilter(data.primaryCategory);
    } catch {
      alert("Network error — could not reach the recommender.");
    } finally {
      setLoadingRecs(false);
    }
  };

  return (
    <Card className="border-emerald-200" id="assign-refresher">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <RotateCcw className="h-4 w-4" />
          Assign a refresher
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Pick a built lesson or describe what happened — AI suggests the best fit.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 p-1 rounded-lg bg-muted/50">
          <button
            type="button"
            onClick={() => setMode("pick")}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              mode === "pick"
                ? "bg-white shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BookOpen className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
            Pick a lesson
          </button>
          <button
            type="button"
            onClick={() => setMode("incident")}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              mode === "incident"
                ? "bg-white shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
            Something happened
          </button>
        </div>

        <StaffRecipientPicker
          staff={staff}
          selectedIds={selectedStaffIds}
          onSelectedIdsChange={setSelectedStaffIds}
          mode={recipientMode}
          onModeChange={setRecipientMode}
        />

        {rotationEnabled && (
          <div>
            <Label className="text-xs">Category interval (rotation)</Label>
            <select
              className="w-full border rounded-lg p-2 text-sm bg-background mt-1"
              value={refresherInterval}
              onChange={(e) => setRefresherInterval(e.target.value)}
            >
              {REFRESHER_INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {mode === "pick" ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Category</Label>
              <select
                className="w-full border rounded-lg p-2 text-sm bg-background mt-1"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {filteredLessons.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No lessons in this category yet. Try &quot;Something happened&quot; to
                  create a quick refresher.
                </p>
              ) : (
                filteredLessons.map((lesson) => {
                  const recKey = `lesson-${lesson.id}`;
                  return (
                    <div
                      key={lesson.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">
                          {lesson.title}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {lesson.category}
                          {lesson.isRefresher ? " · Refresher" : ""}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={assigningId !== null || selectedStaffIds.length === 0}
                        onClick={() =>
                          assignRefresher({
                            assignMode: "existing",
                            lessonId: lesson.id,
                            title: lesson.title,
                            category: lesson.category,
                            recKey,
                          })
                        }
                      >
                        {assigningId === recKey ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          `Assign (${recipientLabel})`
                        )}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">What happened?</Label>
              <Textarea
                placeholder="e.g. CNA forgot gloves after a room change — need a quick refresher on hand hygiene"
                value={incidentText}
                onChange={(e) => setIncidentText(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>
            <Button
              onClick={handleGetRecommendations}
              disabled={loadingRecs || !incidentText.trim()}
              className="w-full sm:w-auto"
            >
              {loadingRecs ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Finding matches…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Get recommendations
                </>
              )}
            </Button>

            {recommendSummary && (
              <p className="text-sm text-muted-foreground rounded-lg bg-slate-50 border p-3">
                {recommendSummary}
              </p>
            )}

            {recommendations.length > 0 && (
              <div className="space-y-2">
                {recommendations.map((rec, idx) => {
                  const recKey = `rec-${idx}-${rec.lessonId ?? "custom"}`;
                  return (
                    <div
                      key={recKey}
                      className="rounded-lg border p-3 space-y-2 bg-white"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-sm">{rec.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {rec.category}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Badge variant="outline" className="text-[10px]">
                            {rec.type === "existing_lesson" ? "Built" : "Custom"}
                          </Badge>
                          {rec.confidence === "high" && (
                            <Badge className="text-[10px] bg-emerald-600">Best fit</Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{rec.reason}</p>
                      <Button
                        size="sm"
                        className="w-full sm:w-auto"
                        disabled={assigningId !== null || selectedStaffIds.length === 0}
                        onClick={() =>
                          assignRefresher({
                            assignMode:
                              rec.type === "existing_lesson" ? "existing" : "custom",
                            lessonId: rec.lessonId,
                            title: rec.title,
                            category: rec.category,
                            keyPoints: incidentText.trim(),
                            recKey,
                          })
                        }
                      >
                        {assigningId === recKey ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          `Assign (${recipientLabel})`
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {successMsg && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            {successMsg}
          </p>
        )}
      </CardContent>
    </Card>
  );
}