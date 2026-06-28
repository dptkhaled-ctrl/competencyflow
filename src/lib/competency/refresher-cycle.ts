import { getRefresherIntervalDays } from "@/lib/competency/domains";
import type {
  CompetencyDomain,
  Lesson,
  LessonAssignment,
  LessonProgress,
  User,
} from "@/lib/types";

export interface CategoryCycleState {
  category: string;
  orderIndex: number;
  intervalDays: number;
  lastCompletedAt: string | null;
  daysSinceCompletion: number;
  phaseOffsetDays: number;
  isDue: boolean;
  daysUntilDue: number;
  freshnessPercent: number;
}

export interface RefresherCycleSnapshot {
  categories: CategoryCycleState[];
  currentDue: CategoryCycleState | null;
  nextUp: CategoryCycleState | null;
  rotationLabel: string;
  cadenceDays: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysSince(isoOrMs: string | number | null): number {
  if (!isoOrMs) return 999;
  const ts = typeof isoOrMs === "number" ? isoOrMs : new Date(isoOrMs).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return 999;
  return Math.floor((Date.now() - ts) / MS_PER_DAY);
}

function getCycleAnchorMs(user: User): number {
  if (user.refresherCycleStartedAt) {
    return new Date(user.refresherCycleStartedAt).getTime();
  }
  // Stable anchor so stagger is consistent across sessions
  let hash = 0;
  for (let i = 0; i < user.id.length; i++) {
    hash = (hash * 31 + user.id.charCodeAt(i)) | 0;
  }
  const offsetDays = Math.abs(hash % 14);
  return Date.now() - offsetDays * MS_PER_DAY;
}

function getLastCategoryCompletion(
  category: string,
  userId: string,
  orgId: string,
  lessons: Lesson[],
  progress: LessonProgress[]
): string | null {
  const categoryLessonIds = new Set(
    lessons.filter((l) => l.orgId === orgId && l.category === category).map((l) => l.id)
  );
  const completed = progress.filter(
    (p) =>
      p.userId === userId &&
      p.status === "completed" &&
      categoryLessonIds.has(p.lessonId) &&
      p.completedAt
  );
  if (completed.length === 0) return null;
  return completed.reduce((latest, p) =>
    new Date(p.completedAt!) > new Date(latest.completedAt!) ? p : latest
  ).completedAt!;
}

function computeRawDue(
  lastCompletedAt: string | null,
  intervalDays: number,
  phaseOffsetDays: number,
  daysSinceAnchor: number
): { isDue: boolean; daysUntilDue: number; daysSinceCompletion: number } {
  if (lastCompletedAt) {
    const daysSinceCompletion = daysSince(lastCompletedAt);
    const daysUntilDue = Math.max(0, intervalDays - daysSinceCompletion);
    return {
      isDue: daysSinceCompletion >= intervalDays,
      daysUntilDue,
      daysSinceCompletion,
    };
  }

  const daysUntilDue = Math.max(0, phaseOffsetDays - daysSinceAnchor);
  return {
    isDue: daysSinceAnchor >= phaseOffsetDays,
    daysUntilDue,
    daysSinceCompletion: daysSinceAnchor,
  };
}

export function buildRefresherCycleSnapshot(
  user: User,
  domains: CompetencyDomain[],
  lessons: Lesson[],
  progress: LessonProgress[]
): RefresherCycleSnapshot | null {
  const priorityCats = user.priorityCategories ?? [];
  if (priorityCats.length === 0) return null;

  const anchorMs = getCycleAnchorMs(user);
  const daysSinceAnchor = daysSince(anchorMs);
  const n = priorityCats.length;

  const categories: CategoryCycleState[] = priorityCats.map((category, orderIndex) => {
    const intervalDays = getRefresherIntervalDays(category, {
      user,
      domains,
      orgId: user.orgId,
    });
    const phaseOffsetDays =
      orderIndex * Math.max(1, Math.floor(intervalDays / n));
    const lastCompletedAt = getLastCategoryCompletion(
      category,
      user.id,
      user.orgId,
      lessons,
      progress
    );

    const raw = computeRawDue(
      lastCompletedAt,
      intervalDays,
      phaseOffsetDays,
      daysSinceAnchor
    );
    const freshnessPercent = lastCompletedAt
      ? Math.max(0, Math.round(100 - (raw.daysSinceCompletion / intervalDays) * 100))
      : Math.max(0, Math.round(100 - (raw.daysUntilDue / Math.max(phaseOffsetDays, 1)) * 100));

    return {
      category,
      orderIndex,
      intervalDays,
      lastCompletedAt,
      daysSinceCompletion: raw.daysSinceCompletion,
      phaseOffsetDays,
      isDue: false,
      daysUntilDue: raw.daysUntilDue,
      freshnessPercent,
    };
  });

  // Only one category "pops" at a time — first in rotation order that is raw-due
  let currentDue: CategoryCycleState | null = null;
  for (const state of categories) {
    const raw = computeRawDue(
      state.lastCompletedAt,
      state.intervalDays,
      state.phaseOffsetDays,
      daysSinceAnchor
    );
    if (raw.isDue) {
      state.isDue = true;
      state.daysUntilDue = 0;
      currentDue = state;
      break;
    }
  }

  const nextUp =
    categories.find((c) => !c.isDue) ??
    null;

  const sortedByNext = [...categories]
    .filter((c) => !c.isDue)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  const cadenceDays =
    categories.length > 0
      ? Math.round(
          categories.reduce((sum, c) => sum + c.intervalDays, 0) / categories.length
        )
      : 90;

  return {
    categories,
    currentDue,
    nextUp: sortedByNext[0] ?? nextUp,
    rotationLabel: priorityCats.join(" → "),
    cadenceDays,
  };
}

export function buildAutoRefresherLesson(orgId: string, category: string): Lesson {
  const stamp = Date.now();
  return {
    id: `lesson-cycle-refresher-${stamp}`,
    orgId,
    title: `Refresher: ${category}`,
    description: `Quick refresher on ${category}.`,
    category,
    estimatedMinutes: 2,
    slides: [
      {
        id: `s1-${stamp}`,
        title: "Key points",
        body: `Review the essentials for ${category}. Apply them in your daily work.`,
        durationSeconds: 45,
      },
      {
        id: `s2-${stamp}`,
        title: "Remember",
        body: "Staying current on each topic keeps you ready — one category at a time.",
        durationSeconds: 30,
      },
    ],
    quiz: [
      {
        id: `q1-${stamp}`,
        prompt: "What should you do after this refresher?",
        options: [
          "Apply the key points in your work",
          "Skip until next month",
          "Ignore if busy",
          "Wait for someone to remind you",
        ],
        correctIndex: 0,
        explanation: "Put the guidance into practice right away.",
      },
    ],
    sourceDocumentIds: [],
    isRefresher: true,
    isAutoGenerated: true,
  };
}

export function pickRefresherLessonForCategory(
  category: string,
  userId: string,
  orgId: string,
  lessons: Lesson[],
  assignments: LessonAssignment[],
  progress: LessonProgress[]
): Lesson | null {
  const assignedIds = new Set(
    assignments.filter((a) => a.userId === userId).map((a) => a.lessonId)
  );

  const categoryLessons = lessons.filter(
    (l) => l.orgId === orgId && l.category === category && assignedIds.has(l.id)
  );

  const incomplete = categoryLessons.find((l) => {
    const p = progress.find((pr) => pr.userId === userId && pr.lessonId === l.id);
    return !p || p.status !== "completed";
  });
  if (incomplete) return incomplete;

  const refresher = categoryLessons.find((l) => l.isRefresher);
  if (refresher) return refresher;

  return categoryLessons[0] ?? null;
}

export function ensureDueRefresherLesson(
  user: User,
  domains: CompetencyDomain[],
  lessons: Lesson[],
  assignments: LessonAssignment[],
  progress: LessonProgress[]
): { snapshot: RefresherCycleSnapshot | null; lesson: Lesson | null; created: boolean } {
  const snapshot = buildRefresherCycleSnapshot(user, domains, lessons, progress);
  if (!snapshot?.currentDue) {
    return { snapshot, lesson: null, created: false };
  }

  const category = snapshot.currentDue.category;
  let lesson = pickRefresherLessonForCategory(
    category,
    user.id,
    user.orgId,
    lessons,
    assignments,
    progress
  );

  if (lesson) {
    const p = progress.find((pr) => pr.userId === user.id && pr.lessonId === lesson!.id);
    if (p?.status === "completed") {
      lesson = null;
    }
  }

  if (!lesson) {
    lesson = buildAutoRefresherLesson(user.orgId, category);
    return { snapshot, lesson, created: true };
  }

  return { snapshot, lesson, created: false };
}

export function buildRefresherAssignment(
  lessonId: string,
  userId: string
): LessonAssignment {
  return {
    id: `asgn-cycle-${lessonId}-${userId}-${Date.now()}`,
    lessonId,
    userId,
    assignedAt: new Date().toISOString().split("T")[0],
  };
}