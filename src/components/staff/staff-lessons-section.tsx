"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, CheckCircle2, Play } from "lucide-react";
import { useRoleLabels, useCurrentOrg } from "@/lib/store/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LessonPlayer } from "@/components/staff/lesson-player";
import { useUserLessons } from "@/lib/store/hooks";
import { useAppStore } from "@/lib/store/app-store";
import { getCategoriesForOrgType } from "@/lib/competency/domains";
import type { Lesson } from "@/lib/types";

interface StaffLessonsSectionProps {
  selectedLesson?: Lesson | null;
  onSelectLesson?: (lesson: Lesson | null) => void;
}

export function StaffLessonsSection({
  selectedLesson: controlledLesson,
  onSelectLesson,
}: StaffLessonsSectionProps = {}) {
  const lessons = useUserLessons();
  const progress = useAppStore((s) => s.progress);
  const labels = useRoleLabels();
  const searchParams = useSearchParams();
  const [internalLesson, setInternalLesson] = useState<Lesson | null>(null);

  // All-org lessons for the secondary "All lessons" browser (includes completed / previously assigned)
  const currentUserId = useAppStore((s) => s.currentUserId);
  const allUsers = useAppStore((s) => s.users);
  const allStoreLessons = useAppStore((s) => s.lessons);
  const competencyDomains = useAppStore((s) => s.competencyDomains);
  const currentUser = allUsers.find((u) => u.id === currentUserId);
  const orgId = currentUser?.orgId;
  const org = useCurrentOrg();
  const orgType = org?.orgType || "snf";

  const allOrgLessons = useMemo(() => {
    if (!orgId) return [];
    return allStoreLessons
      .filter((l) => l.orgId === orgId)
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  }, [allStoreLessons, orgId]);

  // Standardized categories for "All lessons" browser: use the org's competencyDomains
  // (exact same list managers see in their panels/domains), with fallback to the standard
  // per-orgType list if no domains are configured yet.
  const allCategories = useMemo(() => {
    const orgDomains = competencyDomains.filter((d) => d.orgId === orgId);
    if (orgDomains.length > 0) {
      return orgDomains.map((d) => d.name);
    }
    return getCategoriesForOrgType(orgType);
  }, [competencyDomains, orgId, orgType]);

  const [showAllLessons, setShowAllLessons] = useState(false);
  const [allCategory, setAllCategory] = useState<string | null>(null);

  const selectedLesson = controlledLesson !== undefined ? controlledLesson : internalLesson;
  const setSelectedLesson = onSelectLesson ?? setInternalLesson;

  useEffect(() => {
    const lessonId = searchParams.get("lesson");
    if (!lessonId) return;
    const match = lessons.find((l) => l.id === lessonId);
    if (match) setSelectedLesson(match);
  }, [searchParams, lessons, setSelectedLesson]);

  if (selectedLesson) {
    return (
      <div className="rounded-2xl border bg-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedLesson(null)}>
            ← {showAllLessons ? "All lessons" : "My lessons"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const store = useAppStore.getState();
              store.askWithQuestion?.(
                `Tell me more about the policy for: ${selectedLesson.title}`
              );
            }}
          >
            Ask Policy about this
          </Button>
        </div>
        <LessonPlayer lesson={selectedLesson} />
        <p className="text-center text-[10px] text-muted-foreground">
          Tap Next to move forward. One screen at a time.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="h-5 w-5 text-indigo-600" />
        <h3 className="font-semibold">{showAllLessons ? "All lessons" : labels.lessonsTitle}</h3>
        {!showAllLessons ? (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto text-xs h-6 px-2"
            onClick={() => {
              setShowAllLessons(true);
              setAllCategory(null);
            }}
          >
            All lessons
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-xs h-6 px-2"
            onClick={() => {
              setShowAllLessons(false);
              setAllCategory(null);
            }}
          >
            My lessons
          </Button>
        )}
      </div>

      {showAllLessons && allCategories.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] text-muted-foreground mb-1">Choose a category:</div>
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant={allCategory === null ? "default" : "outline"}
              className="text-xs h-6 px-2"
              onClick={() => setAllCategory(null)}
            >
              All
            </Button>
            {allCategories.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={allCategory === cat ? "default" : "outline"}
                className="text-xs h-6 px-2"
                onClick={() => setAllCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground mb-3">
        {showAllLessons
          ? "Browse every lesson in your organization by category (including completed ones)."
          : "Tap a lesson to start or continue. One screen at a time."}
      </p>

      {(() => {
        const displayLessons = showAllLessons
          ? (allCategory ? allOrgLessons.filter((l) => l.category === allCategory) : allOrgLessons)
          : lessons;

        if (displayLessons.length === 0) {
          return (
            <Card className="border-dashed shadow-none">
              <CardContent className="py-8 text-center">
                <p className="font-medium text-sm">
                  {showAllLessons ? "No lessons in this category" : "No lessons assigned yet"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {showAllLessons
                    ? "Try another category or check back later."
                    : "Your manager can assign training from the organization's materials."}
                </p>
              </CardContent>
            </Card>
          );
        }

        return (
          <div className="space-y-2">
            {displayLessons.map((lesson) => {
            const p = progress.find((pr) => pr.lessonId === lesson.id);
            const isDone = p?.status === "completed";
            const pct = p
              ? Math.round(
                  ((p.currentSlideIndex || 0) / (lesson.slides.length || 1)) * 100
                )
              : 0;

            return (
              <button
                key={lesson.id}
                type="button"
                onClick={() => setSelectedLesson(lesson)}
                className="w-full text-left rounded-2xl border bg-white hover:bg-slate-50 active:bg-slate-100 active:scale-[0.995] transition-all shadow-sm px-4 py-3.5 flex items-center gap-4 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base truncate group-hover:text-indigo-700 transition">
                      {lesson.title}
                    </span>
                    {isDone && (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px]">
                      {lesson.estimatedMinutes} min
                    </Badge>
                    <span className="truncate">{lesson.category || "Training"}</span>
                    <span>• {isDone ? "Completed" : `${pct}% done`}</span>
                  </div>
                  <div className="mt-2">
                    <Progress value={isDone ? 100 : pct} className="h-1.5" />
                  </div>
                </div>
                <Play className="h-5 w-5 text-primary shrink-0" />
              </button>
            );
          })}
          </div>
        );
      })()}
    </div>
  );
}