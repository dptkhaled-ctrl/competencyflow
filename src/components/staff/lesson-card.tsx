"use client";

import Link from "next/link";
import { Clock, CheckCircle2, Circle, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Lesson, LessonProgress } from "@/lib/types";

interface LessonCardProps {
  lesson: Lesson;
  progress?: LessonProgress;
}

export function LessonCard({ lesson, progress }: LessonCardProps) {
  const status = progress?.status ?? "not_started";
  const slideProgress =
    lesson.slides.length > 0
      ? Math.round(((progress?.currentSlideIndex ?? 0) / lesson.slides.length) * 100)
      : 0;

  const StatusIcon =
    status === "completed" ? CheckCircle2 : status === "in_progress" ? PlayCircle : Circle;

  return (
    <Link href={`/staff/lessons/${lesson.id}`}>
      <Card className="transition-shadow hover:shadow-md active:scale-[0.99]">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">{lesson.title}</CardTitle>
            <StatusIcon
              className={
                status === "completed"
                  ? "h-5 w-5 shrink-0 text-emerald-600"
                  : status === "in_progress"
                    ? "h-5 w-5 shrink-0 text-primary"
                    : "h-5 w-5 shrink-0 text-muted-foreground"
              }
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{lesson.category}</Badge>
            {lesson.isRefresher && (
              <Badge variant="outline" className="border-amber-300 text-amber-700">
                Refresher
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground line-clamp-2">{lesson.description}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {lesson.estimatedMinutes} min
            </span>
            <span className="capitalize">{status.replace("_", " ")}</span>
          </div>
          {status === "in_progress" && <Progress value={slideProgress} className="h-1.5" />}
        </CardContent>
      </Card>
    </Link>
  );
}