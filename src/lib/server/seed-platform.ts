import { defaultDomainsForOrg, DEFAULT_REFRESHER_INTERVAL_DAYS } from "@/lib/competency/domains";
import { documentChunks } from "@/lib/data/documents";
import {
  assignments,
  initialIncidents,
  initialProgress,
  initialStreaks,
  lessons,
  organizations,
  teams,
  users,
} from "@/lib/data/seed";
import type { PlatformData, UserXP } from "@/lib/types";

const initialXp: UserXP[] = users
  .filter((u) => u.role === "staff")
  .map((u) => ({
    userId: u.id,
    totalXp: Math.floor(Math.random() * 200) + 50,
    level: 1,
    dailyXp: 0,
    dailyGoal: 50,
    lastXpDate: new Date().toISOString().split("T")[0],
  }));

const competencyDomains = organizations.flatMap((org) =>
  defaultDomainsForOrg(org.id, org.orgType ?? "snf")
);

export function createInitialPlatformData(): PlatformData {
  return {
    organizations,
    teams,
    users,
    lessons,
    assignments,
    progress: initialProgress,
    streaks: initialStreaks,
    userXp: initialXp,
    incidents: initialIncidents,
    lessonRequests: [],
    documentChunks,
    uploadedMaterials: [],
    competencyDomains,
    competencyRecords: [],
    assessmentEvents: [],
    learningSessions: [],
    tutorMessages: [],
    domainAssignments: [],
  };
}

function sanitizeReferences(data: PlatformData): PlatformData {
  const userIds = new Set((data.users ?? []).map((u) => u.id));
  const lessonIds = new Set((data.lessons ?? []).map((l) => l.id));
  const orgIds = new Set((data.organizations ?? []).map((o) => o.id));

  return {
    ...data,
    assignments: (data.assignments ?? []).filter(
      (a) => userIds.has(a.userId) && lessonIds.has(a.lessonId)
    ),
    progress: (data.progress ?? []).filter(
      (p) => userIds.has(p.userId) && lessonIds.has(p.lessonId)
    ),
    streaks: (data.streaks ?? []).filter((s) => userIds.has(s.userId)),
    userXp: (data.userXp ?? []).filter((x) => userIds.has(x.userId)),
    competencyRecords: (data.competencyRecords ?? []).filter((r) =>
      userIds.has(r.userId)
    ),
    assessmentEvents: (data.assessmentEvents ?? []).filter((e) =>
      userIds.has(e.userId)
    ),
    tutorMessages: (data.tutorMessages ?? []).filter((m) =>
      userIds.has(m.userId)
    ),
    documentChunks: (data.documentChunks ?? []).filter((c) =>
      orgIds.has(c.orgId)
    ),
    incidents: (data.incidents ?? []).filter(
      (i) => orgIds.has(i.orgId) && userIds.has(i.reportedBy)
    ),
  };
}

function ensureSeedLessonsAndAssignments(data: PlatformData): PlatformData {
  const existingLessonIds = new Set((data.lessons ?? []).map((l) => l.id));
  const mergedLessons = [
    ...(data.lessons ?? []),
    ...lessons.filter((l) => !existingLessonIds.has(l.id)),
  ];

  const lessonIds = new Set(mergedLessons.map((l) => l.id));
  const existingAsgnKeys = new Set(
    (data.assignments ?? []).map((a) => `${a.userId}:${a.lessonId}`)
  );
  const newAssignments = assignments.filter(
    (a) =>
      lessonIds.has(a.lessonId) &&
      !existingAsgnKeys.has(`${a.userId}:${a.lessonId}`)
  );

  const existingChunkIds = new Set((data.documentChunks ?? []).map((c) => c.id));
  const mergedChunks = [
    ...(data.documentChunks ?? []),
    ...documentChunks.filter((c) => !existingChunkIds.has(c.id)),
  ];

  const userIds = new Set((data.users ?? []).map((u) => u.id));
  const existingProgressKeys = new Set(
    (data.progress ?? []).map((p) => `${p.userId}:${p.lessonId}`)
  );
  const newProgress = initialProgress.filter(
    (p) =>
      userIds.has(p.userId) &&
      lessonIds.has(p.lessonId) &&
      !existingProgressKeys.has(`${p.userId}:${p.lessonId}`)
  );

  const existingStreakUserIds = new Set((data.streaks ?? []).map((s) => s.userId));
  const newStreaks = initialStreaks.filter(
    (s) => userIds.has(s.userId) && !existingStreakUserIds.has(s.userId)
  );

  return {
    ...data,
    lessons: mergedLessons,
    assignments: [...(data.assignments ?? []), ...newAssignments],
    documentChunks: mergedChunks,
    progress: [...(data.progress ?? []), ...newProgress],
    streaks: [...(data.streaks ?? []), ...newStreaks],
  };
}

export function migratePlatformData(data: PlatformData): PlatformData {
  const existingOrgIds = new Set((data.organizations ?? []).map((o) => o.id));
  const mergedOrgs = [
    ...(data.organizations ?? []).map((org) => {
      const seed = organizations.find((s) => s.id === org.id);
      return {
        ...org,
        orgType: seed?.orgType ?? org.orgType ?? ("snf" as const),
      };
    }),
    ...organizations.filter((o) => !existingOrgIds.has(o.id)),
  ];

  const existingTeamIds = new Set((data.teams ?? []).map((t) => t.id));
  const mergedTeams = [
    ...(data.teams ?? []),
    ...teams.filter((t) => !existingTeamIds.has(t.id)),
  ];

  const existingUserIds = new Set((data.users ?? []).map((u) => u.id));
  const mergedUsers = [
    ...(data.users ?? []).map((u) => {
      const seed = users.find((s) => s.id === u.id);
      return {
        ...u,
        jobTitle: u.jobTitle ?? seed?.jobTitle,
        priorityCategories: u.priorityCategories ?? seed?.priorityCategories,
      };
    }),
    ...users.filter((u) => !existingUserIds.has(u.id)),
  ];

  const existingDomainIds = new Set((data.competencyDomains ?? []).map((d) => d.id));
  const mergedDomains = [
    ...(data.competencyDomains ?? []).map((d) => ({
      ...d,
      refresherIntervalDays:
        d.refresherIntervalDays ?? DEFAULT_REFRESHER_INTERVAL_DAYS,
    })),
    ...competencyDomains.filter((d) => !existingDomainIds.has(d.id)),
  ];

  let migrated: PlatformData = {
    ...data,
    organizations: mergedOrgs,
    teams: mergedTeams,
    users: mergedUsers,
    competencyDomains: mergedDomains.length ? mergedDomains : competencyDomains,
    competencyRecords: data.competencyRecords ?? [],
    assessmentEvents: data.assessmentEvents ?? [],
    learningSessions: data.learningSessions ?? [],
    tutorMessages: data.tutorMessages ?? [],
    domainAssignments: data.domainAssignments ?? [],
    lessonRequests: data.lessonRequests ?? [],
  };

  migrated = sanitizeReferences(migrated);
  migrated = ensureSeedLessonsAndAssignments(migrated);

  return migrated;
}