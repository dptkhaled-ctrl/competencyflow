import { getCompetencyGaps, getUserAvgMastery } from "@/lib/competency/mastery";
import type {
  CompetencyDomain,
  CompetencyRecord,
  Lesson,
  LessonAssignment,
  LessonProgress,
  ManagerRecommendation,
  Streak,
  TeamMemberStatus,
  User,
} from "@/lib/types";

export function getCompletionRate(
  userId: string,
  assignments: LessonAssignment[],
  progress: LessonProgress[]
): number {
  const userAssignments = assignments.filter((a) => a.userId === userId);
  if (userAssignments.length === 0) return 0;

  const completed = userAssignments.filter((a) => {
    const p = progress.find(
      (pr) => pr.userId === userId && pr.lessonId === a.lessonId
    );
    return p?.status === "completed";
  }).length;

  return Math.round((completed / userAssignments.length) * 100);
}

export function getOverdueCount(
  userId: string,
  assignments: LessonAssignment[],
  progress: LessonProgress[]
): number {
  const now = new Date();
  return assignments
    .filter((a) => a.userId === userId && a.dueAt)
    .filter((a) => {
      const due = new Date(a.dueAt!);
      const p = progress.find(
        (pr) => pr.userId === userId && pr.lessonId === a.lessonId
      );
      return due < now && p?.status !== "completed";
    }).length;
}

export function getGapAreas(
  userId: string,
  assignments: LessonAssignment[],
  progress: LessonProgress[],
  lessons: Lesson[]
): string[] {
  const gaps: string[] = [];
  for (const assignment of assignments.filter((a) => a.userId === userId)) {
    const p = progress.find(
      (pr) => pr.userId === userId && pr.lessonId === assignment.lessonId
    );
    const lesson = lessons.find((l) => l.id === assignment.lessonId);
    if (!lesson) continue;
    if (!p || p.status === "not_started") gaps.push(lesson.category);
    if (p?.status === "in_progress") gaps.push(`${lesson.category} (in progress)`);
    if (p?.quizScore !== undefined && p.quizScore < 100) gaps.push(`${lesson.title} quiz`);
  }
  return [...new Set(gaps)].slice(0, 3);
}

export function buildTeamMemberStatuses(
  staff: User[],
  assignments: LessonAssignment[],
  progress: LessonProgress[],
  streaks: Streak[],
  lessons: Lesson[],
  competencyRecords: CompetencyRecord[] = [],
  competencyDomains: CompetencyDomain[] = []
): TeamMemberStatus[] {
  return staff.map((user) => {
    const completionRate = getCompletionRate(user.id, assignments, progress);
    const overdueCount = getOverdueCount(user.id, assignments, progress);
    const streak = streaks.find((s) => s.userId === user.id)?.currentStreak ?? 0;
    const gapAreas = getGapAreas(user.id, assignments, progress, lessons);
    const competencyGaps = getCompetencyGaps(
      competencyRecords,
      competencyDomains,
      user.id,
      user.orgId
    );
    const avgMastery = getUserAvgMastery(
      competencyRecords,
      competencyDomains,
      user.id,
      user.orgId
    );

    const atRisk =
      completionRate < 60 ||
      overdueCount > 0 ||
      streak === 0 ||
      gapAreas.length >= 2 ||
      (avgMastery > 0 && avgMastery < 55) ||
      competencyGaps.length >= 2;

    return {
      user,
      completionRate,
      overdueCount,
      streak,
      atRisk,
      gapAreas,
      competencyGaps,
      avgMastery,
    };
  });
}

export function buildRecommendations(
  teamStatuses: TeamMemberStatus[],
  orgLessons: Lesson[]
): ManagerRecommendation[] {
  const recs: ManagerRecommendation[] = [];
  const atRisk = teamStatuses.filter((m) => m.atRisk);

  if (atRisk.length > 0) {
    recs.push({
      id: "rec-at-risk",
      priority: "high",
      title: `${atRisk.length} team member${atRisk.length > 1 ? "s" : ""} at risk`,
      description: `${atRisk.map((m) => m.user.name).join(", ")} need attention — low completion or gaps.`,
      actionLabel: "View team",
      actionHref: "/manager/team",
    });
  }

  const notStarted = teamStatuses.filter((m) => m.completionRate === 0);
  if (notStarted.length > 0) {
    recs.push({
      id: "rec-not-started",
      priority: "medium",
      title: "Assign onboarding lessons",
      description: `${notStarted.length} staff haven't started any training yet. Send a reminder or assign core modules.`,
      actionLabel: "Manage team",
      actionHref: "/manager/team",
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: "rec-healthy",
      priority: "low",
      title: "Team is on track",
      description: "Completion rates look healthy. Use Assign Refresher to keep cycles fresh across categories.",
      actionLabel: "Open training",
      actionHref: "/manager/training",
    });
  }

  return recs;
}