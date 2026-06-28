"use client";

import Link from "next/link";
import { CheckCircle2, Play, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Lesson, LessonProgress } from "@/lib/types";

export interface LessonGroup {
  label: string;
  lessons: Lesson[];
}

interface LessonPathProps {
  lessons: Lesson[];
  progress: LessonProgress[];
  userId: string;
  groups?: LessonGroup[];
}

function LessonNode({
  lesson,
  progress,
  userId,
}: {
  lesson: Lesson;
  progress: LessonProgress[];
  userId: string;
}) {
  const p = progress.find(
    (pr) => pr.userId === userId && pr.lessonId === lesson.id
  );
  const status = p?.status ?? "not_started";

  const Icon =
    status === "completed" ? CheckCircle2 : status === "in_progress" ? Play : Star;

  const node = (
    <div
      className={cn(
        "relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-4 font-bold transition-transform",
        status === "completed" &&
          "border-emerald-400 bg-emerald-500 text-white shadow-lg shadow-emerald-500/30",
        status === "in_progress" &&
          "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-110",
        status === "not_started" &&
          "border-primary/40 bg-background text-primary hover:scale-105"
      )}
    >
      <Icon className="h-5 w-5" />
    </div>
  );

  const content = (
    <div
      className={cn(
        "flex-1 rounded-2xl border-2 p-4 transition-all",
        status === "completed" && "border-emerald-200 bg-emerald-50/50",
        status === "in_progress" && "border-primary/40 bg-primary/5 shadow-md",
        status === "not_started" && "border-border bg-card"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-sm leading-snug">{lesson.title}</h3>
        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
          +{lesson.xpReward ?? 15} XP
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {lesson.estimatedMinutes} min · {lesson.slides.length} bites
      </p>
    </div>
  );

  return (
    <Link
      href={`/staff/lessons/${lesson.id}`}
      className="flex items-center gap-4 py-3"
    >
      {node}
      {content}
    </Link>
  );
}

export function LessonPath({ lessons, progress, userId, groups }: LessonPathProps) {
  if (groups && groups.length > 1) {
    return (
      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
            <div className="relative space-y-0 py-2">
              <div className="absolute left-6 top-4 bottom-4 w-1 rounded-full bg-primary/15" />
              {group.lessons.map((lesson) => (
                <LessonNode
                  key={lesson.id}
                  lesson={lesson}
                  progress={progress}
                  userId={userId}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative space-y-0 py-2">
      <div className="absolute left-6 top-4 bottom-4 w-1 rounded-full bg-primary/15" />
      {lessons.map((lesson) => (
        <LessonNode
          key={lesson.id}
          lesson={lesson}
          progress={progress}
          userId={userId}
        />
      ))}
    </div>
  );
}