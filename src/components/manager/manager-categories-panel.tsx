"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Clock,
  FolderOpen,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  REFRESHER_INTERVAL_OPTIONS,
  DEFAULT_REFRESHER_INTERVAL_DAYS,
  isRefresherRotationEnabled,
} from "@/lib/competency/domains";
import {
  getRecipientLabel,
  StaffRecipientPicker,
  type RecipientMode,
} from "@/components/manager/staff-recipient-picker";
import { useAppStore } from "@/lib/store/app-store";
import { useCurrentOrg, useCurrentUser, useOrgStaff } from "@/lib/store/hooks";
import type { CompetencyDomain } from "@/lib/types";

type CategoryRow = CompetencyDomain & { lessonCount: number };

interface ManagerCategoriesPanelProps {
  showHeader?: boolean;
  activeCategoryName?: string | null;
  onCategorySelect?: (categoryName: string) => void;
  onBack?: () => void;
}

export function ManagerCategoriesPanel({
  showHeader = true,
  activeCategoryName = null,
  onCategorySelect,
  onBack,
}: ManagerCategoriesPanelProps) {
  const user = useCurrentUser();
  const org = useCurrentOrg();
  const staff = useOrgStaff();
  const rotationEnabled = isRefresherRotationEnabled(org);
  const lessons = useAppStore((s) => s.lessons);
  const competencyDomains = useAppStore((s) => s.competencyDomains);
  const mergePlatformData = useAppStore((s) => s.mergePlatformData);
  const setCompetencyData = useAppStore((s) => s.setCompetencyData);

  const [savingDomainId, setSavingDomainId] = useState<string | null>(null);
  const [assigningLessonId, setAssigningLessonId] = useState<string | null>(null);
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("everybody");
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const staffDefaultsSet = useRef(false);

  useEffect(() => {
    if (!staffDefaultsSet.current && staff.length > 0) {
      setSelectedStaffIds(staff.map((s) => s.id));
      staffDefaultsSet.current = true;
    }
  }, [staff]);

  const orgDomains = useMemo(
    () => competencyDomains.filter((d) => d.orgId === user.orgId),
    [competencyDomains, user.orgId]
  );

  const orgLessons = useMemo(
    () => lessons.filter((l) => l.orgId === user.orgId),
    [lessons, user.orgId]
  );

  const categories: CategoryRow[] = useMemo(
    () =>
      orgDomains.map((domain) => ({
        ...domain,
        lessonCount: orgLessons.filter((l) => l.category === domain.name).length,
      })),
    [orgDomains, orgLessons]
  );

  const rotationCadence = useMemo(() => {
    if (categories.length === 0) return DEFAULT_REFRESHER_INTERVAL_DAYS;
    const avg =
      categories.reduce(
        (sum, c) => sum + (c.refresherIntervalDays ?? DEFAULT_REFRESHER_INTERVAL_DAYS),
        0
      ) / categories.length;
    return Math.round(avg);
  }, [categories]);

  const activeDomain = activeCategoryName
    ? categories.find((c) => c.name === activeCategoryName)
    : null;

  const categoryLessons = activeDomain
    ? orgLessons.filter((l) => l.category === activeDomain.name)
    : [];

  const recipientLabel = getRecipientLabel(staff, selectedStaffIds, recipientMode);

  const saveInterval = async (domain: CategoryRow, intervalDays: number) => {
    setSavingDomainId(domain.id);
    try {
      const res = await fetch("/api/manager/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domainId: domain.id,
          refresherIntervalDays: intervalDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to save interval.");
        return;
      }
      const updated = data.domain as CompetencyDomain;
      const nextDomains = competencyDomains.map((d) =>
        d.id === updated.id ? updated : d
      );
      setCompetencyData({ domains: nextDomains });
    } catch {
      alert("Network error — could not save interval.");
    } finally {
      setSavingDomainId(null);
    }
  };

  const assignLesson = async (
    lessonId: string,
    title: string,
    category: string
  ) => {
    if (selectedStaffIds.length === 0) return;
    setAssigningLessonId(lessonId);

    try {
      const res = await fetch("/api/manager/assign-refresher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: user.orgId,
          teamId: user.teamId,
          managerId: user.id,
          mode: "existing",
          lessonId,
          userIds: selectedStaffIds,
          category,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Could not assign lesson.");
        return;
      }
      if (data.assignments?.length) {
        mergePlatformData({
          assignments: [
            ...useAppStore.getState().assignments,
            ...data.assignments,
          ],
        });
        alert(`Assigned "${title}" to ${data.assignedCount ?? data.assignments.length} staff.`);
      } else {
        alert("Already assigned to the selected staff.");
      }
    } catch {
      alert("Network error — could not assign lesson.");
    } finally {
      setAssigningLessonId(null);
    }
  };

  if (activeCategoryName && activeDomain) {
    const interval =
      activeDomain.refresherIntervalDays ?? DEFAULT_REFRESHER_INTERVAL_DAYS;

    return (
      <div className="space-y-6" id="categories">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            onClick={() => onBack?.()}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to all categories
          </Button>
          <p className="text-sm text-muted-foreground">{org?.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">{activeDomain.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {categoryLessons.length} lesson
            {categoryLessons.length === 1 ? "" : "s"} in this category
          </p>
        </div>

        {rotationEnabled && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Refresher interval
              </CardTitle>
            </CardHeader>
            <CardContent>
              <select
                className="w-full max-w-xs border rounded-lg p-2 text-sm bg-background"
                value={interval}
                disabled={savingDomainId === activeDomain.id}
                onChange={(e) =>
                  saveInterval(activeDomain, parseInt(e.target.value, 10))
                }
              >
                {REFRESHER_INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>
        )}

        <StaffRecipientPicker
          staff={staff}
          selectedIds={selectedStaffIds}
          onSelectedIdsChange={setSelectedStaffIds}
          mode={recipientMode}
          onModeChange={setRecipientMode}
        />

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Lessons
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {categoryLessons.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No lessons in this category yet. Go back and use &quot;Request new
                lessons&quot; to submit materials.
              </p>
            ) : (
              categoryLessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{lesson.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {lesson.estimatedMinutes} min
                      {lesson.isRefresher ? " · Refresher" : ""}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      assigningLessonId !== null || selectedStaffIds.length === 0
                    }
                    onClick={() =>
                      assignLesson(lesson.id, lesson.title, lesson.category)
                    }
                  >
                    {assigningLessonId === lesson.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      `Assign (${recipientLabel})`
                    )}
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4" id="categories">
      {showHeader && (
        <div>
          <h2 className="text-lg font-semibold">Categories</h2>
          <p className="text-sm text-muted-foreground">
            {rotationEnabled
              ? "Set intervals and assign lessons. Staff see one topic at a time."
              : "Browse categories and assign lessons to your team."}
          </p>
        </div>
      )}

      {rotationEnabled && (
        <Card className="border-indigo-100 bg-indigo-50/40">
          <CardContent className="pt-4 text-sm space-y-2">
            <div className="flex items-center gap-2 font-medium text-indigo-900">
              <RotateCcw className="h-4 w-4" />
              Rotation order
            </div>
            <p className="text-xs text-muted-foreground">
              {categories.length} categories · ~{rotationCadence} days between topics
              {categories.length > 0 && (
                <span className="block mt-1 truncate text-indigo-800/80">
                  {categories.map((c) => c.name).join(" → ")}
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {categories.map((category) => {
          const interval =
            category.refresherIntervalDays ?? DEFAULT_REFRESHER_INTERVAL_DAYS;

          return (
            <Card key={category.id} className="overflow-hidden">
              <CardContent className="p-0">
                <button
                  type="button"
                  onClick={() => onCategorySelect?.(category.name)}
                  className="w-full text-left p-4 hover:bg-muted/40 transition-colors flex items-start gap-3"
                >
                  <div className="rounded-lg bg-indigo-50 p-2 shrink-0">
                    <FolderOpen className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm leading-snug pr-2">
                      {category.name}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {category.lessonCount} lesson
                        {category.lessonCount === 1 ? "" : "s"}
                      </Badge>
                      {rotationEnabled && (
                        <Badge variant="outline" className="text-[10px]">
                          {interval}d cycle
                        </Badge>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                </button>

                {rotationEnabled && (
                  <div
                    className="border-t px-4 py-3 bg-muted/20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <label className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                      Interval
                    </label>
                    <select
                      className="w-full border rounded-lg p-2 text-sm bg-background mt-1"
                      value={interval}
                      disabled={savingDomainId === category.id}
                      onChange={(e) =>
                        saveInterval(category, parseInt(e.target.value, 10))
                      }
                    >
                      {REFRESHER_INTERVAL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {categories.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No categories configured for this organization yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}