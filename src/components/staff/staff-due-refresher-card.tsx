"use client";

import { useEffect, useMemo } from "react";
import { Play, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store/app-store";
import { useCurrentOrg, useCurrentUser } from "@/lib/store/hooks";
import { isRefresherRotationEnabled } from "@/lib/competency/domains";
import {
  buildRefresherAssignment,
  buildRefresherCycleSnapshot,
  ensureDueRefresherLesson,
} from "@/lib/competency/refresher-cycle";
import type { Lesson } from "@/lib/types";

interface StaffDueRefresherCardProps {
  onStart: (lesson: Lesson) => void;
}

export function StaffDueRefresherCard({ onStart }: StaffDueRefresherCardProps) {
  const user = useCurrentUser();
  const org = useCurrentOrg();
  const lessons = useAppStore((s) => s.lessons);
  const assignments = useAppStore((s) => s.assignments);
  const progress = useAppStore((s) => s.progress);
  const competencyDomains = useAppStore((s) => s.competencyDomains);
  const mergePlatformData = useAppStore((s) => s.mergePlatformData);
  const rotationEnabled = isRefresherRotationEnabled(org);

  const snapshot = useMemo(
    () =>
      rotationEnabled
        ? buildRefresherCycleSnapshot(user, competencyDomains, lessons, progress)
        : null,
    [rotationEnabled, user, competencyDomains, lessons, progress]
  );

  const { lesson: dueLesson, created } = useMemo(
    () =>
      rotationEnabled
        ? ensureDueRefresherLesson(user, competencyDomains, lessons, assignments, progress)
        : { snapshot: null, lesson: null, created: false },
    [rotationEnabled, user, competencyDomains, lessons, assignments, progress]
  );

  useEffect(() => {
    if (!rotationEnabled) return;
    if (!user.priorityCategories?.length || user.refresherCycleStartedAt) return;
    mergePlatformData({
      users: [{ ...user, refresherCycleStartedAt: new Date().toISOString() }],
    });
  }, [rotationEnabled, user, mergePlatformData]);

  useEffect(() => {
    if (!rotationEnabled || !dueLesson || !snapshot?.currentDue) return;

    const alreadyAssigned = assignments.some(
      (a) => a.userId === user.id && a.lessonId === dueLesson.id
    );
    const lessonExists = lessons.some((l) => l.id === dueLesson.id);

    if (created || !alreadyAssigned || !lessonExists) {
      const nextLessons = lessonExists ? lessons : [...lessons, dueLesson];
      const nextAssignments = alreadyAssigned
        ? assignments
        : [...assignments, buildRefresherAssignment(dueLesson.id, user.id)];
      mergePlatformData({ lessons: nextLessons, assignments: nextAssignments });
    }
  }, [rotationEnabled, dueLesson, created, snapshot?.currentDue, user.id, lessons, assignments, mergePlatformData]);

  if (!rotationEnabled) return null;

  if (!snapshot?.currentDue || !dueLesson) {
    if (!snapshot || snapshot.categories.length === 0) return null;

    const next = snapshot.nextUp;
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
        <div className="flex items-center gap-2 mb-1">
          <RotateCcw className="h-4 w-4 text-emerald-700" />
          <span className="font-semibold text-sm text-emerald-900">Refresher cycle</span>
        </div>
        <p className="text-sm text-emerald-800">You&apos;re caught up for now.</p>
        {next && (
          <p className="text-xs text-emerald-700/80 mt-1">
            Next up: <span className="font-medium">{next.category}</span>
            {next.daysUntilDue > 0 ? ` in ~${next.daysUntilDue} day${next.daysUntilDue === 1 ? "" : "s"}` : " soon"}
          </p>
        )}
      </div>
    );
  }

  const due = snapshot.currentDue;

  return (
    <div className="rounded-2xl border-2 border-indigo-300 bg-indigo-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-indigo-600 hover:bg-indigo-600 text-[10px]">
              Due now
            </Badge>
            <span className="text-[10px] text-indigo-700 uppercase tracking-wide font-medium">
              Refresher {due.orderIndex + 1} of {snapshot.categories.length}
            </span>
          </div>
          <h3 className="font-semibold text-base text-indigo-950 leading-snug">
            {due.category}
          </h3>
          <p className="text-sm text-indigo-800/90 mt-1">
            One quick refresher — then the next topic rotates in on its own schedule.
          </p>
          <p className="text-[10px] text-indigo-600/80 mt-2">
            Repeats every {due.intervalDays} days · ~{snapshot.cadenceDays}d between topics
          </p>
        </div>
        <Button
          size="lg"
          className="shrink-0 bg-indigo-600 hover:bg-indigo-700"
          onClick={() => onStart(dueLesson)}
        >
          <Play className="h-4 w-4 mr-1" />
          Start
        </Button>
      </div>
    </div>
  );
}